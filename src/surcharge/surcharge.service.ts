import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface SurchargeResult {
  label: string;          // e.g. "Late Night Surcharge" or "Public Holiday"
  type: 'PERCENTAGE' | 'FIXED';
  value: number;          // e.g. 20 (for 20%) or 5000 (cents for FIXED)
  amount_minor: number;   // actual amount added in cents
}

@Injectable()
export class SurchargeService implements OnModuleInit {
  private readonly logger = new Logger(SurchargeService.name);

  private normalizeSurchargeValue(value: unknown): number {
    if (value === null || value === undefined || value === '') {
      throw new BadRequestException('Surcharge value is required');
    }
    const n = Number(value);
    if (!Number.isFinite(n)) {
      throw new BadRequestException('Surcharge value must be a valid number');
    }
    return n;
  }

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async onModuleInit() {
    // Self-heal for environments where migration wasn't applied yet.
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS public.tenant_surcharge_cities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        surcharge_type TEXT NOT NULL,
        surcharge_id UUID NOT NULL,
        city_id UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (tenant_id, surcharge_type, surcharge_id, city_id)
      )
    `).catch((e) => this.logger.warn(`tenant_surcharge_cities bootstrap failed: ${e?.message || e}`));

    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_tenant_surcharge_cities_tenant ON public.tenant_surcharge_cities(tenant_id)
    `).catch(() => {});

    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_tenant_surcharge_cities_surcharge ON public.tenant_surcharge_cities(surcharge_type, surcharge_id)
    `).catch(() => {});

    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_tenant_surcharge_cities_city ON public.tenant_surcharge_cities(city_id)
    `).catch(() => {});
  }

  /**
   * Resolve all applicable surcharges for a pickup datetime.
   * Returns list of applicable surcharges and total surcharge amount in minor units.
   */
  async resolve(
    tenantId: string,
    pickupAtUtc: string | Date,
    baseFareMinor: number,
    timezone: string = 'Australia/Sydney',
    cityId: string | null = null,
  ): Promise<{ surcharges: SurchargeResult[]; total_surcharge_minor: number }> {
    const pickupRaw = typeof pickupAtUtc === 'string'
      ? pickupAtUtc
      : pickupAtUtc.toISOString();

    // Use booking-local time in the provided timezone
    const { localDate, localTime } = this.toLocalDateTime(pickupRaw, timezone);

    // Weekday/weekend based on the booking-local date
    const [y, m, d] = localDate.split('-').map(Number);
    const localDateObj = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
    const dayOfWeek = localDateObj.toLocaleDateString('en-AU', { weekday: 'long' });
    const isWeekend = dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday';

    const surcharges: SurchargeResult[] = [];

    if (!cityId) {
      return { surcharges, total_surcharge_minor: 0 };
    }

    // ── 1. Check public holidays ────────────────────────────────────
    const holidays = await this.db.query(
      `SELECT h.name, h.surcharge_type, h.surcharge_value
       FROM tenant_holidays h
       JOIN tenant_surcharge_cities sc
         ON sc.tenant_id = h.tenant_id
        AND sc.surcharge_type = 'HOLIDAY'
        AND sc.surcharge_id = h.id
       WHERE h.tenant_id = $1
         AND h.is_active = true
         AND sc.city_id = $2
         AND (
           (h.recurring = true AND to_char(h.date, 'MM-DD') = to_char($3::date, 'MM-DD'))
           OR (h.recurring = false AND h.date = $3::date)
         )`,
      [tenantId, cityId, localDate],
    );

    for (const h of holidays) {
      const amount = this.calcAmount(baseFareMinor, h.surcharge_type, Number(h.surcharge_value));
      surcharges.push({
        label: this.mapHolidayLabel(),
        type: h.surcharge_type,
        value: Number(h.surcharge_value),
        amount_minor: amount,
      });
    }

    // ── 2. Check time-based surcharges ──────────────────────────────
    const dayFilter = isWeekend ? ['WEEKEND', 'ALL'] : ['WEEKDAY', 'ALL'];
    const timeSurcharges = await this.db.query(
      `SELECT ts.name, ts.day_type, ts.start_time, ts.end_time, ts.surcharge_type, ts.surcharge_value
       FROM tenant_time_surcharges ts
       JOIN tenant_surcharge_cities sc
         ON sc.tenant_id = ts.tenant_id
        AND sc.surcharge_type = 'TIME'
        AND sc.surcharge_id = ts.id
       WHERE ts.tenant_id = $1
         AND ts.is_active = true
         AND ts.day_type = ANY($2)
         AND sc.city_id = $3`,
      [tenantId, dayFilter, cityId],
    );

    for (const ts of timeSurcharges) {
      if (this.timeInRange(localTime, ts.start_time, ts.end_time)) {
        const amount = this.calcAmount(baseFareMinor, ts.surcharge_type, Number(ts.surcharge_value));
        surcharges.push({
          label: this.mapTimeSurchargeLabel(ts),
          type: ts.surcharge_type,
          value: Number(ts.surcharge_value),
          amount_minor: amount,
        });
      }
    }

    const total_surcharge_minor = surcharges.reduce((sum, s) => sum + s.amount_minor, 0);
    return { surcharges, total_surcharge_minor };
  }

  private calcAmount(baseFareMinor: number, type: string, value: number): number {
    if (type === 'PERCENTAGE') {
      return Math.round(baseFareMinor * (value / 100));
    }
    // FIXED — value stored as dollars, convert to minor
    return Math.round(value * 100);
  }

  private mapHolidayLabel(): string {
    return 'Holiday surcharge';
  }

  private mapTimeSurchargeLabel(ts: { name?: string; day_type?: string; start_time?: string; end_time?: string }): string {
    if (ts.day_type === 'WEEKEND') return 'Weekend surcharge';
    const name = (ts.name ?? '').toLowerCase();
    if (name.includes('early')) return 'Early morning surcharge';
    if (name.includes('late') || name.includes('night')) return 'Late night surcharge';

    const start = typeof ts.start_time === 'string' ? ts.start_time : '';
    const end = typeof ts.end_time === 'string' ? ts.end_time : '';
    const startMin = start ? this.timeToMinutes(start) : null;
    const endMin = end ? this.timeToMinutes(end) : null;
    if (startMin !== null && endMin !== null) {
      // Early morning heuristic: 00:00–06:00
      if ((startMin >= 0 && startMin < 360) || (endMin > 0 && endMin <= 360)) {
        return 'Early morning surcharge';
      }
      // Late night heuristic: 21:00–24:00 or overnight range
      if (startMin >= 1260 || startMin > endMin) {
        return 'Late night surcharge';
      }
    }

    return 'Late night surcharge';
  }

  private toLocalDateTime(pickupRaw: string, timezone: string) {
    // If pickupRaw already looks like local datetime without timezone, keep it.
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(pickupRaw) && !/[Z+-]\d{2}:?\d{2}$/.test(pickupRaw)) {
      const [datePart, timePartRaw] = pickupRaw.split('T');
      const timePart = (timePartRaw ?? '').slice(0, 8) || '00:00:00';
      return { localDate: datePart, localTime: timePart.length === 5 ? `${timePart}:00` : timePart };
    }

    // Convert from UTC/offset to the booking timezone
    const dt = new Date(pickupRaw);
    if (!Number.isNaN(dt.getTime())) {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone || 'Australia/Sydney',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
      });
      const parts = formatter.formatToParts(dt);
      const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
      const localDate = `${get('year')}-${get('month')}-${get('day')}`;
      const localTime = `${get('hour')}:${get('minute')}:${get('second')}`;
      return { localDate, localTime };
    }

    return { localDate: '', localTime: '' };
  }

  private timeInRange(time: string, start: string, end: string): boolean {
    // Handles overnight ranges e.g. 23:00 - 05:00
    const t = this.timeToMinutes(time);
    const s = this.timeToMinutes(start);
    const e = this.timeToMinutes(end);
    if (s <= e) return t >= s && t < e;
    return t >= s || t < e; // overnight
  }

  private timeToMinutes(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  // ── CRUD ──────────────────────────────────────────────────────────

  async listTimeSurcharges(tenantId: string) {
    return this.db.query(
      `SELECT ts.*, COALESCE(array_agg(sc.city_id) FILTER (WHERE sc.city_id IS NOT NULL), '{}') AS city_ids
       FROM tenant_time_surcharges ts
       LEFT JOIN tenant_surcharge_cities sc
         ON sc.tenant_id = ts.tenant_id
        AND sc.surcharge_type = 'TIME'
        AND sc.surcharge_id = ts.id
       WHERE ts.tenant_id = $1
       GROUP BY ts.id
       ORDER BY ts.start_time`,
      [tenantId],
    );
  }

  async createTimeSurcharge(tenantId: string, body: any) {
    const { name, day_type, start_time, end_time, surcharge_type, surcharge_value, city_ids } = body;
    const value = this.normalizeSurchargeValue(surcharge_value);
    const [row] = await this.db.query(
      `INSERT INTO tenant_time_surcharges (tenant_id, name, day_type, start_time, end_time, surcharge_type, surcharge_value)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [tenantId, name, day_type ?? 'ALL', start_time, end_time, surcharge_type ?? 'PERCENTAGE', value],
    );
    await this.setSurchargeCities(tenantId, 'TIME', row.id, city_ids ?? []);
    return row;
  }

  async updateTimeSurcharge(tenantId: string, id: string, body: any) {
    const fields: string[] = [];
    const vals: any[] = [tenantId, id];
    let i = 3;
    for (const key of ['name','day_type','start_time','end_time','surcharge_type','surcharge_value','is_active']) {
      if (body[key] !== undefined) {
        fields.push(`${key} = $${i++}`);
        vals.push(key === 'surcharge_value' ? this.normalizeSurchargeValue(body[key]) : body[key]);
      }
    }
    const [row] = fields.length ? await this.db.query(
      `UPDATE tenant_time_surcharges SET ${fields.join(',')} WHERE tenant_id=$1 AND id=$2 RETURNING *`,
      vals,
    ) : [null];
    if (body.city_ids !== undefined) {
      await this.setSurchargeCities(tenantId, 'TIME', id, body.city_ids ?? []);
    }
    return row ?? undefined;
  }

  async deleteTimeSurcharge(tenantId: string, id: string) {
    await this.db.query(`DELETE FROM tenant_time_surcharges WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
    await this.db.query(
      `DELETE FROM tenant_surcharge_cities WHERE tenant_id=$1 AND surcharge_type='TIME' AND surcharge_id=$2`,
      [tenantId, id],
    );
  }

  async listHolidays(tenantId: string) {
    return this.db.query(
      `SELECT h.*, COALESCE(array_agg(sc.city_id) FILTER (WHERE sc.city_id IS NOT NULL), '{}') AS city_ids
       FROM tenant_holidays h
       LEFT JOIN tenant_surcharge_cities sc
         ON sc.tenant_id = h.tenant_id
        AND sc.surcharge_type = 'HOLIDAY'
        AND sc.surcharge_id = h.id
       WHERE h.tenant_id = $1
       GROUP BY h.id
       ORDER BY to_char(h.date,'MM-DD')`,
      [tenantId],
    );
  }

  async createHoliday(tenantId: string, body: any) {
    const { name, date, recurring, surcharge_type, surcharge_value, city_ids } = body;
    const value = this.normalizeSurchargeValue(surcharge_value);
    const [row] = await this.db.query(
      `INSERT INTO tenant_holidays (tenant_id, name, date, recurring, surcharge_type, surcharge_value)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [tenantId, name, date, recurring ?? true, surcharge_type ?? 'PERCENTAGE', value],
    );
    await this.setSurchargeCities(tenantId, 'HOLIDAY', row.id, city_ids ?? []);
    return row;
  }

  async updateHoliday(tenantId: string, id: string, body: any) {
    const fields: string[] = [];
    const vals: any[] = [tenantId, id];
    let i = 3;
    for (const key of ['name','date','recurring','surcharge_type','surcharge_value','is_active']) {
      if (body[key] !== undefined) {
        fields.push(`${key} = $${i++}`);
        vals.push(key === 'surcharge_value' ? this.normalizeSurchargeValue(body[key]) : body[key]);
      }
    }
    const [row] = fields.length ? await this.db.query(
      `UPDATE tenant_holidays SET ${fields.join(',')} WHERE tenant_id=$1 AND id=$2 RETURNING *`,
      vals,
    ) : [null];
    if (body.city_ids !== undefined) {
      await this.setSurchargeCities(tenantId, 'HOLIDAY', id, body.city_ids ?? []);
    }
    return row ?? undefined;
  }

  async deleteHoliday(tenantId: string, id: string) {
    await this.db.query(`DELETE FROM tenant_holidays WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
    await this.db.query(
      `DELETE FROM tenant_surcharge_cities WHERE tenant_id=$1 AND surcharge_type='HOLIDAY' AND surcharge_id=$2`,
      [tenantId, id],
    );
  }

  private async setSurchargeCities(tenantId: string, surchargeType: 'TIME'|'HOLIDAY', surchargeId: string, cityIds: string[]) {
    await this.db.query(
      `DELETE FROM tenant_surcharge_cities WHERE tenant_id=$1 AND surcharge_type=$2 AND surcharge_id=$3`,
      [tenantId, surchargeType, surchargeId],
    );
    if (!cityIds || cityIds.length === 0) return; // no cities = disabled
    for (const cityId of cityIds) {
      await this.db.query(
        `INSERT INTO tenant_surcharge_cities (tenant_id, surcharge_type, surcharge_id, city_id)
         VALUES ($1,$2,$3,$4)`,
        [tenantId, surchargeType, surchargeId, cityId],
      );
    }
  }
}
