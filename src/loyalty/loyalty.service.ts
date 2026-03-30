import { Injectable, OnModuleInit } from '@nestjs/common';
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
export class LoyaltyService implements OnModuleInit {
  constructor(private readonly db: DataSource) {}

  async onModuleInit() {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS public.tenant_loyalty_tiers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        tier VARCHAR(32) NOT NULL,
        discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT true,
        sort_order INTEGER NOT NULL DEFAULT 999,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT tenant_loyalty_tiers_tier_chk CHECK (tier IN ('STANDARD','SILVER','GOLD','PLATINUM','VIP')),
        CONSTRAINT tenant_loyalty_tiers_discount_chk CHECK (discount_pct >= 0 AND discount_pct <= 100),
        CONSTRAINT tenant_loyalty_tiers_unique UNIQUE (tenant_id, tier)
      )
    `).catch(() => {});

    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_tenant_loyalty_tiers_tenant ON public.tenant_loyalty_tiers(tenant_id)
    `).catch(() => {});
  }

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
