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
        `SELECT first_name, last_name, email, phone_country_code, phone_number FROM public.customers WHERE id=$1`,
        [customerId],
      ),
    ]);
    return { customer: customer[0], upcoming: upcomingRows, past: pastRows };
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

      // Get final price + pricing breakdown from quote result for requested car type
      if (payload.results?.length) {
        const result = (dto.vehicleClassId
          ? payload.results.find((r: any) => r.service_class_id === dto.vehicleClassId)
          : null) ?? payload.results[0];
        if (result) {
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

    // Extract toll/parking breakdown from pricing snapshot
    const tollMinor    = pricingSnapshot?.toll_minor    ?? 0;
    const parkingMinor = pricingSnapshot?.parking_minor ?? 0;
    const baseFareMinor = pricingSnapshot?.base_calculated_minor ?? (totalPriceMinor - tollMinor - parkingMinor);

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
          created_at, updated_at)
       VALUES
         ($1, $2, $3, 'WIDGET',
          $4, $5, $6, $7, $8,
          $5, $6, $7, $8, true,
          $9, $10, $11,
          'Australia/Sydney',
          $12, $13,
          $14, $15,
          $16, $17, $18, $14,
          $19,
          'PENDING_CUSTOMER_CONFIRMATION', 'UNPAID',
          $20, $21, $22, $23,
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
      `SELECT id, first_name, last_name, email, phone_country_code, phone_number, created_at
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
      `SELECT id, brand, last4, exp_month, exp_year, is_default
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
      automatic_payment_methods: { enabled: true },
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
      `SELECT b.id, b.tenant_id, b.customer_id, b.total_price_minor, b.currency, b.payment_status, b.booking_reference
       FROM public.bookings b WHERE b.payment_token=$1 AND b.payment_token_expires_at > NOW()`,
      [token],
    );
    if (!rows.length) throw new NotFoundException('Payment link not found');
    const b = rows[0];
    if (b.payment_status === 'PAID') throw new BadRequestException('Already paid');

    const stripe = await this.getStripe(b.tenant_id);
    const appUrl = process.env.CUSTOMER_APP_URL ?? 'https://aschauffeured.chauffeurssolution.com';

    // Look up Stripe customer ID if using a saved card (PM belongs to a customer)
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

    // Immediately succeeded (no 3DS required)
    if (pi.status === 'succeeded') {
      await this.markBookingPaid(b.id, pi.id);
    }

    // 3DS required — return clientSecret so frontend can call handleNextAction
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
    if (b.payment_status === 'PAID') return { success: true };

    const stripe = await this.getStripe(b.tenant_id);
    const pi = await stripe.paymentIntents.retrieve(dto.paymentIntentId);
    if (pi.status !== 'succeeded') throw new BadRequestException(`Payment not completed: ${pi.status}`);

    await this.markBookingPaid(b.id, pi.id);
    return { success: true };
  }

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
      // Notify customer: booking confirmed
      this.notificationService.handleEvent('BookingConfirmed', notifPayload)
        .catch((e) => console.error('[Notification] BookingConfirmed (pay link) FAILED:', e?.message));
      // Notify admin: booking now confirmed + paid (delayed to avoid rate limit)
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

    const tenant = await this.db.query(
      `SELECT id, booking_ref_prefix FROM public.tenants WHERE slug=$1 LIMIT 1`,
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

    const guestTollMinor    = guestPricingSnapshot?.toll_minor    ?? 0;
    const guestParkingMinor = guestPricingSnapshot?.parking_minor ?? 0;
    const guestBaseFare     = guestPricingSnapshot?.base_calculated_minor ?? (totalMinor - guestTollMinor - guestParkingMinor);

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
            $16, $17, $18, $14,
            $19,
            'PENDING_CUSTOMER_CONFIRMATION', 'UNPAID',
            $20, $21,
            $22, $23,
            $24, $25, $26,
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
