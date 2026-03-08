import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface DiscountResult {
  discountId: string;
  name: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: number;
  discountMinor: number;          // actual amount off
  finalFareMinor: number;         // fare after discount
  maxDiscountMinor: number | null;
  cappedByMax: boolean;
}

@Injectable()
export class DiscountService {
  private readonly logger = new Logger(DiscountService.name);

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  // ── Admin: list ──────────────────────────────────────────────────────────
  async list(tenantId: string) {
    return this.db.query(
      `SELECT d.*,
              (SELECT COUNT(*) FROM public.tenant_discount_uses u WHERE u.discount_id = d.id)::int AS used_count
       FROM public.tenant_discounts d
       WHERE d.tenant_id = $1
       ORDER BY d.created_at DESC`,
      [tenantId],
    );
  }

  // ── Admin: create ────────────────────────────────────────────────────────
  async create(tenantId: string, body: any) {
    const [row] = await this.db.query(
      `INSERT INTO public.tenant_discounts
         (tenant_id, name, code, description, type, value, max_discount_minor,
          applies_to, service_type_ids, min_fare_minor,
          start_at, end_at, active, max_uses, max_uses_per_customer)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        tenantId,
        body.name,
        body.code ? body.code.toUpperCase().trim() : null,
        body.description ?? null,
        body.type ?? 'PERCENTAGE',
        body.value,
        body.maxDiscountMinor ?? null,
        body.appliesTo ?? 'ALL',
        body.serviceTypeIds ?? null,
        body.minFareMinor ?? 0,
        body.startAt ?? null,
        body.endAt ?? null,
        body.active !== false,
        body.maxUses ?? null,
        body.maxUsesPerCustomer ?? 1,
      ],
    );
    return row;
  }

  // ── Admin: update ────────────────────────────────────────────────────────
  async update(tenantId: string, id: string, body: any) {
    const [row] = await this.db.query(
      `UPDATE public.tenant_discounts SET
         name                 = COALESCE($3, name),
         code                 = CASE WHEN $4::text IS NOT NULL THEN UPPER(TRIM($4)) ELSE code END,
         description          = COALESCE($5, description),
         type                 = COALESCE($6, type),
         value                = COALESCE($7, value),
         max_discount_minor   = COALESCE($8, max_discount_minor),
         applies_to           = COALESCE($9, applies_to),
         service_type_ids     = COALESCE($10, service_type_ids),
         min_fare_minor       = COALESCE($11, min_fare_minor),
         start_at             = COALESCE($12, start_at),
         end_at               = COALESCE($13, end_at),
         active               = COALESCE($14, active),
         max_uses             = $15,
         max_uses_per_customer = $16,
         updated_at           = now()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [
        id, tenantId,
        body.name ?? null,
        body.code ?? null,
        body.description ?? null,
        body.type ?? null,
        body.value ?? null,
        body.maxDiscountMinor ?? null,
        body.appliesTo ?? null,
        body.serviceTypeIds ?? null,
        body.minFareMinor ?? null,
        body.startAt ?? null,
        body.endAt ?? null,
        body.active ?? null,
        body.maxUses ?? null,
        body.maxUsesPerCustomer ?? null,
      ],
    );
    return row;
  }

  // ── Admin: delete ────────────────────────────────────────────────────────
  async remove(tenantId: string, id: string) {
    await this.db.query(
      `DELETE FROM public.tenant_discounts WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
  }

  // ── Core: resolve discount for a booking ─────────────────────────────────
  // Stacking logic:
  //   combined_rate = base_discount_rate + customer.discount_rate
  //   discount_minor = min(fare * combined_rate, max_discount_minor)
  async resolveDiscount(
    tenantId: string,
    baseFareMinor: number,
    opts: {
      code?: string;
      serviceTypeId?: string;
      customerId?: string | null;
      isNewCustomer?: boolean;
    },
  ): Promise<DiscountResult | null> {
    const now = new Date();

    // ── 1. Find base tenant discount ──────────────────────────────────────
    let discount: any = null;

    if (opts.code) {
      const [row] = await this.db.query(
        `SELECT * FROM public.tenant_discounts
         WHERE tenant_id = $1
           AND LOWER(code) = LOWER($2)
           AND active = true
           AND (start_at IS NULL OR start_at <= $3)
           AND (end_at   IS NULL OR end_at   >= $3)
           AND (max_uses IS NULL OR used_count < max_uses)
           AND min_fare_minor <= $4
         LIMIT 1`,
        [tenantId, opts.code, now, baseFareMinor],
      );
      discount = row;
    } else {
      const applies_to_filter = opts.isNewCustomer
        ? `applies_to IN ('ALL', 'NEW_CLIENTS')`
        : `applies_to = 'ALL'`;

      const rows = await this.db.query(
        `SELECT * FROM public.tenant_discounts
         WHERE tenant_id = $1
           AND code IS NULL
           AND active = true
           AND ${applies_to_filter}
           AND (start_at IS NULL OR start_at <= $2)
           AND (end_at   IS NULL OR end_at   >= $2)
           AND (max_uses IS NULL OR used_count < max_uses)
           AND min_fare_minor <= $3
           AND (service_type_ids IS NULL OR $4::uuid = ANY(service_type_ids))
         ORDER BY value DESC
         LIMIT 1`,
        [tenantId, now, baseFareMinor, opts.serviceTypeId ?? null],
      );
      discount = rows[0];
    }

    // ── 2. Fetch customer's personal discount rate ────────────────────────
    let customerDiscountRate = 0;
    if (opts.customerId) {
      const [cust] = await this.db.query(
        `SELECT discount_rate FROM public.customers WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
        [opts.customerId, tenantId],
      );
      customerDiscountRate = Number(cust?.discount_rate ?? 0);
    }

    // No discount at all — nothing to apply
    if (!discount && customerDiscountRate === 0) return null;

    // Service type restriction check
    if (
      discount &&
      opts.serviceTypeId &&
      discount.service_type_ids?.length > 0 &&
      !discount.service_type_ids.includes(opts.serviceTypeId)
    ) {
      discount = null; // base discount doesn't apply
    }

    // Per-customer usage check
    if (discount && opts.customerId && discount.max_uses_per_customer != null) {
      const [usageRow] = await this.db.query(
        `SELECT COUNT(*) AS cnt FROM public.tenant_discount_uses
         WHERE discount_id = $1 AND customer_id = $2`,
        [discount.id, opts.customerId],
      );
      if (parseInt(usageRow?.cnt ?? '0') >= discount.max_uses_per_customer) {
        discount = null;
      }
    }

    // ── 3. Stack rates ────────────────────────────────────────────────────
    // Base rate: only PERCENTAGE discounts stack; FIXED_AMOUNT applied separately
    let baseRatePct    = 0;
    let fixedMinor     = 0;
    // 0 means no cap (unlimited); only apply cap when max_discount_minor > 0
    const maxCap = (discount?.max_discount_minor != null && Number(discount.max_discount_minor) > 0)
      ? Number(discount.max_discount_minor)
      : null;

    if (discount?.type === 'PERCENTAGE') {
      baseRatePct = Number(discount.value);
    } else if (discount?.type === 'FIXED_AMOUNT') {
      fixedMinor = Number(discount.value);
    }

    // Combined percentage (base + customer), then apply cap
    const combinedRatePct   = baseRatePct + customerDiscountRate;
    const fromPct           = Math.round(baseFareMinor * combinedRatePct / 100);
    const rawDiscountMinor  = fromPct + fixedMinor;

    const cappedByMax        = maxCap != null && rawDiscountMinor > maxCap;
    const discountMinor      = cappedByMax ? maxCap : rawDiscountMinor;
    const finalFareMinor     = Math.max(0, baseFareMinor - discountMinor);

    // Build a meaningful name
    const nameParts: string[] = [];
    if (discount)              nameParts.push(discount.name);
    if (customerDiscountRate)  nameParts.push(`+${customerDiscountRate}% loyalty`);
    const name = nameParts.join(' · ') || 'Discount';

    return {
      discountId:       discount?.id ?? 'customer-loyalty',
      name,
      type:             'PERCENTAGE',
      value:            combinedRatePct,
      discountMinor,
      finalFareMinor,
      maxDiscountMinor: maxCap ?? null,
      cappedByMax,
    };
  }

  // ── Record usage (call after booking confirmed) ──────────────────────────
  async recordUsage(
    discountId: string,
    tenantId: string,
    customerId: string | null,
    bookingId: string,
    discountMinor: number,
  ) {
    await this.db.query(
      `INSERT INTO public.tenant_discount_uses
         (discount_id, tenant_id, customer_id, booking_id, discount_minor)
       VALUES ($1,$2,$3,$4,$5)`,
      [discountId, tenantId, customerId, bookingId, discountMinor],
    );
    await this.db.query(
      `UPDATE public.tenant_discounts SET used_count = used_count + 1 WHERE id = $1`,
      [discountId],
    );
  }
}
