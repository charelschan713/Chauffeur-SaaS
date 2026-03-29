import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export type LoyaltyTierCode = 'STANDARD' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'VIP';

export interface LoyaltyTierRow {
  tier: LoyaltyTierCode;
  discount_pct: number;
  active: boolean;
  sort_order: number;
}

const DEFAULT_TIERS: LoyaltyTierRow[] = [
  { tier: 'STANDARD', discount_pct: 0, active: true, sort_order: 10 },
  { tier: 'SILVER', discount_pct: 5, active: true, sort_order: 20 },
  { tier: 'GOLD', discount_pct: 10, active: true, sort_order: 30 },
  { tier: 'PLATINUM', discount_pct: 15, active: true, sort_order: 40 },
  { tier: 'VIP', discount_pct: 20, active: true, sort_order: 50 },
];

@Injectable()
export class LoyaltyService {
  constructor(private readonly db: DataSource) {}

  async list(tenantId: string): Promise<LoyaltyTierRow[]> {
    const rows = await this.db.query(
      `SELECT tier, discount_pct, active, sort_order
         FROM public.tenant_loyalty_tiers
        WHERE tenant_id = $1
        ORDER BY sort_order ASC, tier ASC`,
      [tenantId],
    );

    if (!rows.length) return DEFAULT_TIERS;

    return rows.map((r: any) => ({
      tier: r.tier,
      discount_pct: Number(r.discount_pct ?? 0),
      active: !!r.active,
      sort_order: Number(r.sort_order ?? 999),
    }));
  }

  async upsertMany(tenantId: string, tiers: Partial<LoyaltyTierRow>[]) {
    for (const t of tiers) {
      if (!t.tier) continue;
      await this.db.query(
        `INSERT INTO public.tenant_loyalty_tiers (tenant_id, tier, discount_pct, active, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (tenant_id, tier)
         DO UPDATE SET discount_pct = EXCLUDED.discount_pct,
                       active = EXCLUDED.active,
                       sort_order = EXCLUDED.sort_order,
                       updated_at = now()`,
        [
          tenantId,
          t.tier,
          Number(t.discount_pct ?? 0),
          t.active ?? true,
          Number(t.sort_order ?? 999),
        ],
      );
    }
    return this.list(tenantId);
  }

  async patchOne(tenantId: string, tier: LoyaltyTierCode, patch: Partial<LoyaltyTierRow>) {
    await this.db.query(
      `INSERT INTO public.tenant_loyalty_tiers (tenant_id, tier, discount_pct, active, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, tier)
       DO UPDATE SET discount_pct = COALESCE($3, tenant_loyalty_tiers.discount_pct),
                     active = COALESCE($4, tenant_loyalty_tiers.active),
                     sort_order = COALESCE($5, tenant_loyalty_tiers.sort_order),
                     updated_at = now()`,
      [tenantId, tier, patch.discount_pct ?? null, patch.active ?? null, patch.sort_order ?? null],
    );
    return this.list(tenantId);
  }

  async getTierRateMap(tenantId: string): Promise<Record<string, number>> {
    const tiers = await this.list(tenantId);
    const out: Record<string, number> = {};
    for (const t of tiers) out[t.tier] = t.active ? Number(t.discount_pct ?? 0) : 0;
    return out;
  }
}
