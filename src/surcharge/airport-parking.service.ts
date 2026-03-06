import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class AirportParkingService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  // ── Admin CRUD ────────────────────────────────────────────────────────────
  async list(tenantId: string) {
    return this.db.query(
      `SELECT id, name, keywords, fee_minor, is_active, created_at
       FROM public.tenant_airport_parking
       WHERE tenant_id = $1
       ORDER BY name ASC`,
      [tenantId],
    );
  }

  async create(tenantId: string, dto: {
    name: string; keywords: string[]; fee_minor: number; is_active?: boolean;
  }) {
    const [row] = await this.db.query(
      `INSERT INTO public.tenant_airport_parking
         (tenant_id, name, keywords, fee_minor, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [tenantId, dto.name, dto.keywords, dto.fee_minor, dto.is_active ?? true],
    );
    return row;
  }

  async update(tenantId: string, id: string, dto: {
    name?: string; keywords?: string[]; fee_minor?: number; is_active?: boolean;
  }) {
    await this.db.query(
      `UPDATE public.tenant_airport_parking
       SET name      = COALESCE($1, name),
           keywords  = COALESCE($2, keywords),
           fee_minor = COALESCE($3, fee_minor),
           is_active = COALESCE($4, is_active),
           updated_at = now()
       WHERE id = $5 AND tenant_id = $6`,
      [dto.name ?? null, dto.keywords ?? null, dto.fee_minor ?? null,
       dto.is_active ?? null, id, tenantId],
    );
    return { ok: true };
  }

  async remove(tenantId: string, id: string) {
    await this.db.query(
      `DELETE FROM public.tenant_airport_parking WHERE id=$1 AND tenant_id=$2`,
      [id, tenantId],
    );
    return { ok: true };
  }

  // ── Pricing integration ───────────────────────────────────────────────────
  /**
   * Resolve parking fee for a given pickup address.
   * For return trips, fee is applied only once (caller passes isReturn=false
   * for the A→B leg; the B→A leg uses dropoff as "pickup", which is non-airport).
   */
  async resolveParking(tenantId: string, pickupAddress: string): Promise<{
    fee_minor: number;
    label: string | null;
  }> {
    const rules = await this.db.query(
      `SELECT name, keywords, fee_minor
       FROM public.tenant_airport_parking
       WHERE tenant_id = $1 AND is_active = true`,
      [tenantId],
    );

    const upper = pickupAddress.toUpperCase();
    for (const rule of rules) {
      const match = (rule.keywords as string[]).some(kw =>
        upper.includes(kw.toUpperCase()),
      );
      if (match) {
        return { fee_minor: rule.fee_minor, label: rule.name };
      }
    }
    return { fee_minor: 0, label: null };
  }
}
