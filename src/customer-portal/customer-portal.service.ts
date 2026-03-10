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
import { LoyaltyPricingService } from './loyalty-pricing.service';
import { InvoicePdfService } from '../invoice/invoice-pdf.service';

@Injectable()
export class CustomerPortalService implements OnModuleInit {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly notificationService: NotificationService,
    private readonly trace: DebugTraceService,
    private readonly loyaltyPricing: LoyaltyPricingService,
    private readonly invoicePdf: InvoicePdfService,
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
        ADD COLUMN IF NOT EXISTS service_type_id uuid,
        ADD COLUMN IF NOT EXISTS is_return_trip boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS return_pickup_at_utc timestamptz,
        ADD COLUMN IF NOT EXISTS return_pickup_address_text text,
        ADD COLUMN IF NOT EXISTS waypoints text[] NOT NULL DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS pricing_snapshot jsonb,
        ADD COLUMN IF NOT EXISTS prepay_base_fare_minor integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS prepay_toll_minor integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS prepay_parking_minor integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS prepay_total_minor integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS discount_total_minor integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS passenger_is_customer boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS passenger_first_name text,
        ADD COLUMN IF NOT EXISTS passenger_last_name text,
        ADD COLUMN IF NOT EXISTS passenger_phone_country_code text,
        ADD COLUMN IF NOT EXISTS passenger_phone_number text,
        ADD COLUMN IF NOT EXISTS customer_phone_country_code text,
        ADD COLUMN IF NOT EXISTS customer_phone_number text,
        ADD COLUMN IF NOT EXISTS luggage_count integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS infant_seats integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS toddler_seats integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS booster_seats integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS flight_number text,
        ADD COLUMN IF NOT EXISTS payment_token text,
        ADD COLUMN IF NOT EXISTS payment_token_expires_at timestamptz,
        ADD COLUMN IF NOT EXISTS payment_captured_at timestamptz,
        ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text
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

    // quote_sessions.customer_id — associates logged-in customers to their quote sessions
    // Enables pending-quotes list and quote resume for authenticated customers.
    await this.db.query(`
      ALTER TABLE public.quote_sessions
        ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL
    `).catch(() => {});
    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_quote_sessions_customer_id
        ON public.quote_sessions(customer_id)
        WHERE customer_id IS NOT NULL
    `).catch(() => {});

    // operational_status_enum safety: add PAYMENT_FAILED if not present
    // ALTER TYPE ... ADD VALUE IF NOT EXISTS requires Postgres 9.6+; runs outside transaction (catch is fine)
    await this.db.query(`
      ALTER TYPE public.operational_status_enum ADD VALUE IF NOT EXISTS 'PAYMENT_FAILED'
    `).catch(() => {});

    // adjustment_status check constraint: extend to include NO_PAYMENT_METHOD
    // Drop + re-add is safe — check constraints carry no foreign key data
    await this.db.query(`
      ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_adjustment_status_check
    `).catch(() => {});
    await this.db.query(`
      ALTER TABLE public.bookings ADD CONSTRAINT bookings_adjustment_status_check
        CHECK (adjustment_status = ANY (ARRAY[
          'NONE', 'PENDING', 'CAPTURED', 'REFUNDED', 'FAILED', 'NO_PAYMENT_METHOD', 'SETTLED'
        ]))
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

  // ── Tenant info (public) ──────────────────────────────────────────────────
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

  // ── Pending Quotes ────────────────────────────────────────────────────────
  /**
   * Returns active (unexpired, non-converted) quote sessions owned by this customer.
   * Sorted by newest first. Maximum 10 results.
   */
  async listPendingQuotes(customerId: string, tenantId: string) {
    const rows = await this.db.query(
      `SELECT id, payload, expires_at, created_at
       FROM public.quote_sessions
       WHERE customer_id = $1
         AND tenant_id   = $2
         AND expires_at  > now()
         AND (converted IS NULL OR converted = false)
         AND (converted_at IS NULL)
       ORDER BY created_at DESC
       LIMIT 10`,
      [customerId, tenantId],
    );

    return rows.map((r: any) => {
      const payload = r.payload ?? {};
      const req     = payload.request ?? {};
      const results = payload.results ?? [];
      const cheapest = results.length > 0
        ? results.reduce((min: any, cur: any) =>
            (cur.estimated_total_minor < min.estimated_total_minor ? cur : min), results[0])
        : null;

      return {
        quote_id:          r.id,
        expires_at:        r.expires_at,
        created_at:        r.created_at,
        currency:          payload.currency ?? 'AUD',
        pickup_address:    req.pickup_address ?? null,
        dropoff_address:   req.dropoff_address ?? null,
        pickup_at_utc:     req.pickup_at_utc ?? null,
        trip_mode:         req.trip_mode ?? 'ONE_WAY',
        service_type_name: results[0]?.service_type_name ?? null,
        from_minor:        cheapest?.estimated_total_minor ?? null,
        options_count:     results.length,
      };
    });
  }

  // ── Invoice PDF (customer download) ──────────────────────────────────────
  /**
   * Generates and returns the final invoice PDF for a booking.
   * Enforces: booking belongs to this customer + same tenant.
   * Returns null if no SENT/PAID invoice exists for the booking.
   */
  async getInvoicePdf(
    customerId: string,
    tenantId: string,
    bookingId: string,
  ): Promise<{ buffer: Buffer; filename: string } | null> {
    // Verify booking ownership
    const [booking] = await this.db.query(
      `SELECT b.booking_reference, b.currency,
              c.first_name, c.last_name, c.email as customer_email
       FROM public.bookings b
       JOIN public.customers c ON c.id = b.customer_id
       WHERE b.id = $1 AND b.tenant_id = $2 AND b.customer_id = $3`,
      [bookingId, tenantId, customerId],
    );
    if (!booking) throw new NotFoundException('Booking not found');

    // Fetch the final CUSTOMER invoice (SENT or PAID)
    const [invoice] = await this.db.query(
      `SELECT i.*, ii.description, ii.quantity, ii.unit_price_minor, ii.total_minor as item_total
       FROM public.invoices i
       LEFT JOIN public.invoice_items ii ON ii.invoice_id = i.id
       WHERE i.booking_id = $1 AND i.tenant_id = $2
         AND i.invoice_type = 'CUSTOMER'
         AND i.status IN ('SENT','PAID')
         AND i.deleted_at IS NULL
       ORDER BY i.created_at DESC LIMIT 1`,
      [bookingId, tenantId],
    );
    if (!invoice) return null;

    // Fetch branding
    const [branding] = await this.db.query(
      `SELECT tb.company_name, tb.contact_email, tb.contact_phone
       FROM public.tenant_branding tb WHERE tb.tenant_id = $1 LIMIT 1`,
      [tenantId],
    ).catch(() => []);

    // Build line_items from invoice_items if available; else use a single-line summary
    let lineItems: any[] | null = null;
    if (invoice.description) {
      lineItems = [{
        description:      invoice.description,
        quantity:         invoice.quantity,
        unit_price_minor: invoice.unit_price_minor,
        total_minor:      invoice.item_total,
      }];
    }

    // If invoice has a line_items JSON field (stored on the invoices row itself)
    if (invoice.line_items && (!lineItems || lineItems.length === 0)) {
      try {
        lineItems = typeof invoice.line_items === 'string'
          ? JSON.parse(invoice.line_items)
          : invoice.line_items;
      } catch { lineItems = null; }
    }

    const buffer = await this.invoicePdf.generate({
      invoice_number:    invoice.invoice_number,
      issue_date:        invoice.issue_date ?? invoice.created_at,
      due_date:          invoice.due_date ?? null,
      booking_reference: booking.booking_reference,
      company_name:      branding?.company_name ?? 'ASChauffeured',
      company_email:     branding?.contact_email ?? null,
      company_phone:     branding?.contact_phone ?? null,
      recipient_name:    invoice.recipient_name ?? `${booking.first_name} ${booking.last_name}`.trim(),
      recipient_email:   invoice.recipient_email ?? booking.customer_email,
      currency:          invoice.currency ?? booking.currency ?? 'AUD',
      subtotal_minor:    Number(invoice.subtotal_minor ?? 0),
      tax_minor:         Number(invoice.tax_minor ?? 0),
      discount_minor:    Number(invoice.discount_minor ?? 0),
      total_minor:       Number(invoice.total_minor ?? 0),
      line_items:        lineItems,
      notes:             invoice.notes ?? null,
    });

    const filename = `Invoice-${booking.booking_reference ?? invoice.invoice_number}.pdf`;
    return { buffer, filename };
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
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

  // ── Resume booking ────────────────────────────────────────────────────────
  // Returns the single best "continue" target for a logged-in customer.
  // Priority:
  //   1. Latest PENDING_CUSTOMER_CONFIRMATION booking (not yet paid/confirmed)
  //   2. { type: 'none' } — frontend may fall back to a local quote draft
  async resumeBooking(customerId: string, tenantId: string) {
    // 1. Pending booking — customer created a booking but hasn't paid/confirmed yet
    const [pending] = await this.db.query(
      `SELECT id, service_class_id
       FROM public.bookings
       WHERE customer_id = $1
         AND tenant_id   = $2
         AND operational_status = 'PENDING_CUSTOMER_CONFIRMATION'
       ORDER BY created_at DESC
       LIMIT 1`,
      [customerId, tenantId],
    );

    if (pending) {
      return {
        type: 'pending_booking',
        booking_id: pending.id as string,
      };
    }

    // 2. No pending booking — frontend should check local quote draft (localStorage)
    return { type: 'none' };
  }

  // ── Bookings list ─────────────────────────────────────────────────────────
  async listBookings(
    customerId: string,
    tenantId: string,
    query: { status?: string; limit?: number; offset?: number },
  ) {
    const limit = Math.min(Number(query.limit ?? 20), 100);
    const offset = Number(query.offset ?? 0);
    // Get customer email for matching unlinked bookings
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

  // ── Booking detail ────────────────────────────────────────────────────────
  async getBooking(customerId: string, tenantId: string, bookingId: string) {
    // First try: exact customer_id match
    let rows = await this.db.query(
      `SELECT b.*
       FROM public.bookings b
       WHERE b.id=$1 AND b.customer_id=$2 AND b.tenant_id=$3`,
      [bookingId, customerId, tenantId],
    );

    // Fallback: booking has no customer_id yet — match by tenant + id
    // then verify email matches (so customers can't see each other's bookings)
    if (!rows.length) {
      const customerRows = await this.db.query(
        `SELECT email FROM public.customers WHERE id=$1 LIMIT 1`,
        [customerId],
      );
      const email = customerRows[0]?.email;
      if (email) {
        // Match bookings where: customer_id is NULL and email matches, OR customer_email matches
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
        // If found, retroactively link this booking to the customer
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
  async createBooking(customerId: string, tenantId: string, dto: any) {
    // If quoteId provided, hydrate trip details from quote session
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
      // Return trip fields from quote payload
      if ((req.trip_mode ?? req.tripMode) === 'RETURN') {
        dto.isReturnTrip = true;
        // Build return_pickup_at_utc from return_date + return_time if not already set
        if (!dto.returnPickupAtUtc && req.return_date) {
          const returnLocal = `${req.return_date}T${req.return_time ?? '00:00'}:00`;
          dto.returnPickupAtUtc = new Date(returnLocal).toISOString();
        }
        dto.returnPickupAtUtc = dto.returnPickupAtUtc ?? req.return_pickup_at_utc ?? null;
        dto.returnPickupAddressText = dto.returnPickupAddressText ?? req.pickup_address ?? pickupAddress;
      }
      // Waypoints from quote
      if (!dto.waypoints?.length && req.waypoints?.length) {
        dto.waypoints = req.waypoints.filter(Boolean);
      }

      // P0-1: price authority — must come from server-side quote session only
      if (!payload.results?.length) {
        throw new BadRequestException('Quote session contains no pricing results');
      }
      const result = (dto.vehicleClassId
        ? payload.results.find((r: any) => r.service_class_id === dto.vehicleClassId)
        : null) ?? payload.results[0];
      if (!result) {
        throw new BadRequestException('Selected vehicle class not found in quote. Please re-quote.');
      }

      // Apply loyalty discount server-side — client totalPriceMinor and discountMinor are ignored.
      // LoyaltyPricingService uses the same logic as GET /customer-portal/discount-preview,
      // guaranteeing preview amount == booking amount == charge amount.
      const loyalty = await this.loyaltyPricing.compute(
        customerId,
        tenantId,
        result,
        payload.currency ?? currency,
      );
      totalPriceMinor = loyalty.finalFareMinor;
      currency        = loyalty.currency;

      // Merge loyalty breakdown into pricing snapshot for downstream charge (payViaToken)
      pricingSnapshot = {
        ...(result.pricing_snapshot_preview ?? {}),
        // Overwrite with loyalty-adjusted values so payViaToken reads correct amounts
        final_fare_minor:     loyalty.finalFareMinor,
        grand_total_minor:    loyalty.finalFareMinor,
        discount_amount_minor: loyalty.discountMinor,
        discount_rate:        loyalty.discountRate,
        discount_name:        loyalty.discountName,
        toll_minor:           loyalty.tollParkingMinor > 0
                                ? (result.pricing_snapshot_preview?.toll_minor ?? loyalty.tollParkingMinor)
                                : 0,
        parking_minor:        result.pricing_snapshot_preview?.parking_minor ?? 0,
        loyalty_applied:      true,
        snapshot_source:      loyalty.snapshotSource,
      };
      vehicleClassId  = result.service_class_id ?? dto.vehicleClassId ?? null;
    }

    const [tenantRow] = await this.db.query(
      `SELECT booking_ref_prefix FROM public.tenants WHERE id=$1 LIMIT 1`,
      [tenantId],
    );
    const refPrefix = (tenantRow?.booking_ref_prefix ?? 'BK').trim().toUpperCase();
    const ref = `${refPrefix}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

    // Extract toll/parking breakdown from pricing snapshot (loyalty-adjusted snapshot when quoteId present)
    const tollMinor    = Number(pricingSnapshot?.toll_minor    ?? 0);
    const parkingMinor = Number(pricingSnapshot?.parking_minor ?? 0);
    // baseFareMinor = final total minus toll pass-through (toll is never discounted)
    const baseFareMinor = pricingSnapshot?.base_calculated_minor != null
      ? Number(pricingSnapshot.base_calculated_minor)
      : Math.max(0, totalPriceMinor - tollMinor - parkingMinor);

    // Load customer info for passenger fields
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
        totalPriceMinor,                          // $24 — prepay_total_minor
        dto.waypoints?.filter(Boolean) ?? [],     // $25 — waypoints
        dto.isReturnTrip ? true : false,          // $26 — is_return_trip
        dto.returnPickupAtUtc ?? null,            // $27 — return_pickup_at_utc
        dto.returnPickupAddressText ?? null,      // $28 — return_pickup_address_text
      ],
    );

    // Save payment method from setupIntentId (new card)
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

    // Mark quote as converted
    if (quoteSessionId) {
      await this.db.query(
        `UPDATE public.quote_sessions SET converted_at = now() WHERE id = $1`,
        [quoteSessionId],
      ).catch(() => {});
    }

    // Record status history
    await this.db.query(
      `INSERT INTO public.booking_status_history
         (id, tenant_id, booking_id, previous_status, new_status, triggered_by, reason, created_at)
       VALUES (gen_random_uuid(),$1,$2,NULL,'PENDING_CUSTOMER_CONFIRMATION','CUSTOMER',NULL,now())`,
      [tenantId, booking.id],
    ).catch(() => {});

    // ── Customer-created booking notifications ──
    // 1. Customer receives "booking received" email (pending admin confirmation)
    // 2. Admin receives "new booking" alert
    const notifPayload = { tenant_id: tenantId, booking_id: booking.id };
    this.notificationService.handleEvent('CustomerCreatedBookingReceived', notifPayload)
      .catch((e) => console.error(`[Notification] CustomerCreatedBookingReceived FAILED:`, e?.message ?? e));
    setTimeout(() => {
      this.notificationService.handleEvent('AdminNewBooking', notifPayload)
        .catch((e) => console.error(`[Notification] AdminNewBooking FAILED:`, e?.message ?? e));
    }, 1500);

    return booking;
  }

  // ── Cancel booking ────────────────────────────────────────────────────────
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

    // Check cancellation window
    const tenant = await this.db.query(
      `SELECT cancel_window_hours FROM public.tenants WHERE id=$1`,
      [tenantId],
    );
    const windowHours = tenant[0]?.cancel_window_hours ?? 2;
    const pickupTime = new Date(b.pickup_at_utc).getTime();
    const now = Date.now();
    if (pickupTime - now < windowHours * 3600 * 1000) {
      throw new BadRequestException(
        `Cannot cancel within ${windowHours}h of pickup`,
      );
    }

    await this.db.query(
      `UPDATE public.bookings SET operational_status='CANCELLED', updated_at=now() WHERE id=$1`,
      [bookingId],
    );
    // Fire cancellation notification (non-blocking)
    this.notificationService.handleEvent('BookingCancelled', { tenant_id: tenantId, booking_id: bookingId, cancelled_by: 'customer' })
      .catch((e) => console.error('[Notification] BookingCancelled FAILED:', e?.message ?? e));
    return { success: true };
  }

  // ── Profile ───────────────────────────────────────────────────────────────
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

  // ── Passengers ────────────────────────────────────────────────────────────
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
    // If new passenger is set as default, clear others first
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
        customerId,
        tenantId,
        dto.first_name,
        dto.last_name,
        dto.email             ?? null,
        dto.phone_country_code ?? null,
        dto.phone_number      ?? null,
        dto.relationship      ?? 'Other',
        dto.is_default        ?? false,
        dto.preferences != null ? JSON.stringify(dto.preferences) : null,
      ],
    );
    return p;
  }

  // ── Payment methods ───────────────────────────────────────────────────────
  async listPaymentMethods(customerId: string, tenantId: string) {
    return this.db.query(
      `SELECT id, stripe_payment_method_id, brand, last4, exp_month, exp_year, is_default
       FROM public.saved_payment_methods
       WHERE customer_id=$1 AND tenant_id=$2
       ORDER BY is_default DESC, created_at DESC`,
      [customerId, tenantId],
    );
  }

  /** Public setup intent for guest checkout — on_session (card added during active session) */
  async createGuestSetupIntent(tenantSlug: string) {
    const tenant = await this.getTenantInfo(tenantSlug);
    const stripe = await this.getStripe(tenant.id);
    const si = await stripe.setupIntents.create({
      payment_method_types: ['card'],
      // on_session: customer is present now; admin will charge off_session later
      // 3DS handled at setup time → reduces friction at charge time
      usage: 'off_session',
      payment_method_options: {
        card: { request_three_d_secure: 'automatic' },
      },
    });
    return { clientSecret: si.client_secret };
  }

  async createSetupIntent(customerId: string, tenantId: string) {
    const stripe = await this.getStripe(tenantId);

    // Get or create stripe customer
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

  async confirmSetup(
    customerId: string,
    tenantId: string,
    dto: { setupIntentId: string; bookingId?: string },
  ) {
    const stripe = await this.getStripe(tenantId);
    const si = await stripe.setupIntents.retrieve(dto.setupIntentId);

    if (si.status !== 'succeeded') {
      throw new BadRequestException(`SetupIntent not succeeded: ${si.status}`);
    }

    const pmId = si.payment_method as string;
    if (!pmId) throw new BadRequestException('No payment method on SetupIntent');

    const pm = await stripe.paymentMethods.retrieve(pmId);

    // Save payment method
    const [saved] = await this.db.query(
      `INSERT INTO public.saved_payment_methods
         (customer_id, tenant_id, stripe_payment_method_id, last4, brand, exp_month, exp_year, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7,
         NOT EXISTS (SELECT 1 FROM public.saved_payment_methods WHERE customer_id=$1 AND tenant_id=$2))
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [
        customerId, tenantId, pmId,
        pm.card?.last4, pm.card?.brand,
        pm.card?.exp_month, pm.card?.exp_year,
      ],
    );

    // If booking attached, update operational_status to PENDING_CUSTOMER_CONFIRMATION
    if (dto.bookingId) {
      await this.db.query(
        `UPDATE public.bookings
         SET operational_status = 'PENDING_CUSTOMER_CONFIRMATION',
             updated_at = now()
         WHERE id=$1 AND customer_id=$2 AND tenant_id=$3`,
        [dto.bookingId, customerId, tenantId],
      ).catch(() => {});
    }

    return { success: true, paymentMethod: saved };
  }

  async deletePaymentMethod(
    customerId: string,
    tenantId: string,
    pmId: string,
  ) {
    const rows = await this.db.query(
      `SELECT stripe_payment_method_id FROM public.saved_payment_methods
       WHERE id=$1 AND customer_id=$2 AND tenant_id=$3`,
      [pmId, customerId, tenantId],
    );
    if (!rows.length) throw new NotFoundException('Payment method not found');

    try {
      const stripe = await this.getStripe(tenantId);
      await stripe.paymentMethods.detach(rows[0].stripe_payment_method_id);
    } catch {
      // Best effort
    }

    await this.db.query(
      `DELETE FROM public.saved_payment_methods WHERE id=$1`,
      [pmId],
    );
    return { success: true };
  }

  // ── Payment link (public token) ───────────────────────────────────────────
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

    // Load saved card if customer has one
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

  async payViaToken(token: string, dto: { paymentMethodId: string }) {
    const rows = await this.db.query(
      `SELECT b.id, b.tenant_id, b.customer_id, b.total_price_minor, b.currency,
              b.payment_status, b.booking_reference, b.pricing_snapshot
       FROM public.bookings b WHERE b.payment_token=$1 AND b.payment_token_expires_at > NOW()`,
      [token],
    );
    if (!rows.length) throw new NotFoundException('Payment link not found');
    const b = rows[0];
    if (b.payment_status === 'PAID') throw new BadRequestException('Already paid');

    // P0-2: resolve authoritative payable amount from pricing snapshot
    // grand_total_minor is the server-computed final total (discount + toll applied)
    // Fall back to total_price_minor only if snapshot is missing (pre-snapshot bookings)
    const snap = b.pricing_snapshot ?? {};
    const trustedAmountMinor: number = snap.grand_total_minor
      ?? snap.final_fare_minor
      ?? Number(b.total_price_minor);

    if (!trustedAmountMinor || trustedAmountMinor <= 0) {
      throw new BadRequestException('Cannot resolve payable amount — contact support');
    }

    const stripe = await this.getStripe(b.tenant_id);
    const appUrl = process.env.CUSTOMER_APP_URL ?? 'https://aschauffeured.chauffeurssolution.com';

    // Resolve Stripe Connect account ID if tenant uses Connect
    // NULL = platform Stripe mode (platform key pays directly, no Connect routing)
    // non-NULL = tenant/Connect account mode (funds routed to tenant's connected account)
    const tsRows = await this.db.query(
      `SELECT stripe_connect_account_id FROM public.tenant_settings WHERE tenant_id=$1 LIMIT 1`,
      [b.tenant_id],
    );
    const stripeConnectAccountId: string | null = tsRows[0]?.stripe_connect_account_id ?? null;

    let stripeCustomerId: string | undefined;
    if (b.customer_id) {
      const custRows = await this.db.query(
        `SELECT stripe_customer_id FROM public.customers WHERE id=$1`,
        [b.customer_id],
      );
      stripeCustomerId = custRows[0]?.stripe_customer_id ?? undefined;
    }

    // P0-1: create PI + immediately persist payment record
    // NULL stripe_account_id = platform mode (no stripeAccount option)
    // non-NULL = Connect mode (stripeAccount: acct_xxx)
    // Stripe SDK v20: passing {} as second arg throws "Unknown arguments" — must omit entirely.
    // Only pass options when stripeAccount has a real value.
    const piParams: import('stripe').default.PaymentIntentCreateParams = {
      amount: trustedAmountMinor,
      currency: b.currency.toLowerCase(),
      payment_method: dto.paymentMethodId,
      ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
      confirm: true,
      return_url: `${appUrl}/pay/${token}?3ds=true`,
      metadata: { booking_id: b.id, tenant_id: b.tenant_id },
      payment_method_options: {
        card: { request_three_d_secure: 'automatic' },
      },
    };

    let pi: import('stripe').default.PaymentIntent;
    try {
      pi = stripeConnectAccountId
        ? await stripe.paymentIntents.create(piParams, { stripeAccount: stripeConnectAccountId })
        : await stripe.paymentIntents.create(piParams);
    } catch (stripeErr: any) {
      const msg = stripeErr?.message ?? String(stripeErr);
      console.error(`[payViaToken] Stripe PI creation failed for booking ${b.id}:`, msg);
      throw new BadRequestException(`Payment failed: ${msg}`);
    }

    // P0-2: correct payment_status_full_enum mapping
    // requires_action = 3DS/redirect pending → AUTHORIZATION_PENDING (not yet authorized)
    // requires_capture = manual-capture hold confirmed → AUTHORIZED
    // processing = async payment in progress → AUTHORIZATION_PENDING
    // succeeded = direct confirm succeeded → PAID
    // canceled → CANCELLED; all others → UNPAID
    const piPaymentStatus: string =
      pi.status === 'succeeded'          ? 'PAID'                   :
      pi.status === 'requires_capture'   ? 'AUTHORIZED'             :
      pi.status === 'requires_action'    ? 'AUTHORIZATION_PENDING'  :
      pi.status === 'processing'         ? 'AUTHORIZATION_PENDING'  :
      pi.status === 'canceled'           ? 'CANCELLED'              : 'UNPAID';

    try {
      await this.db.query(
        `INSERT INTO public.payments (
           tenant_id, booking_id,
           stripe_account_id,
           stripe_payment_intent_id,
           payment_type, currency,
           amount_authorized_minor,
           amount_captured_minor, amount_refunded_minor,
           payment_status
         ) VALUES ($1,$2,$3,$4,'INITIAL',$5,$6,0,0,$7::payment_status_full_enum)
         ON CONFLICT (tenant_id, stripe_payment_intent_id) DO UPDATE
           SET payment_status          = EXCLUDED.payment_status,
               amount_authorized_minor = EXCLUDED.amount_authorized_minor,
               updated_at              = now()`,
        // stripe_account_id: real Connect ID when available, NULL for platform mode
        [b.tenant_id, b.id, stripeConnectAccountId, pi.id, b.currency, trustedAmountMinor, piPaymentStatus],
      );
    } catch (dbErr: any) {
      // PI created but DB write failed — log PI id for manual recovery
      console.error(
        `[payViaToken] payments INSERT failed. PI=${pi.id} booking=${b.id} status=${pi.status}:`,
        dbErr?.message ?? dbErr,
      );
      throw new BadRequestException('Payment intent created but record save failed — contact support');
    }

    if (pi.status === 'succeeded') {
      await this.markBookingPaid(b.id, pi.id, b.tenant_id);
    }

    return {
      success: pi.status === 'succeeded',
      status: pi.status,
      clientSecret: pi.client_secret,
      paymentIntentId: pi.id,
    };
  }

  /** Called after frontend completes 3DS via handleNextAction */
  async confirm3ds(token: string, dto: { paymentIntentId: string }) {
    const rows = await this.db.query(
      `SELECT b.id, b.tenant_id, b.payment_status
       FROM public.bookings b WHERE b.payment_token=$1`,
      [token],
    );
    if (!rows.length) throw new NotFoundException('Booking not found');
    const b = rows[0];
    // Idempotent: already paid — return immediately without calling Stripe
    if (b.payment_status === 'PAID') return { success: true };

    // Resolve Stripe account mode from the payment record created during payViaToken.
    // Source of truth is payments.stripe_account_id — NOT tenant_settings (settings may change;
    // the PI was already created against a specific account and must be retrieved the same way).
    // NULL = platform mode (no stripeAccount option)
    // non-NULL = Connect mode (must pass matching stripeAccount option for retrieve)
    const paymentRows = await this.db.query(
      `SELECT stripe_account_id
       FROM public.payments
       WHERE stripe_payment_intent_id = $1
         AND booking_id = $2
       LIMIT 1`,
      [dto.paymentIntentId, b.id],
    );
    // If no payment record exists, the PI was never persisted for this booking — reject
    if (!paymentRows.length) {
      throw new BadRequestException('Payment record not found for this booking and payment intent');
    }
    const stripeAccountId: string | null = paymentRows[0]?.stripe_account_id ?? null;

    const stripe = await this.getStripe(b.tenant_id);

    // Use the same account mode the PI was created with — Connect or platform
    // Stripe SDK v20: never pass {} as options arg — omit entirely in platform mode
    const pi = stripeAccountId
      ? await stripe.paymentIntents.retrieve(dto.paymentIntentId, {}, { stripeAccount: stripeAccountId })
      : await stripe.paymentIntents.retrieve(dto.paymentIntentId);
    if (pi.status !== 'succeeded') {
      throw new BadRequestException(`Payment not completed: ${pi.status}`);
    }

    // P0-3: verify payment intent belongs to this booking via metadata
    if (pi.metadata?.booking_id && pi.metadata.booking_id !== b.id) {
      throw new BadRequestException('Payment intent does not match this booking');
    }

    await this.markBookingPaid(b.id, pi.id, b.tenant_id);
    return { success: true };
  }

  // P0-B: idempotent markBookingPaid — ownership verified + state precondition
  private async markBookingPaid(bookingId: string, paymentIntentId: string, tenantId?: string) {
    // P0-B: verify payment record belongs to this booking before marking paid
    // Accepts: (a) row in payments table OR (b) stripe_payment_intent_id already on the booking
    const paymentRows = await this.db.query(
      `SELECT id FROM public.payments
       WHERE stripe_payment_intent_id = $1
         AND booking_id = $2
         AND ($3::uuid IS NULL OR tenant_id = $3)
       LIMIT 1`,
      [paymentIntentId, bookingId, tenantId ?? null],
    );
    const bookingHasIntent = await this.db.query(
      `SELECT id FROM public.bookings
       WHERE id = $1 AND stripe_payment_intent_id = $2
       LIMIT 1`,
      [bookingId, paymentIntentId],
    );
    if (!paymentRows.length && !bookingHasIntent.length) {
      // Neither payments record nor booking record links this PI to this booking
      console.error(
        `[markBookingPaid] REJECTED: PI ${paymentIntentId} not verified for booking ${bookingId}`,
      );
      throw new BadRequestException('Payment intent not verified for this booking');
    }

    // Atomic UPDATE with state precondition — idempotent, no double-fire
    const rows = await this.db.query(
      `UPDATE public.bookings
       SET operational_status='CONFIRMED', payment_status='PAID',
           stripe_payment_intent_id=$1, payment_captured_at=now(), updated_at=now()
       WHERE id=$2
         AND payment_status NOT IN ('PAID', 'REFUNDED', 'PARTIALLY_REFUNDED')
       RETURNING id, tenant_id`,
      [paymentIntentId, bookingId],
    );

    // No rows updated = already in terminal state — skip notifications (idempotent)
    if (!rows.length) return;

    const resolvedTenantId = tenantId ?? rows[0]?.tenant_id;
    if (resolvedTenantId) {
      const notifPayload = { tenant_id: resolvedTenantId, booking_id: bookingId };
      this.notificationService.handleEvent('BookingConfirmed', notifPayload)
        .catch((e) => console.error('[Notification] BookingConfirmed (pay link) FAILED:', e?.message));
      setTimeout(() => {
        this.notificationService.handleEvent('AdminBookingConfirmedPaid', notifPayload)
          .catch((e) => console.error('[Notification] AdminBookingConfirmedPaid FAILED:', e?.message));
      }, 2000);
    }
  }

  // ── Invoices ──────────────────────────────────────────────────────────────
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
  async guestCheckout(tenantSlug: string, dto: any) {
    this.trace.traceInfo('GUEST_CHECKOUT_START', {
      tenant_id: undefined,
      message: 'Guest checkout initiated',
      context: { slug: tenantSlug, quoteId: dto.quoteId, vehicleClassId: dto.vehicleClassId, email: dto.email ? dto.email.substring(0,3)+'***' : undefined },
    });

    // Guest checkout resolves tenant from body.tenantSlug (no JWT).
    // Guard: quote session must exist for this tenant — an unknown slug cannot forge a booking
    // against a real quote because quote_sessions is filtered by tenant_id below.
    // Additional guard: only active tenants are matched.
    const tenant = await this.db.query(
      `SELECT id, booking_ref_prefix FROM public.tenants WHERE slug=$1 AND status='active' LIMIT 1`,
      [tenantSlug],
    );
    if (!tenant.length) throw new NotFoundException('Tenant not found');
    const tenantId = tenant[0].id;
    const refPrefix = (tenant[0].booking_ref_prefix ?? 'BK').trim().toUpperCase();

    // ── Resolve quote session details ──────────────────────────────────────
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
      // P0-1: quote session required when quoteId supplied
      if (!session) throw new BadRequestException('Quote session expired or not found');

      const req = session.payload?.request ?? {};
      pickupAddress  = pickupAddress  ?? req.pickupAddress  ?? req.pickup_address ?? req.pickup_address_text;
      dropoffAddress = dropoffAddress ?? req.dropoffAddress ?? req.dropoff_address ?? req.dropoff_address_text;
      pickupAtUtc    = pickupAtUtc    ?? req.pickupAtUtc    ?? req.pickup_at_utc  ?? req.pickup_at;
      serviceTypeId  = serviceTypeId  ?? req.serviceTypeId  ?? req.service_type_id ?? null;
      passengerCount = passengerCount ?? req.passengers     ?? req.passenger_count ?? 1;
      currency       = currency       ?? session.payload?.currency ?? 'AUD';
      quoteSessionId = session.id;

      // P0-1: server price is authoritative — never use client-supplied totalPriceMinor
      if (!session.payload?.results?.length) {
        throw new BadRequestException('Quote session contains no pricing results');
      }
      const resolvedClassId = dto.vehicleClassId ?? dto.carTypeId;
      const result = (resolvedClassId
        ? session.payload.results.find((r: any) => r.service_class_id === resolvedClassId)
        : null) ?? session.payload.results[0];
      if (!result) {
        throw new BadRequestException('Selected vehicle class not found in quote. Please re-quote.');
      }
      // Server-side price wins — client totalPriceMinor ignored
      totalMinor = result.estimated_total_minor;
      guestPricingSnapshot = result.pricing_snapshot_preview ?? null;
      serviceClassId = result.service_class_id ?? serviceClassId;
    }

    const guestTollMinor    = guestPricingSnapshot?.toll_minor    ?? 0;
    const guestParkingMinor = guestPricingSnapshot?.parking_minor ?? 0;
    // P0-1: use pre_discount_fare_minor (accurate for RETURN trips) instead of base_calculated_minor
    const guestBaseFare     = guestPricingSnapshot?.pre_discount_fare_minor
      ?? guestPricingSnapshot?.base_calculated_minor
      ?? Math.max(0, totalMinor - guestTollMinor - guestParkingMinor);

    // ── Create or find customer by email ────────────────────────────────────
    const email = dto.email?.toLowerCase?.() ?? null;

    // Split phone into country code + number (e.g. "+61412345678" → "+61", "412345678")
    const rawPhone: string = dto.phone ?? '';
    const phoneMatch = rawPhone.match(/^(\+\d{1,3})(.*)/);
    const phoneCode   = phoneMatch ? phoneMatch[1] : null;
    const phoneNumber = phoneMatch ? phoneMatch[2].trim() : (rawPhone || null);

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

    // Save Stripe payment method for guest if setupIntentId provided
    if (dto.setupIntentId) {
      try {
        const stripe = await this.getStripe(tenantId);
        const si = await stripe.setupIntents.retrieve(dto.setupIntentId);
        if (si.status === 'succeeded' && si.payment_method) {
          const pm = await stripe.paymentMethods.retrieve(si.payment_method as string);

          // Attach PM to a Stripe customer for future off-session use
          let stripeCustomerId: string | null = null;
          const scRows = await this.db.query(
            `SELECT stripe_customer_id FROM public.customers WHERE id=$1`,
            [customerId],
          );
          if (scRows[0]?.stripe_customer_id) {
            stripeCustomerId = scRows[0].stripe_customer_id;
          } else {
            const sc = await stripe.customers.create({ email: email ?? undefined, name: `${dto.firstName} ${dto.lastName}` });
            await this.db.query(`UPDATE public.customers SET stripe_customer_id=$1 WHERE id=$2`, [sc.id, customerId]);
            stripeCustomerId = sc.id;
          }

          // Attach the PM to this Stripe customer
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
      } catch (_e) { /* non-fatal — booking still created */ }
    }

    // ── Create booking ────────────────────────────────────────────────────
    const ref = `${refPrefix}-${Math.random().toString(36).slice(2,10).toUpperCase()}`;
    const now = new Date().toISOString();

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
          totalMinor,  // $27 — prepay_total_minor
          dto.waypoints?.filter(Boolean) ?? [],  // $28 — waypoints
        ],
      );
    } catch (err: any) {
      throw new Error(`Guest booking INSERT failed: ${err?.message ?? String(err)}`);
    }

    const booking = bookingRows[0];

    // Status history
    await this.db.query(
      `INSERT INTO public.booking_status_history
         (id, tenant_id, booking_id, previous_status, new_status, triggered_by, reason, created_at)
       VALUES (gen_random_uuid(),$1,$2,NULL,'PENDING_CUSTOMER_CONFIRMATION',NULL,NULL,now())`,
      [tenantId, booking.id],
    ).catch(() => {});

    // Mark quote as converted
    if (quoteSessionId) {
      await this.db.query(
        `UPDATE public.quote_sessions SET converted_at=now() WHERE id=$1`,
        [quoteSessionId],
      ).catch(() => {});
    }

    // ── Guest/customer checkout notifications ──
    // 1. Customer receives "booking received" email
    // 2. Admin receives "new booking" alert (delayed to avoid rate limit)
    const notifPayload = { tenant_id: tenantId, booking_id: booking.id };
    this.notificationService.handleEvent('CustomerCreatedBookingReceived', notifPayload)
      .catch((e) => console.error(`[Notification] CustomerCreatedBookingReceived FAILED:`, e?.message ?? e));
    setTimeout(() => {
      this.notificationService.handleEvent('AdminNewBooking', notifPayload)
        .catch((e) => console.error(`[Notification] AdminNewBooking FAILED:`, e?.message ?? e));
    }, 1500);

    this.trace.traceInfo('GUEST_CHECKOUT_SUCCESS', {
      tenant_id: tenantId, booking_id: booking?.id,
      message: 'Guest checkout completed',
      context: { booking_reference: booking?.booking_reference, customerId },
    });

    return { booking, customerId };
  }

  // ── Confirm and charge (admin) ─────────────────────────────────────────────
  async confirmAndCharge(tenantId: string, bookingId: string) {
    const rows = await this.db.query(
      `SELECT b.*, c.stripe_customer_id
       FROM public.bookings b
       JOIN public.customers c ON c.id = b.customer_id
       WHERE b.id=$1 AND b.tenant_id=$2`,
      [bookingId, tenantId],
    );
    if (!rows.length) throw new NotFoundException('Booking not found');
    const b = rows[0];
    if (b.status !== 'AWAITING_CONFIRMATION') {
      throw new BadRequestException('Booking is not in AWAITING_CONFIRMATION state');
    }
    if (!b.stripe_customer_id) {
      throw new BadRequestException('No Stripe customer on file');
    }

    // Get default payment method
    const pmRows = await this.db.query(
      `SELECT stripe_payment_method_id FROM public.saved_payment_methods
       WHERE customer_id=$1 AND tenant_id=$2 AND is_default=true LIMIT 1`,
      [b.customer_id, tenantId],
    );
    if (!pmRows.length) {
      throw new BadRequestException('No default payment method saved');
    }

    const stripe = await this.getStripe(tenantId);
    try {
      const pi = await stripe.paymentIntents.create({
        amount: b.total_price_minor,
        currency: b.currency.toLowerCase(),
        customer: b.stripe_customer_id,
        payment_method: pmRows[0].stripe_payment_method_id,
        confirm: true,
        off_session: true,
      });

      await this.db.query(
        `UPDATE public.bookings
         SET status='CONFIRMED', payment_status='PAID',
             stripe_payment_intent_id=$1, payment_captured_at=now(), updated_at=now()
         WHERE id=$2`,
        [pi.id, bookingId],
      );

      return { success: true, paymentIntentId: pi.id };
    } catch (err: any) {
      await this.db.query(
        `UPDATE public.bookings SET status='PAYMENT_FAILED', updated_at=now() WHERE id=$1`,
        [bookingId],
      );
      return { success: false, error: err.message };
    }
  }

  // ── Reject booking (admin) ─────────────────────────────────────────────────
  async rejectBooking(tenantId: string, bookingId: string, reason?: string) {
    const rows = await this.db.query(
      `SELECT status FROM public.bookings WHERE id=$1 AND tenant_id=$2`,
      [bookingId, tenantId],
    );
    if (!rows.length) throw new NotFoundException('Booking not found');
    if (rows[0].status !== 'AWAITING_CONFIRMATION') {
      throw new BadRequestException('Booking is not in AWAITING_CONFIRMATION state');
    }

    await this.db.query(
      `UPDATE public.bookings
       SET status='CANCELLED', notes=COALESCE($1, notes), updated_at=now()
       WHERE id=$2`,
      [reason ? `Rejected: ${reason}` : null, bookingId],
    );
    return { success: true };
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

  /** Send 6-digit OTP to customer email */
  async sendEmailOtp(customerId: string, tenantId: string): Promise<{ sent: boolean }> {
    const rows = await this.db.query(
      `SELECT id, email, first_name FROM public.customers WHERE id = $1 AND tenant_id = $2`,
      [customerId, tenantId],
    );
    if (!rows.length) throw new Error('Customer not found');
    const customer = rows[0];

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await this.db.query(
      `UPDATE public.customers SET email_otp = $1, email_otp_expires_at = $2 WHERE id = $3`,
      [otp, expiresAt.toISOString(), customerId],
    );

    // Send via notification system
    await this.notificationService.handleEvent('CustomerEmailVerification', {
      customer_id: customerId,
      tenant_id: tenantId,
      otp,
      first_name: customer.first_name,
      email: customer.email,
    }).catch(() => {});

    return { sent: true };
  }

  /** Verify OTP submitted by customer */
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

  /** Check if customer email is verified */
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
