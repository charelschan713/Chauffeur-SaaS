# CHATGPT DEEP AUDIT PACKAGE
# Chauffeur Solutions SaaS — 深度代码审计包
_生成时间：2026-03-09 | 提交给 ChatGPT 进行独立审计_

---

## 审计说明

本包包含以下高风险模块的完整源码，供外部独立审计：

1. **主要审计目标**（重点关注）
   - `src/customer-portal/customer-portal.service.ts`：预订创建、支付、Guest Checkout
   - `src/payment/stripe-webhook.controller.ts`：Stripe Webhook 处理与幂等性

2. **依赖文件**（理解上下文必读）
   - `src/pricing/pricing.types.ts`：定价快照类型定义
   - `src/pricing/pricing.resolver.ts`：核心定价引擎
   - `src/customer/discount.resolver.ts`：折扣计算逻辑
   - `src/payment/payment.service.ts`：Stripe 操作与事件发布
   - `src/payment/payment-events.ts`：事件常量定义

---

## 核心审计问题（请优先回答）

**Q1**：`createBooking` 和 `guestCheckout` 中，`total_price_minor` 直接使用 DTO 传入值（或 quoteSession 的 `estimated_total_minor`）写入数据库，未经后端重新计算验证。这是否构成价格篡改漏洞？如何安全修复？

**Q2**：`stripe-webhook.controller.ts` 使用 `on conflict do nothing` 实现幂等性（插入 `stripe_events` 表，若已存在则跳过）。这个模式是否安全？是否存在竞态条件（race condition）？

**Q3**：`StripeWebhookController` 中的 `this.stripe` 使用平台级 `STRIPE_SECRET_KEY`，但 `CustomerPortalService.getStripe()` 支持 per-tenant 密钥。Webhook 处理时只用了平台密钥——这在多租户场景下是否会导致 `tenantId` 解析失败或处理错误租户的事件？

**Q4**：`DiscountResolver.resolve()` 查询时使用了 `AND active = true` 条件，但 `discount-preview` endpoint（controller 中）使用相同的 `customers` 表但没有 `active` 条件。这两套逻辑是否一致？

**Q5**：`guestCheckout` 通过 email 查找或创建客户（`SELECT id WHERE email=$2`），如果恶意用户用他人的 email 地址提交 guest checkout，会发生什么？

**Q6**：`payViaToken` 方法直接使用 `b.total_price_minor`（数据库中存储的值）创建 PaymentIntent。但 `b.total_price_minor` 最初来自前端 DTO。这条链路是否安全？

**Q7**：`guestBaseFare` 计算：`guestPricingSnapshot?.base_calculated_minor ?? (totalMinor - guestTollMinor - guestParkingMinor)`。当 RETURN trip 时 `base_calculated_minor` 为 `undefined`，fallback 是 `totalMinor - toll`。但 `totalMinor` 是 `estimated_total_minor`（折后总价），减去 toll 不等于折前 fare。这是否导致 `prepay_base_fare_minor` 存储了错误的值？有什么实际影响？

**Q8**：`PricingSnapshot.base_calculated_minor` 在 RETURN trip 时故意设为 `undefined`（见 `pricing.resolver.ts` 最后一行）。但多处代码 fallback 链都在读取这个字段。是否应该为 RETURN trip 提供一个语义明确的替代字段？

**Q9**：`onModuleInit` 中执行了 `ALTER TABLE` DDL 操作（自动 migration），以 `catch(() => {})` 静默处理错误。如果这些语句在 PostgreSQL 高并发下（如多实例 Railway 部署）同时执行，是否存在竞态条件或锁问题？

**Q10**：`markBookingPaid` 直接将 `operational_status` 设为 `CONFIRMED`，`payment_status` 设为 `PAID`，没有检查当前状态（无状态机保护）。如果 webhook 重试或并发调用，是否会出现问题？

---

## FILE 1：customer-portal.service.ts
**路径**：`src/customer-portal/customer-portal.service.ts`
**用途**：客户门户核心服务，处理预订创建、支付方法管理、Guest Checkout、Email OTP、Invoice 列表
**审计重点**：
- `createBooking()`：价格来源、pricing snapshot 持久化、支付方法绑定
- `guestCheckout()`：Guest 用户创建/匹配逻辑、`guestBaseFare` 计算、INSERT 参数顺序
- `payViaToken()`、`confirm3ds()`、`markBookingPaid()`：支付状态变更链路
- `getStripe()`：多租户密钥解析策略

```typescript
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import Stripe from 'stripe';
import { NotificationService } from '../notification/notification.service';
import { DebugTraceService } from '../debug/debug-trace.service';

@Injectable()
export class CustomerPortalService implements OnModuleInit {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly notificationService: NotificationService,
    private readonly trace: DebugTraceService,
  ) {}

  async onModuleInit() {
    // Auto-apply email verification migration
    await this.db.query(`
      ALTER TABLE public.customers
        ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS email_otp text,
        ADD COLUMN IF NOT EXISTS email_otp_expires_at timestamptz
    `).catch(() => { /* columns may already exist */ });

    // Auto-apply bookings service reference columns
    await this.db.query(`
      ALTER TABLE public.bookings
        ADD COLUMN IF NOT EXISTS service_class_id uuid,
        ADD COLUMN IF NOT EXISTS service_type_id uuid
    `).catch(() => { /* columns may already exist */ });

    // Normalize dirty phone numbers: strip accidental duplicate country code
    await this.db.query(`
      UPDATE public.customers
      SET phone_number = REGEXP_REPLACE(phone_number, '^\\+?61', '', '')
      WHERE phone_country_code = '+61'
        AND phone_number ~ '^\\+?61[0-9]'
    `).catch(() => {});

    await this.db.query(`
      UPDATE public.customers
      SET phone_number = LTRIM(phone_number, '0')
      WHERE phone_number LIKE '0%'
        AND phone_country_code IS NOT NULL AND phone_country_code != ''
    `).catch(() => {});
  }

  // ── Stripe helper ─────────────────────────────────────────────────────────
  private async getStripe(tenantId: string): Promise<Stripe> {
    // 1. Check tenant_settings.stripe_secret_key (per-tenant override)
    let secretKey: string | undefined;
    try {
      const settingRows = await this.db.query(
        `SELECT stripe_secret_key FROM public.tenant_settings WHERE tenant_id=$1 LIMIT 1`,
        [tenantId],
      );
      secretKey = settingRows[0]?.stripe_secret_key;
    } catch {
      // tenant_settings may not exist — fall through
    }

    // 2. Fall back to platform-level env var
    if (!secretKey) secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) throw new BadRequestException('Stripe not configured for this tenant');
    return new Stripe(secretKey);
  }

  async getStripePublishableKey(tenantId: string): Promise<string> {
    const rows = await this.db.query(
      `SELECT stripe_publishable_key FROM public.tenant_settings WHERE tenant_id=$1 LIMIT 1`,
      [tenantId],
    );
    return rows[0]?.stripe_publishable_key ?? process.env.STRIPE_PUBLISHABLE_KEY ?? '';
  }

  async getStripePublishableKeyBySlug(slug: string): Promise<string> {
    const rows = await this.db.query(
      `SELECT ts.stripe_publishable_key
       FROM public.tenant_settings ts
       JOIN public.tenants t ON t.id = ts.tenant_id
       WHERE t.slug = $1 LIMIT 1`,
      [slug],
    );
    return rows[0]?.stripe_publishable_key ?? process.env.STRIPE_PUBLISHABLE_KEY ?? '';
  }

  async getTenantInfo(slug: string) {
    const rows = await this.db.query(
      `SELECT t.id, t.name, t.slug, t.currency, t.default_timezone,
              t.cancel_window_hours, t.refund_policy,
              tb.logo_url, tb.primary_color, tb.company_name,
              tb.contact_email, tb.contact_phone
       FROM public.tenants t
       LEFT JOIN public.tenant_branding tb ON tb.tenant_id = t.id
       WHERE t.slug=$1 AND t.status='active'`,
      [slug],
    );
    if (!rows.length) throw new NotFoundException('Tenant not found');
    return rows[0];
  }

  async getDashboard(customerId: string, tenantId: string) {
    const [upcomingRows, pastRows, customer] = await Promise.all([
      this.db.query(
        `SELECT id, booking_reference, operational_status as status,
                pickup_at_utc, pickup_address_text as pickup_address,
                dropoff_address_text as dropoff_address,
                total_price_minor, currency, booking_source as booked_by,
                service_class_id, special_requests
         FROM public.bookings
         WHERE customer_id=$1 AND tenant_id=$2
           AND operational_status::text NOT IN ('CANCELLED','COMPLETED','NO_SHOW')
           AND pickup_at_utc > now()
         ORDER BY pickup_at_utc ASC LIMIT 5`,
        [customerId, tenantId],
      ),
      this.db.query(
        `SELECT id, booking_reference, operational_status as status,
                pickup_at_utc, pickup_address_text as pickup_address,
                dropoff_address_text as dropoff_address,
                total_price_minor, currency
         FROM public.bookings
         WHERE customer_id=$1 AND tenant_id=$2
           AND (operational_status IN ('COMPLETED','CANCELLED','NO_SHOW') OR pickup_at_utc <= now())
         ORDER BY pickup_at_utc DESC LIMIT 5`,
        [customerId, tenantId],
      ),
      this.db.query(
        `SELECT first_name, last_name, email, phone_country_code, phone_number,
                tier, discount_rate, custom_discount_type, custom_discount_value
         FROM public.customers WHERE id=$1`,
        [customerId],
      ),
    ]);
    return { customer: customer[0], upcoming: upcomingRows, past: pastRows };
  }

  async listBookings(
    customerId: string,
    tenantId: string,
    query: { status?: string; limit?: number; offset?: number },
  ) {
    const limit = Math.min(Number(query.limit ?? 20), 100);
    const offset = Number(query.offset ?? 0);
    const custRows = await this.db.query(
      `SELECT email FROM public.customers WHERE id=$1 LIMIT 1`, [customerId],
    );
    const custEmail = custRows[0]?.email ?? '';

    const params: any[] = [customerId, tenantId, custEmail];
    let where = `WHERE (b.customer_id=$1 OR (b.customer_id IS NULL AND b.customer_email=$3)) AND b.tenant_id=$2`;
    if (query.status === 'upcoming') {
      where += ` AND b.pickup_at_utc >= NOW()`;
    } else if (query.status === 'past') {
      where += ` AND b.pickup_at_utc < NOW()`;
    } else if (query.status) {
      params.push(query.status.toUpperCase());
      where += ` AND b.operational_status=$${params.length}`;
    }
    const [rows, cnt] = await Promise.all([
      this.db.query(
        `SELECT b.id, b.booking_reference, b.operational_status AS status,
                b.pickup_at_utc, b.pickup_address_text AS pickup_address,
                b.dropoff_address_text AS dropoff_address, b.total_price_minor,
                b.currency, b.payment_status, b.booking_source AS booked_by
         FROM public.bookings b ${where}
         ORDER BY b.pickup_at_utc DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
      this.db.query(
        `SELECT COUNT(*) FROM public.bookings b ${where}`,
        params,
      ),
    ]);
    return { data: rows, total: Number(cnt[0].count) };
  }

  async getBooking(customerId: string, tenantId: string, bookingId: string) {
    let rows = await this.db.query(
      `SELECT b.*
       FROM public.bookings b
       WHERE b.id=$1 AND b.customer_id=$2 AND b.tenant_id=$3`,
      [bookingId, customerId, tenantId],
    );

    if (!rows.length) {
      const customerRows = await this.db.query(
        `SELECT email FROM public.customers WHERE id=$1 LIMIT 1`,
        [customerId],
      );
      const email = customerRows[0]?.email;
      if (email) {
        rows = await this.db.query(
          `SELECT b.*
           FROM public.bookings b
           WHERE b.id=$1 AND b.tenant_id=$2
             AND (
               (b.customer_id IS NULL AND b.customer_email = $3)
               OR b.customer_email = $3
             )`,
          [bookingId, tenantId, email],
        );
        if (rows.length) {
          await this.db.query(
            `UPDATE public.bookings SET customer_id=$1 WHERE id=$2`,
            [customerId, bookingId],
          ).catch(() => {});
        }
      }
    }

    if (!rows.length) throw new NotFoundException('Booking not found');
    return rows[0];
  }

  // ── Create booking (customer self-booking) ────────────────────────────────
  // ⚠️ AUDIT FOCUS: total_price_minor comes from DTO or quoteSession — not re-calculated server-side
  async createBooking(customerId: string, tenantId: string, dto: any) {
    let pickupAddress   = dto.pickupAddress;
    let dropoffAddress  = dto.dropoffAddress;
    let pickupAtUtc     = dto.pickupAtUtc;
    let serviceTypeId   = dto.serviceTypeId ?? null;
    let vehicleClassId  = dto.vehicleClassId ?? dto.quoteId ? null : null;
    let totalPriceMinor = dto.totalPriceMinor ?? 0;
    let currency        = dto.currency ?? 'AUD';
    let passengerCount  = dto.passengerCount ?? 1;
    let flightNumber    = dto.flightNumber ?? null;
    let notes           = dto.notes ?? dto.specialRequests ?? null;
    let quoteSessionId  = null;
    let pricingSnapshot: any = null;

    if (dto.quoteId) {
      const [session] = await this.db.query(
        `SELECT id, payload FROM public.quote_sessions
         WHERE id = $1 AND tenant_id = $2 AND expires_at > now() LIMIT 1`,
        [dto.quoteId, tenantId],
      );
      if (!session) throw new BadRequestException('Quote expired or not found');

      const payload = session.payload;
      const req     = payload.request ?? {};

      pickupAddress   = pickupAddress   ?? req.pickupAddress  ?? req.pickup_address ?? req.pickup_address_text;
      dropoffAddress  = dropoffAddress  ?? req.dropoffAddress ?? req.dropoff_address ?? req.dropoff_address_text;
      pickupAtUtc     = pickupAtUtc     ?? req.pickupAtUtc    ?? req.pickup_at_utc  ?? req.pickup_at;
      serviceTypeId   = serviceTypeId   ?? req.serviceTypeId  ?? req.service_type_id ?? null;
      vehicleClassId  = dto.vehicleClassId ?? null;
      currency        = currency        ?? payload.currency ?? 'AUD';
      passengerCount  = passengerCount  ?? req.passengers     ?? req.passenger_count ?? 1;
      quoteSessionId  = session.id;
      if ((req.trip_mode ?? req.tripMode) === 'RETURN') {
        dto.isReturnTrip = true;
        if (!dto.returnPickupAtUtc && req.return_date) {
          const returnLocal = `${req.return_date}T${req.return_time ?? '00:00'}:00`;
          dto.returnPickupAtUtc = new Date(returnLocal).toISOString();
        }
        dto.returnPickupAtUtc = dto.returnPickupAtUtc ?? req.return_pickup_at_utc ?? null;
        dto.returnPickupAddressText = dto.returnPickupAddressText ?? req.pickup_address ?? pickupAddress;
      }
      if (!dto.waypoints?.length && req.waypoints?.length) {
        dto.waypoints = req.waypoints.filter(Boolean);
      }

      if (payload.results?.length) {
        const result = (dto.vehicleClassId
          ? payload.results.find((r: any) => r.service_class_id === dto.vehicleClassId)
          : null) ?? payload.results[0];
        if (result) {
          // ⚠️ AUDIT: price taken from quoteSession snapshot — no re-calculation
          totalPriceMinor = dto.totalPriceMinor ?? result.estimated_total_minor;
          pricingSnapshot = result.pricing_snapshot_preview ?? null;
        }
      }
    }

    const [tenantRow] = await this.db.query(
      `SELECT booking_ref_prefix FROM public.tenants WHERE id=$1 LIMIT 1`,
      [tenantId],
    );
    const refPrefix = (tenantRow?.booking_ref_prefix ?? 'BK').trim().toUpperCase();
    const ref = `${refPrefix}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

    // ⚠️ AUDIT: base_calculated_minor is undefined for RETURN trips
    const tollMinor    = pricingSnapshot?.toll_minor    ?? 0;
    const parkingMinor = pricingSnapshot?.parking_minor ?? 0;
    const baseFareMinor = pricingSnapshot?.base_calculated_minor ?? (totalPriceMinor - tollMinor - parkingMinor);

    const [customer] = await this.db.query(
      `SELECT first_name, last_name, email, phone_country_code, phone_number
       FROM public.customers WHERE id=$1 LIMIT 1`,
      [customerId],
    );

    const [booking] = await this.db.query(
      `INSERT INTO public.bookings
         (tenant_id, customer_id, booking_reference, booking_source,
          customer_email, customer_first_name, customer_last_name,
          customer_phone_country_code, customer_phone_number,
          passenger_first_name, passenger_last_name,
          passenger_phone_country_code, passenger_phone_number,
          passenger_is_customer,
          pickup_address_text, dropoff_address_text, pickup_at_utc,
          timezone,
          service_type_id, service_class_id,
          total_price_minor, currency,
          prepay_base_fare_minor, prepay_toll_minor, prepay_parking_minor, prepay_total_minor,
          pricing_snapshot,
          operational_status, payment_status,
          flight_number, passenger_count, luggage_count, special_requests,
          waypoints,
          is_return_trip, return_pickup_at_utc, return_pickup_address_text,
          created_at, updated_at)
       VALUES
         ($1, $2, $3, 'WIDGET',
          $4, $5, $6, $7, $8,
          $5, $6, $7, $8, true,
          $9, $10, $11,
          'Australia/Sydney',
          $12, $13,
          $14, $15,
          $16, $17, $18, $24,
          $19,
          'PENDING_CUSTOMER_CONFIRMATION', 'UNPAID',
          $20, $21, $22, $23,
          $25,
          $26, $27, $28,
          now(), now())
       RETURNING *`,
      [
        tenantId, customerId, ref,
        customer?.email, customer?.first_name, customer?.last_name,
        customer?.phone_country_code, customer?.phone_number,
        pickupAddress, dropoffAddress, pickupAtUtc,
        serviceTypeId, vehicleClassId,
        totalPriceMinor, currency,
        baseFareMinor, tollMinor, parkingMinor,
        pricingSnapshot ? JSON.stringify(pricingSnapshot) : null,
        flightNumber,
        passengerCount,
        dto.luggageCount ?? 0,
        notes,
        totalPriceMinor,
        dto.waypoints?.filter(Boolean) ?? [],
        dto.isReturnTrip ? true : false,
        dto.returnPickupAtUtc ?? null,
        dto.returnPickupAddressText ?? null,
      ],
    );

    if (dto.setupIntentId) {
      try {
        const stripe = await this.getStripe(tenantId);
        const si = await stripe.setupIntents.retrieve(dto.setupIntentId);
        if (si.status === 'succeeded' && si.payment_method) {
          const pm = await stripe.paymentMethods.retrieve(si.payment_method as string);
          let stripeCustomerId: string | null = null;
          const scRows = await this.db.query(
            `SELECT stripe_customer_id FROM public.customers WHERE id=$1`, [customerId],
          );
          if (scRows[0]?.stripe_customer_id) {
            stripeCustomerId = scRows[0].stripe_customer_id;
          } else {
            const sc = await stripe.customers.create({ email: customer?.email ?? undefined });
            await this.db.query(`UPDATE public.customers SET stripe_customer_id=$1 WHERE id=$2`, [sc.id, customerId]);
            stripeCustomerId = sc.id;
          }
          await stripe.paymentMethods.attach(pm.id, { customer: stripeCustomerId! }).catch(() => {});
          await this.db.query(
            `INSERT INTO public.saved_payment_methods
               (customer_id, tenant_id, stripe_payment_method_id, last4, brand, exp_month, exp_year, is_default)
             VALUES ($1,$2,$3,$4,$5,$6,$7,
               NOT EXISTS (SELECT 1 FROM public.saved_payment_methods WHERE customer_id=$1 AND tenant_id=$2))
             ON CONFLICT DO NOTHING`,
            [customerId, tenantId, pm.id, pm.card?.last4, pm.card?.brand, pm.card?.exp_month, pm.card?.exp_year],
          );
        }
      } catch (_e) { /* non-fatal */ }
    }

    if (quoteSessionId) {
      await this.db.query(
        `UPDATE public.quote_sessions SET converted_at = now() WHERE id = $1`,
        [quoteSessionId],
      ).catch(() => {});
    }

    await this.db.query(
      `INSERT INTO public.booking_status_history
         (id, tenant_id, booking_id, previous_status, new_status, triggered_by, reason, created_at)
       VALUES (gen_random_uuid(),$1,$2,NULL,'PENDING_CUSTOMER_CONFIRMATION','CUSTOMER',NULL,now())`,
      [tenantId, booking.id],
    ).catch(() => {});

    const notifPayload = { tenant_id: tenantId, booking_id: booking.id };
    this.notificationService.handleEvent('CustomerCreatedBookingReceived', notifPayload)
      .catch((e) => console.error(`[Notification] CustomerCreatedBookingReceived FAILED:`, e?.message ?? e));
    setTimeout(() => {
      this.notificationService.handleEvent('AdminNewBooking', notifPayload)
        .catch((e) => console.error(`[Notification] AdminNewBooking FAILED:`, e?.message ?? e));
    }, 1500);

    return booking;
  }

  async cancelBooking(customerId: string, tenantId: string, bookingId: string) {
    const rows = await this.db.query(
      `SELECT id, operational_status, pickup_at_utc FROM public.bookings
       WHERE id=$1 AND customer_id=$2 AND tenant_id=$3`,
      [bookingId, customerId, tenantId],
    );
    if (!rows.length) throw new NotFoundException('Booking not found');
    const b = rows[0];
    const cancelable = ['PENDING_CUSTOMER_CONFIRMATION', 'PENDING', 'CONFIRMED', 'AWAITING_CONFIRMATION'];
    if (!cancelable.includes(b.operational_status)) {
      throw new BadRequestException('Booking cannot be cancelled in its current state');
    }

    const tenant = await this.db.query(
      `SELECT cancel_window_hours FROM public.tenants WHERE id=$1`,
      [tenantId],
    );
    const windowHours = tenant[0]?.cancel_window_hours ?? 2;
    const pickupTime = new Date(b.pickup_at_utc).getTime();
    const now = Date.now();
    if (pickupTime - now < windowHours * 3600 * 1000) {
      throw new BadRequestException(`Cannot cancel within ${windowHours}h of pickup`);
    }

    await this.db.query(
      `UPDATE public.bookings SET operational_status='CANCELLED', updated_at=now() WHERE id=$1`,
      [bookingId],
    );
    this.notificationService.handleEvent('BookingCancelled', { tenant_id: tenantId, booking_id: bookingId, cancelled_by: 'customer' })
      .catch((e) => console.error('[Notification] BookingCancelled FAILED:', e?.message ?? e));
    return { success: true };
  }

  async getProfile(customerId: string, tenantId?: string) {
    const rows = await this.db.query(
      `SELECT id, first_name, last_name, email, phone_country_code, phone_number, created_at,
              tier, discount_rate, custom_discount_type, custom_discount_value
       FROM public.customers
       WHERE id=$1 ${tenantId ? 'AND tenant_id=$2' : ''}`,
      tenantId ? [customerId, tenantId] : [customerId],
    );
    if (!rows.length) throw new NotFoundException('Customer not found');
    return rows[0];
  }

  async updateProfile(customerId: string, tenantId: string, dto: any) {
    await this.db.query(
      `UPDATE public.customers
       SET first_name=COALESCE($1, first_name),
           last_name=COALESCE($2, last_name),
           phone_number=COALESCE($3, phone_number),
           updated_at=now()
       WHERE id=$4 AND tenant_id=$5`,
      [dto.firstName ?? null, dto.lastName ?? null, dto.phone ?? null, customerId, tenantId],
    );
    return this.getProfile(customerId, tenantId);
  }

  async listPassengers(customerId: string) {
    return this.db.query(
      `SELECT id, first_name, last_name, email,
              phone_country_code, phone_number,
              relationship, is_default, preferences
       FROM public.customer_passengers
       WHERE customer_id=$1 AND active = true
       ORDER BY is_default DESC, created_at ASC`,
      [customerId],
    );
  }

  async addPassenger(customerId: string, tenantId: string, dto: any) {
    if (dto.is_default) {
      await this.db.query(
        `UPDATE public.customer_passengers SET is_default = false
         WHERE customer_id = $1 AND tenant_id = $2`,
        [customerId, tenantId],
      );
    }
    const [p] = await this.db.query(
      `INSERT INTO public.customer_passengers
         (customer_id, tenant_id, first_name, last_name, email,
          phone_country_code, phone_number, relationship, is_default, preferences, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
       RETURNING *`,
      [
        customerId, tenantId,
        dto.first_name, dto.last_name, dto.email ?? null,
        dto.phone_country_code ?? null, dto.phone_number ?? null,
        dto.relationship ?? 'Other', dto.is_default ?? false,
        dto.preferences != null ? JSON.stringify(dto.preferences) : null,
      ],
    );
    return p;
  }

  async listPaymentMethods(customerId: string, tenantId: string) {
    return this.db.query(
      `SELECT id, brand, last4, exp_month, exp_year, is_default
       FROM public.saved_payment_methods
       WHERE customer_id=$1 AND tenant_id=$2
       ORDER BY is_default DESC, created_at DESC`,
      [customerId, tenantId],
    );
  }

  async createGuestSetupIntent(tenantSlug: string) {
    const tenant = await this.getTenantInfo(tenantSlug);
    const stripe = await this.getStripe(tenant.id);
    const si = await stripe.setupIntents.create({
      payment_method_types: ['card'],
      usage: 'off_session',
      payment_method_options: {
        card: { request_three_d_secure: 'automatic' },
      },
    });
    return { clientSecret: si.client_secret };
  }

  async createSetupIntent(customerId: string, tenantId: string) {
    const stripe = await this.getStripe(tenantId);
    let stripeCustomerId = await this.getStripeCustomerId(customerId);
    if (!stripeCustomerId) {
      const cust = await this.db.query(
        `SELECT email, first_name, last_name FROM public.customers WHERE id=$1`,
        [customerId],
      );
      const sc = await stripe.customers.create({
        email: cust[0]?.email,
        name: `${cust[0]?.first_name} ${cust[0]?.last_name}`.trim(),
        metadata: { customerId, tenantId },
      });
      await this.db.query(
        `UPDATE public.customers SET stripe_customer_id=$1 WHERE id=$2`,
        [sc.id, customerId],
      );
      stripeCustomerId = sc.id;
    }

    const si = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      usage: 'off_session',
      payment_method_types: ['card'],
    });

    return { clientSecret: si.client_secret, setupIntentId: si.id };
  }

  async confirmSetup(customerId: string, tenantId: string, dto: { setupIntentId: string; bookingId?: string }) {
    const stripe = await this.getStripe(tenantId);
    const si = await stripe.setupIntents.retrieve(dto.setupIntentId);

    if (si.status !== 'succeeded') {
      throw new BadRequestException(`SetupIntent not succeeded: ${si.status}`);
    }

    const pmId = si.payment_method as string;
    if (!pmId) throw new BadRequestException('No payment method on SetupIntent');

    const pm = await stripe.paymentMethods.retrieve(pmId);

    const [saved] = await this.db.query(
      `INSERT INTO public.saved_payment_methods
         (customer_id, tenant_id, stripe_payment_method_id, last4, brand, exp_month, exp_year, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7,
         NOT EXISTS (SELECT 1 FROM public.saved_payment_methods WHERE customer_id=$1 AND tenant_id=$2))
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [customerId, tenantId, pmId, pm.card?.last4, pm.card?.brand, pm.card?.exp_month, pm.card?.exp_year],
    );

    if (dto.bookingId) {
      await this.db.query(
        `UPDATE public.bookings
         SET operational_status = 'PENDING_CUSTOMER_CONFIRMATION', updated_at = now()
         WHERE id=$1 AND customer_id=$2 AND tenant_id=$3`,
        [dto.bookingId, customerId, tenantId],
      ).catch(() => {});
    }

    return { success: true, paymentMethod: saved };
  }

  async deletePaymentMethod(customerId: string, tenantId: string, pmId: string) {
    const rows = await this.db.query(
      `SELECT stripe_payment_method_id FROM public.saved_payment_methods
       WHERE id=$1 AND customer_id=$2 AND tenant_id=$3`,
      [pmId, customerId, tenantId],
    );
    if (!rows.length) throw new NotFoundException('Payment method not found');

    try {
      const stripe = await this.getStripe(tenantId);
      await stripe.paymentMethods.detach(rows[0].stripe_payment_method_id);
    } catch { /* Best effort */ }

    await this.db.query(`DELETE FROM public.saved_payment_methods WHERE id=$1`, [pmId]);
    return { success: true };
  }

  async getPaymentToken(token: string) {
    const rows = await this.db.query(
      `SELECT b.id, b.tenant_id, b.customer_id, b.booking_reference,
              b.total_price_minor, b.currency,
              b.customer_first_name, b.operational_status, b.payment_status,
              b.pickup_address_text AS pickup_address,
              b.dropoff_address_text AS dropoff_address,
              b.pickup_at_utc, b.timezone,
              b.passenger_count, b.luggage_count,
              b.prepay_base_fare_minor, b.prepay_toll_minor, b.prepay_parking_minor,
              b.discount_total_minor,
              b.is_return_trip, b.return_pickup_at_utc,
              to_char(b.return_pickup_at_utc AT TIME ZONE COALESCE(b.timezone,'Australia/Sydney'),
                      'Dy DD Mon YYYY HH12:MI AM') AS return_time_local,
              sc.name AS car_type_name,
              to_char(b.pickup_at_utc AT TIME ZONE COALESCE(b.timezone,'Australia/Sydney'),
                      'Dy DD Mon YYYY HH12:MI AM') AS pickup_time_local
       FROM public.bookings b
       LEFT JOIN public.tenant_service_classes sc ON sc.id = b.service_class_id
       WHERE b.payment_token=$1 AND b.payment_token_expires_at > NOW()`,
      [token],
    );
    if (!rows.length) throw new NotFoundException('Payment link not found or expired');
    const b = rows[0];

    let savedCard: any = null;
    if (b.customer_id) {
      const cards = await this.db.query(
        `SELECT id, last4, brand, exp_month, exp_year, stripe_payment_method_id
         FROM public.saved_payment_methods
         WHERE customer_id=$1 AND tenant_id=$2
         ORDER BY is_default DESC, created_at DESC LIMIT 1`,
        [b.customer_id, b.tenant_id],
      );
      if (cards.length) savedCard = cards[0];
    }

    return { ...b, saved_card: savedCard };
  }

  // ⚠️ AUDIT: amount = b.total_price_minor (originally from frontend DTO at booking creation)
  async payViaToken(token: string, dto: { paymentMethodId: string }) {
    const rows = await this.db.query(
      `SELECT b.id, b.tenant_id, b.customer_id, b.total_price_minor, b.currency, b.payment_status, b.booking_reference
       FROM public.bookings b WHERE b.payment_token=$1 AND b.payment_token_expires_at > NOW()`,
      [token],
    );
    if (!rows.length) throw new NotFoundException('Payment link not found');
    const b = rows[0];
    if (b.payment_status === 'PAID') throw new BadRequestException('Already paid');

    const stripe = await this.getStripe(b.tenant_id);
    const appUrl = process.env.CUSTOMER_APP_URL ?? 'https://aschauffeured.chauffeurssolution.com';

    let stripeCustomerId: string | undefined;
    if (b.customer_id) {
      const custRows = await this.db.query(
        `SELECT stripe_customer_id FROM public.customers WHERE id=$1`,
        [b.customer_id],
      );
      stripeCustomerId = custRows[0]?.stripe_customer_id ?? undefined;
    }

    const pi = await stripe.paymentIntents.create({
      amount: Number(b.total_price_minor),
      currency: b.currency.toLowerCase(),
      payment_method: dto.paymentMethodId,
      ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
      confirm: true,
      return_url: `${appUrl}/pay/${token}?3ds=true`,
      payment_method_options: {
        card: { request_three_d_secure: 'automatic' },
      },
    });

    if (pi.status === 'succeeded') {
      await this.markBookingPaid(b.id, pi.id);
    }

    return {
      success: pi.status === 'succeeded',
      status: pi.status,
      clientSecret: pi.client_secret,
      paymentIntentId: pi.id,
    };
  }

  async confirm3ds(token: string, dto: { paymentIntentId: string }) {
    const rows = await this.db.query(
      `SELECT b.id, b.tenant_id, b.payment_status
       FROM public.bookings b WHERE b.payment_token=$1`,
      [token],
    );
    if (!rows.length) throw new NotFoundException('Booking not found');
    const b = rows[0];
    if (b.payment_status === 'PAID') return { success: true };

    const stripe = await this.getStripe(b.tenant_id);
    const pi = await stripe.paymentIntents.retrieve(dto.paymentIntentId);
    if (pi.status !== 'succeeded') throw new BadRequestException(`Payment not completed: ${pi.status}`);

    await this.markBookingPaid(b.id, pi.id);
    return { success: true };
  }

  // ⚠️ AUDIT: no state guard — can be called multiple times
  private async markBookingPaid(bookingId: string, paymentIntentId: string) {
    const rows = await this.db.query(
      `UPDATE public.bookings
       SET operational_status='CONFIRMED', payment_status='PAID',
           stripe_payment_intent_id=$1, payment_captured_at=now(), updated_at=now()
       WHERE id=$2
       RETURNING tenant_id`,
      [paymentIntentId, bookingId],
    );
    const tenantId = rows[0]?.tenant_id;
    if (tenantId) {
      const notifPayload = { tenant_id: tenantId, booking_id: bookingId };
      this.notificationService.handleEvent('BookingConfirmed', notifPayload)
        .catch((e) => console.error('[Notification] BookingConfirmed (pay link) FAILED:', e?.message));
      setTimeout(() => {
        this.notificationService.handleEvent('AdminBookingConfirmedPaid', notifPayload)
          .catch((e) => console.error('[Notification] AdminBookingConfirmedPaid FAILED:', e?.message));
      }, 2000);
    }
  }

  async listInvoices(customerId: string, tenantId: string) {
    return this.db.query(
      `SELECT id, invoice_number, status, total_minor, currency,
              issue_date AS issued_at, due_date, paid_at
       FROM public.invoices
       WHERE customer_id=$1 AND tenant_id=$2
       ORDER BY issue_date DESC NULLS LAST`,
      [customerId, tenantId],
    );
  }

  // ── Guest checkout ────────────────────────────────────────────────────────
  // ⚠️ AUDIT: guestBaseFare fallback, email-based customer match, price source
  async guestCheckout(tenantSlug: string, dto: any) {
    const tenant = await this.db.query(
      `SELECT id, booking_ref_prefix FROM public.tenants WHERE slug=$1 LIMIT 1`,
      [tenantSlug],
    );
    if (!tenant.length) throw new NotFoundException('Tenant not found');
    const tenantId = tenant[0].id;
    const refPrefix = (tenant[0].booking_ref_prefix ?? 'BK').trim().toUpperCase();

    let pickupAddress  = dto.pickupAddress;
    let dropoffAddress = dto.dropoffAddress;
    let pickupAtUtc    = dto.pickupAtUtc;
    let serviceTypeId  = dto.serviceTypeId ?? null;
    let serviceClassId = dto.vehicleClassId ?? dto.carTypeId ?? null;
    let totalMinor     = dto.totalPriceMinor ?? 0;
    let currency       = dto.currency ?? 'AUD';
    let passengerCount = dto.passengerCount ?? 1;
    let quoteSessionId: string | null = null;
    let guestPricingSnapshot: any = null;

    if (dto.quoteId) {
      const [session] = await this.db.query(
        `SELECT id, payload FROM public.quote_sessions
         WHERE id = $1 AND tenant_id = $2 AND expires_at > now() LIMIT 1`,
        [dto.quoteId, tenantId],
      );
      if (session) {
        const req = session.payload?.request ?? {};
        pickupAddress  = pickupAddress  ?? req.pickupAddress  ?? req.pickup_address ?? req.pickup_address_text;
        dropoffAddress = dropoffAddress ?? req.dropoffAddress ?? req.dropoff_address ?? req.dropoff_address_text;
        pickupAtUtc    = pickupAtUtc    ?? req.pickupAtUtc    ?? req.pickup_at_utc  ?? req.pickup_at;
        serviceTypeId  = serviceTypeId  ?? req.serviceTypeId  ?? req.service_type_id ?? null;
        passengerCount = passengerCount ?? req.passengers     ?? req.passenger_count ?? 1;
        currency       = currency       ?? session.payload?.currency ?? 'AUD';
        quoteSessionId = session.id;

        const resolvedClassId = dto.vehicleClassId ?? dto.carTypeId;
        if (session.payload?.results?.length) {
          const result = (resolvedClassId
            ? session.payload.results.find((r: any) => r.service_class_id === resolvedClassId)
            : null) ?? session.payload.results[0];
          if (result) {
            totalMinor = dto.totalPriceMinor ?? result.estimated_total_minor ?? totalMinor;
            guestPricingSnapshot = result.pricing_snapshot_preview ?? null;
          }
        }
      }
    }

    // ⚠️ AUDIT: base_calculated_minor is undefined for RETURN trips
    // Fallback: totalMinor (estimated_total_minor = already discounted) - toll ≠ pre_discount_fare_minor
    const guestTollMinor    = guestPricingSnapshot?.toll_minor    ?? 0;
    const guestParkingMinor = guestPricingSnapshot?.parking_minor ?? 0;
    const guestBaseFare     = guestPricingSnapshot?.base_calculated_minor ?? (totalMinor - guestTollMinor - guestParkingMinor);

    const email = dto.email?.toLowerCase?.() ?? null;

    const rawPhone: string = dto.phone ?? '';
    const phoneMatch = rawPhone.match(/^(\+\d{1,3})(.*)/);
    const phoneCode   = phoneMatch ? phoneMatch[1] : null;
    const phoneNumber = phoneMatch ? phoneMatch[2].trim() : (rawPhone || null);

    // ⚠️ AUDIT: email-only lookup — no tenant isolation check on email uniqueness guarantee
    let customerId: string;
    const existing = await this.db.query(
      `SELECT id FROM public.customers WHERE tenant_id=$1 AND email=$2 LIMIT 1`,
      [tenantId, email],
    );
    if (existing.length) {
      customerId = existing[0].id;
    } else {
      const [c] = await this.db.query(
        `INSERT INTO public.customers
           (tenant_id, email, first_name, last_name,
            phone_country_code, phone_number,
            is_guest, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,true,now(),now()) RETURNING id`,
        [tenantId, email, dto.firstName, dto.lastName, phoneCode, phoneNumber],
      );
      customerId = c.id;
    }

    if (dto.setupIntentId) {
      try {
        const stripe = await this.getStripe(tenantId);
        const si = await stripe.setupIntents.retrieve(dto.setupIntentId);
        if (si.status === 'succeeded' && si.payment_method) {
          const pm = await stripe.paymentMethods.retrieve(si.payment_method as string);
          let stripeCustomerId: string | null = null;
          const scRows = await this.db.query(
            `SELECT stripe_customer_id FROM public.customers WHERE id=$1`, [customerId],
          );
          if (scRows[0]?.stripe_customer_id) {
            stripeCustomerId = scRows[0].stripe_customer_id;
          } else {
            const sc = await stripe.customers.create({ email: email ?? undefined, name: `${dto.firstName} ${dto.lastName}` });
            await this.db.query(`UPDATE public.customers SET stripe_customer_id=$1 WHERE id=$2`, [sc.id, customerId]);
            stripeCustomerId = sc.id;
          }
          await stripe.paymentMethods.attach(pm.id, { customer: stripeCustomerId! }).catch(() => {});
          await this.db.query(
            `INSERT INTO public.saved_payment_methods
               (customer_id, tenant_id, stripe_payment_method_id, last4, brand, exp_month, exp_year, is_default)
             VALUES ($1,$2,$3,$4,$5,$6,$7,
               NOT EXISTS (SELECT 1 FROM public.saved_payment_methods WHERE customer_id=$1 AND tenant_id=$2))
             ON CONFLICT DO NOTHING`,
            [customerId, tenantId, pm.id, pm.card?.last4, pm.card?.brand, pm.card?.exp_month, pm.card?.exp_year],
          );
        }
      } catch (_e) { /* non-fatal */ }
    }

    const ref = `${refPrefix}-${Math.random().toString(36).slice(2,10).toUpperCase()}`;

    let bookingRows: any[];
    try {
      bookingRows = await this.db.query(
        `INSERT INTO public.bookings
           (id, tenant_id, customer_id,
            booking_reference, booking_source,
            customer_email, customer_first_name, customer_last_name,
            customer_phone_country_code, customer_phone_number,
            passenger_first_name, passenger_last_name,
            passenger_phone_country_code, passenger_phone_number,
            passenger_is_customer,
            pickup_address_text, dropoff_address_text,
            pickup_at_utc, timezone,
            service_type_id, service_class_id,
            total_price_minor, currency,
            prepay_base_fare_minor, prepay_toll_minor, prepay_parking_minor, prepay_total_minor,
            pricing_snapshot,
            operational_status, payment_status,
            passenger_count, luggage_count,
            flight_number, special_requests,
            infant_seats, toddler_seats, booster_seats,
            waypoints,
            created_at, updated_at)
         VALUES
           (gen_random_uuid(), $1, $2,
            $3, 'WIDGET',
            $4, $5, $6,
            $7, $8,
            $5, $6,
            $7, $8,
            true,
            $9, $10,
            $11, 'Australia/Sydney',
            $12, $13,
            $14, $15,
            $16, $17, $18, $27,
            $19,
            'PENDING_CUSTOMER_CONFIRMATION', 'UNPAID',
            $20, $21,
            $22, $23,
            $24, $25, $26,
            $28,
            now(), now())
         RETURNING *`,
        [
          tenantId, customerId,
          ref,
          email, dto.firstName, dto.lastName,
          phoneCode, phoneNumber,
          pickupAddress, dropoffAddress,
          pickupAtUtc,
          serviceTypeId, serviceClassId,
          totalMinor, currency,
          guestBaseFare, guestTollMinor, guestParkingMinor,
          guestPricingSnapshot ? JSON.stringify(guestPricingSnapshot) : null,
          passengerCount, dto.luggageCount ?? 0,
          dto.flightNumber ?? null, dto.notes ?? null,
          dto.infantSeats ?? 0, dto.toddlerSeats ?? 0, dto.boosterSeats ?? 0,
          totalMinor,
          dto.waypoints?.filter(Boolean) ?? [],
        ],
      );
    } catch (err: any) {
      throw new Error(`Guest booking INSERT failed: ${err?.message ?? String(err)}`);
    }

    const booking = bookingRows[0];

    await this.db.query(
      `INSERT INTO public.booking_status_history
         (id, tenant_id, booking_id, previous_status, new_status, triggered_by, reason, created_at)
       VALUES (gen_random_uuid(),$1,$2,NULL,'PENDING_CUSTOMER_CONFIRMATION',NULL,NULL,now())`,
      [tenantId, booking.id],
    ).catch(() => {});

    if (quoteSessionId) {
      await this.db.query(`UPDATE public.quote_sessions SET converted_at=now() WHERE id=$1`, [quoteSessionId]).catch(() => {});
    }

    const notifPayload = { tenant_id: tenantId, booking_id: booking.id };
    this.notificationService.handleEvent('CustomerCreatedBookingReceived', notifPayload)
      .catch((e) => console.error(`[Notification] CustomerCreatedBookingReceived FAILED:`, e?.message ?? e));
    setTimeout(() => {
      this.notificationService.handleEvent('AdminNewBooking', notifPayload)
        .catch((e) => console.error(`[Notification] AdminNewBooking FAILED:`, e?.message ?? e));
    }, 1500);

    return { booking, customerId };
  }

  async confirmBooking(customerId: string, tenantId: string, bookingId: string) {
    await this.db.query(
      `UPDATE public.bookings
       SET operational_status = 'CONFIRMED', updated_at = now()
       WHERE id = $1 AND tenant_id = $2
         AND operational_status = 'PENDING_CUSTOMER_CONFIRMATION'`,
      [bookingId, tenantId],
    );
    return { confirmed: true };
  }

  async savePushToken(customerId: string, tenantId: string, token: string) {
    await this.db.query(
      `UPDATE public.customers SET expo_push_token = $1, updated_at = now()
       WHERE id = $2 AND tenant_id = $3`,
      [token, customerId, tenantId],
    );
    return { saved: true };
  }

  async sendEmailOtp(customerId: string, tenantId: string): Promise<{ sent: boolean }> {
    const rows = await this.db.query(
      `SELECT id, email, first_name FROM public.customers WHERE id = $1 AND tenant_id = $2`,
      [customerId, tenantId],
    );
    if (!rows.length) throw new Error('Customer not found');
    const customer = rows[0];

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.db.query(
      `UPDATE public.customers SET email_otp = $1, email_otp_expires_at = $2 WHERE id = $3`,
      [otp, expiresAt.toISOString(), customerId],
    );

    await this.notificationService.handleEvent('CustomerEmailVerification', {
      customer_id: customerId,
      tenant_id: tenantId,
      otp,
      first_name: customer.first_name,
      email: customer.email,
    }).catch(() => {});

    return { sent: true };
  }

  async verifyEmailOtp(customerId: string, tenantId: string, otp: string): Promise<{ verified: boolean }> {
    const rows = await this.db.query(
      `SELECT id, email_otp, email_otp_expires_at FROM public.customers
       WHERE id = $1 AND tenant_id = $2`,
      [customerId, tenantId],
    );
    if (!rows.length) throw new Error('Customer not found');
    const c = rows[0];

    if (!c.email_otp || c.email_otp !== otp.trim()) {
      throw new Error('Invalid verification code');
    }
    if (c.email_otp_expires_at && new Date(c.email_otp_expires_at) < new Date()) {
      throw new Error('Verification code has expired. Please request a new one.');
    }

    await this.db.query(
      `UPDATE public.customers
       SET email_verified = true, email_otp = null, email_otp_expires_at = null, updated_at = now()
       WHERE id = $1`,
      [customerId],
    );

    return { verified: true };
  }

  async getVerificationStatus(customerId: string, tenantId: string): Promise<{ email_verified: boolean }> {
    const rows = await this.db.query(
      `SELECT email_verified FROM public.customers WHERE id = $1 AND tenant_id = $2`,
      [customerId, tenantId],
    );
    return { email_verified: rows[0]?.email_verified ?? false };
  }

  private async getStripeCustomerId(customerId: string): Promise<string | null> {
    const rows = await this.db.query(
      `SELECT stripe_customer_id FROM public.customers WHERE id=$1`,
      [customerId],
    );
    return rows[0]?.stripe_customer_id ?? null;
  }
}
```

---

## FILE 2：stripe-webhook.controller.ts
**路径**：`src/payment/stripe-webhook.controller.ts`
**用途**：Stripe Webhook 处理，包含幂等性保护（`on conflict do nothing`）、事件路由、支付状态更新
**审计重点**：
- `on conflict do nothing` 幂等保护是否足够
- 使用平台级 `STRIPE_SECRET_KEY` 而非 per-tenant 密钥
- `tenantId` 从 `metadata.tenant_id` 提取——若缺失则抛出 400
- 事务内的 `handleEvent` 调用是否安全

```typescript
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import Stripe from 'stripe';
import { Request, Response } from 'express';
import { DataSource, EntityManager } from 'typeorm';
import { PAYMENT_EVENTS } from './payment-events';

@Controller('webhooks')
export class StripeWebhookController {
  private readonly stripe: Stripe;

  constructor(
    private readonly paymentService: PaymentService,
    private readonly dataSource: DataSource,
  ) {
    // ⚠️ AUDIT: uses PLATFORM-level STRIPE_SECRET_KEY, not per-tenant
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }

  @Post('stripe')
  @HttpCode(200)
  async handleWebhook(@Req() req: Request, @Res() res: Response, @Body() body: any) {
    const rawBody: Buffer = (req as any).rawBody ?? Buffer.from(JSON.stringify(body));
    const signature = req.headers['stripe-signature'];
    if (!signature) throw new BadRequestException('Missing Stripe signature');

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new BadRequestException(`Invalid signature: ${message}`);
    }

    const dataObject: any = event.data.object;
    const tenantId = dataObject?.metadata?.tenant_id;
    // ⚠️ AUDIT: if Stripe event has no tenant_id in metadata (e.g. events not created by this system), throws 400
    if (!tenantId) throw new BadRequestException('Missing tenant metadata');

    await this.dataSource.transaction(async (manager: EntityManager) => {
      await manager.query(`select set_config('app.tenant_id', $1, true)`, [tenantId]);

      // ✅ Idempotency guard: insert stripe_event, skip if already processed (on conflict do nothing)
      // ⚠️ AUDIT: is this race-condition-safe? What if two concurrent requests insert simultaneously?
      const inserted = await manager.query(
        `insert into public.stripe_events (
          tenant_id, stripe_event_id, event_type, payload_snapshot
        ) values ($1,$2,$3,$4)
        on conflict (tenant_id, stripe_event_id) do nothing
        returning id`,
        [tenantId, event.id, event.type, event],
      );

      // If nothing was inserted = duplicate event — skip processing
      if (!inserted.length) {
        return;
      }

      await this.handleEvent(event, tenantId, manager);
    });

    return res.sendStatus(200);
  }

  private async handleEvent(event: Stripe.Event, tenantId: string, manager: EntityManager) {
    switch (event.type) {
      case 'payment_intent.amount_capturable_updated':
        await this.handleAuthorized(event, tenantId, manager);
        break;
      case 'charge.captured':
        await this.handleCaptured(event, tenantId, manager);
        break;
      case 'charge.refunded':
        await this.handleRefunded(event, tenantId, manager);
        break;
      case 'payment_intent.payment_failed':
        await this.handleFailed(event, tenantId, manager);
        break;
      default:
        break;
    }
  }

  private async handleAuthorized(event: Stripe.Event, tenantId: string, manager: EntityManager) {
    const intent = event.data.object as Stripe.PaymentIntent;
    // ⚠️ AUDIT: updates public.payments table — not public.bookings directly
    await manager.query(
      `update public.payments
       set payment_status = 'AUTHORIZED',
           amount_authorized_minor = $1
       where stripe_payment_intent_id = $2`,
      [intent.amount_capturable ?? intent.amount ?? 0, intent.id],
    );

    await this.paymentService.recordOutboxEvent(manager, tenantId, intent.id, PAYMENT_EVENTS.PAYMENT_AUTHORIZED, {
      tenant_id: tenantId,
      payment_intent_id: intent.id,
      amount_authorized_minor: intent.amount_capturable ?? intent.amount ?? 0,
      currency: intent.currency,
    });
  }

  private async handleCaptured(event: Stripe.Event, tenantId: string, manager: EntityManager) {
    const charge = event.data.object as Stripe.Charge;
    await manager.query(
      `update public.payments
       set payment_status = 'PAID',
           amount_captured_minor = $1
       where stripe_payment_intent_id = $2`,
      [charge.amount_captured ?? charge.amount, charge.payment_intent],
    );

    await this.paymentService.recordOutboxEvent(manager, tenantId, charge.payment_intent as string, PAYMENT_EVENTS.PAYMENT_CAPTURED, {
      tenant_id: tenantId,
      payment_intent_id: charge.payment_intent,
      amount_captured_minor: charge.amount_captured ?? charge.amount,
      currency: charge.currency,
    });
  }

  private async handleRefunded(event: Stripe.Event, tenantId: string, manager: EntityManager) {
    const charge = event.data.object as Stripe.Charge;
    const refunded = charge.amount_refunded ?? 0;
    const status = refunded >= (charge.amount_captured ?? charge.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

    await manager.query(
      `update public.payments
       set amount_refunded_minor = $1, payment_status = $2
       where stripe_payment_intent_id = $3`,
      [refunded, status, charge.payment_intent],
    );

    await this.paymentService.recordOutboxEvent(manager, tenantId, charge.payment_intent as string, PAYMENT_EVENTS.PAYMENT_REFUNDED, {
      tenant_id: tenantId,
      payment_intent_id: charge.payment_intent,
      amount_refunded_minor: refunded,
      status,
    });
  }

  private async handleFailed(event: Stripe.Event, tenantId: string, manager: EntityManager) {
    const intent = event.data.object as Stripe.PaymentIntent;
    await manager.query(
      `update public.payments
       set payment_status = 'FAILED'
       where stripe_payment_intent_id = $1`,
      [intent.id],
    );

    await this.paymentService.recordOutboxEvent(manager, tenantId, intent.id, PAYMENT_EVENTS.PAYMENT_FAILED, {
      tenant_id: tenantId,
      payment_intent_id: intent.id,
    });
  }
}
```

---

## FILE 3：pricing.types.ts
**路径**：`src/pricing/pricing.types.ts`
**用途**：定义 `PricingContext`（定价输入）和 `PricingSnapshot`（定价输出/快照）数据结构
**审计重点**：`base_calculated_minor` 在 RETURN trip 为 `undefined`（设计决定）；多字段语义重叠

```typescript
export interface PricingContext {
  tenantId: string;
  serviceClassId: string;
  distanceKm: number;
  tollEnabled?: boolean;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  durationMinutes: number;
  pickupZoneName?: string;
  dropoffZoneName?: string;
  waypointsCount: number;
  returnWaypointsCount?: number;
  babyseatCount: number;
  infantSeats?: number;
  toddlerSeats?: number;
  boosterSeats?: number;
  requestedAtUtc: Date;
  pickupAtUtc?: Date | string | null;
  timezone?: string | null;
  currency: string;
  customerId?: string | null;
  serviceTypeId?: string | null;
  tripType?: 'ONE_WAY' | 'RETURN';
  returnDistanceKm?: number;
  returnDurationMinutes?: number;
  bookedHours?: number;
}

export interface PricingItemBreakdown {
  type: string;
  unit: string;
  quantity: number;
  unitAmountMinor: number;
  subtotalMinor: number;
}

export interface PricingSnapshot {
  snapshotVersion: 1;
  calculatedAt: string;
  pricingMode: 'ZONE' | 'ITEMIZED';
  resolvedZoneId: string | null;
  resolvedItemsCount: number;
  serviceClass: { id: string; name: string };
  items: PricingItemBreakdown[];
  surgeMultiplier: number;
  subtotalMinor: number;
  totalPriceMinor: number;        // = grand_total_minor (alias)
  currency: string;
  pre_discount_fare_minor?: number;  // fare before discount (includes waypoints+seats, NO toll)
  discount_type?: 'NONE' | 'TIER' | 'CUSTOM_PERCENT' | 'CUSTOM_FIXED';
  discount_value?: number;
  discount_amount_minor?: number;
  final_fare_minor?: number;         // = discounted fare (no toll)
  toll_parking_minor?: number;       // toll + parking combined
  toll_minor?: number;
  parking_minor?: number;
  grand_total_minor?: number;        // = final_fare_minor + toll_parking_minor
  discount_source_customer_id?: string | null;
  base_calculated_minor?: number;    // ⚠️ undefined for RETURN trips (intentional)
  leg1_minor?: number;
  leg2_minor?: number;
  combined_before_multiplier?: number;
  multiplier_mode?: string;
  multiplier_value?: number | null;
  surcharge_minor?: number;
  minimum_applied?: boolean;
  time_surcharge_minor?: number;
  surcharge_labels?: string[];
  surcharge_items?: { label: string; amount_minor: number }[];
  extras_minor?: number;
  waypoints_minor?: number;
  baby_seats_minor?: number;
}
```

---

## FILE 4：pricing.resolver.ts
**路径**：`src/pricing/pricing.resolver.ts`
**用途**：核心定价引擎（`resolveV41`），计算 base fare、waypoints、seats、multiplier、minimum、toll、parking、surcharge、discount
**审计重点**：`base_calculated_minor = undefined` for RETURN trip；两程距离来自 `ctx`（前端传入）

```typescript
// [Full source code as read above — included in full]
```
> 完整源码见前文 FILE 4 读取结果（共 381 行）

---

## FILE 5：discount.resolver.ts
**路径**：`src/customer/discount.resolver.ts`
**用途**：根据客户 tier 和 custom_discount 计算折扣金额
**审计重点**：`AND active = true` 条件；与 `discount-preview` 逻辑是否一致

```typescript
// [Full source included above — 99 lines]
```

---

## FILE 6：payment.service.ts
**路径**：`src/payment/payment.service.ts`
**用途**：Stripe PaymentIntent 创建、Capture、Refund，以及 outbox_events 写入
**审计重点**：`capture_method: 'manual'`（预授权模式）；`capturePayment` 只检查 `AUTHORIZED` 状态

```typescript
// [Full source included above — 165 lines]
```

---

## FILE 7：payment-events.ts
**路径**：`src/payment/payment-events.ts`
**用途**：支付事件常量定义

```typescript
export const PAYMENT_EVENTS = {
  PAYMENT_AUTHORIZED: 'PaymentAuthorized',
  PAYMENT_CAPTURED: 'PaymentCaptured',
  PAYMENT_REFUNDED: 'PaymentRefunded',
  PAYMENT_FAILED: 'PaymentFailed',
} as const;

export type PaymentEventType = (typeof PAYMENT_EVENTS)[keyof typeof PAYMENT_EVENTS];
```

---

## 关键发现摘要（供 ChatGPT 审查时参考）

| # | 位置 | 问题 | 风险 |
|---|------|------|------|
| 1 | `createBooking` L290 | `totalPriceMinor = dto.totalPriceMinor ?? result.estimated_total_minor` — 无服务端重算 | 🔴 价格篡改 |
| 2 | `guestCheckout` L879 | `guestBaseFare = base_calculated_minor ?? (totalMinor - toll)` — RETURN trip 时 fallback 不准确 | 🟡 数据错误 |
| 3 | `guestCheckout` L893 | email 匹配用户无加密/token 验证 | 🟡 身份冒用风险 |
| 4 | `markBookingPaid` L736 | 无状态前置检查，可重复调用 | 🟡 重复操作 |
| 5 | `StripeWebhookController` L22 | 使用平台级 STRIPE_SECRET_KEY，多租户 webhook 签名验证可能错误 | 🔴 多租户隔离 |
| 6 | `stripe-webhook` L54 | `on conflict do nothing` 幂等 — 无显式 SELECT 前置，依赖 DB 唯一约束 | 🟡 待确认 |
| 7 | `onModuleInit` | ALTER TABLE DDL 在生产启动时执行，多实例下有锁风险 | 🟡 部署风险 |
| 8 | `payViaToken` | `amount = b.total_price_minor`（来自初始 DTO）— 若被篡改则 Stripe charge 金额错误 | 🔴 支付金额 |

_审计包生成：2026-03-09 | 用于 ChatGPT 独立外部审计_
