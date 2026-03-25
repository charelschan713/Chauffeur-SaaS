import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface SurchargeResult {
  label: string;          // e.g. "Late Night Surcharge" or "Public Holiday"
  type: 'PERCENTAGE' | 'FIXED';
  value: number;          // e.g. 20 (for 20%) or 5000 (cents for FIXED)
  amount_minor: number;   // actual amount added in cents
}

@Injectable()
export class SurchargeService {
  private readonly logger = new Logger(SurchargeService.name);

  constructor(@InjectDataSource() private readonly db: DataSource) {}

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

    // Use booking-local time directly (no timezone conversion)
    const { localDate, localTime } = this.parseLocalDateTime(pickupRaw);

    // Weekday/weekend based on the booking-local date
    const [y, m, d] = localDate.split('-').map(Number);
    const localDateObj = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
    const dayOfWeek = localDateObj.toLocaleDateString('en-AU', { weekday: 'long' });
    const isWeekend = dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday';

    const surcharges: SurchargeResult[] = [];

    // ── 1. Check public holidays ────────────────────────────────────
    const holidays = await this.db.query(
      `SELECT name, surcharge_type, surcharge_value
       FROM tenant_holidays
       WHERE tenant_id = $1
         AND is_active = true
         AND (
           (recurring = true AND to_char(date, 'MM-DD') = to_char($2::date, 'MM-DD'))
           OR (recurring = false AND date = $2::date)
         )`,
      [tenantId, localDate],
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
      `SELECT name, day_type, start_time, end_time, surcharge_type, surcharge_value
       FROM tenant_time_surcharges
       WHERE tenant_id = $1
         AND is_active = true
         AND day_type = ANY($2)`,
      [tenantId, dayFilter],
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

  private parseLocalDateTime(pickupRaw: string) {
    if (pickupRaw.includes('T')) {
      const [datePart, timePartRaw] = pickupRaw.split('T');
      const timePart = (timePartRaw ?? '').slice(0, 8) || '00:00:00';
      return { localDate: datePart, localTime: timePart.length === 5 ? `${timePart}:00` : timePart };
    }
    // Fallback: try Date parsing
    const dt = new Date(pickupRaw);
    if (!Number.isNaN(dt.getTime())) {
      const iso = dt.toISOString();
      return { localDate: iso.slice(0, 10), localTime: iso.slice(11, 19) };
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
      `SELECT * FROM tenant_time_surcharges WHERE tenant_id = $1 ORDER BY start_time`,
      [tenantId],
    );
  }

  async createTimeSurcharge(tenantId: string, body: any) {
    const { name, day_type, start_time, end_time, surcharge_type, surcharge_value } = body;
    const [row] = await this.db.query(
      `INSERT INTO tenant_time_surcharges (tenant_id, name, day_type, start_time, end_time, surcharge_type, surcharge_value)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [tenantId, name, day_type ?? 'ALL', start_time, end_time, surcharge_type ?? 'PERCENTAGE', surcharge_value],
    );
    return row;
  }

  async updateTimeSurcharge(tenantId: string, id: string, body: any) {
    const fields: string[] = [];
    const vals: any[] = [tenantId, id];
    let i = 3;
    for (const key of ['name','day_type','start_time','end_time','surcharge_type','surcharge_value','is_active']) {
      if (body[key] !== undefined) { fields.push(`${key} = $${i++}`); vals.push(body[key]); }
    }
    if (!fields.length) return;
    const [row] = await this.db.query(
      `UPDATE tenant_time_surcharges SET ${fields.join(',')} WHERE tenant_id=$1 AND id=$2 RETURNING *`,
      vals,
    );
    return row;
  }

  async deleteTimeSurcharge(tenantId: string, id: string) {
    await this.db.query(`DELETE FROM tenant_time_surcharges WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
  }

  async listHolidays(tenantId: string) {
    return this.db.query(
      `SELECT * FROM tenant_holidays WHERE tenant_id = $1 ORDER BY to_char(date,'MM-DD')`,
      [tenantId],
    );
  }

  async createHoliday(tenantId: string, body: any) {
    const { name, date, recurring, surcharge_type, surcharge_value } = body;
    const [row] = await this.db.query(
      `INSERT INTO tenant_holidays (tenant_id, name, date, recurring, surcharge_type, surcharge_value)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [tenantId, name, date, recurring ?? true, surcharge_type ?? 'PERCENTAGE', surcharge_value],
    );
    return row;
  }

  async updateHoliday(tenantId: string, id: string, body: any) {
    const fields: string[] = [];
    const vals: any[] = [tenantId, id];
    let i = 3;
    for (const key of ['name','date','recurring','surcharge_type','surcharge_value','is_active']) {
      if (body[key] !== undefined) { fields.push(`${key} = $${i++}`); vals.push(body[key]); }
    }
    if (!fields.length) return;
    const [row] = await this.db.query(
      `UPDATE tenant_holidays SET ${fields.join(',')} WHERE tenant_id=$1 AND id=$2 RETURNING *`,
      vals,
    );
    return row;
  }

  async deleteHoliday(tenantId: string, id: string) {
    await this.db.query(`DELETE FROM tenant_holidays WHERE tenant_id=$1 AND id=$2`, [tenantId, id]);
  }
}
