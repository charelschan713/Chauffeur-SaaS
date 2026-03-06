import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import Stripe from 'stripe';

@Injectable()
export class CustomerPortalService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  // ── Stripe helper ─────────────────────────────────────────────────────────
  private async getStripe(tenantId: string): Promise<Stripe> {
    // 1. Check tenant_integrations (legacy path)
    const intRows = await this.db.query(
      `SELECT config FROM public.tenant_integrations
       WHERE tenant_id=$1 AND integration_type='stripe' AND active=true LIMIT 1`,
      [tenantId],
    );
    let secretKey: string | undefined = intRows[0]?.config?.secret_key;

    // 2. Fall back to tenant_settings.stripe_secret_key
    if (!secretKey) {
      const settingRows = await this.db.query(
        `SELECT stripe_secret_key FROM public.tenant_settings
         WHERE tenant_id=$1 LIMIT 1`,
        [tenantId],
      );
      secretKey = settingRows[0]?.stripe_secret_key;
    }

    // 3. Fall back to platform-level env var
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
        `SELECT id, booking_reference, status, pickup_at_utc, pickup_address,
                dropoff_address, total_price_minor, currency, booked_by
         FROM public.bookings
         WHERE customer_id=$1 AND tenant_id=$2
           AND status NOT IN ('CANCELLED','COMPLETED','NO_SHOW')
           AND pickup_at_utc > now()
         ORDER BY pickup_at_utc ASC LIMIT 5`,
        [customerId, tenantId],
      ),
      this.db.query(
        `SELECT id, booking_reference, status, pickup_at_utc, pickup_address,
                dropoff_address, total_price_minor, currency
         FROM public.bookings
         WHERE customer_id=$1 AND tenant_id=$2
           AND (status IN ('COMPLETED','CANCELLED','NO_SHOW') OR pickup_at_utc <= now())
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
    const params: any[] = [customerId, tenantId];
    let where = `WHERE b.customer_id=$1 AND b.tenant_id=$2`;
    if (query.status) {
      params.push(query.status);
      where += ` AND b.status=$${params.length}`;
    }
    const [rows, cnt] = await Promise.all([
      this.db.query(
        `SELECT b.id, b.booking_reference, b.status, b.pickup_at_utc,
                b.pickup_address, b.dropoff_address, b.total_price_minor,
                b.currency, b.payment_status, b.booked_by
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
    const rows = await this.db.query(
      `SELECT b.*
       FROM public.bookings b
       WHERE b.id=$1 AND b.customer_id=$2 AND b.tenant_id=$3`,
      [bookingId, customerId, tenantId],
    );
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

    if (dto.quoteId) {
      const [session] = await this.db.query(
        `SELECT id, payload FROM public.quote_sessions
         WHERE id = $1 AND tenant_id = $2 AND expires_at > now() LIMIT 1`,
        [dto.quoteId, tenantId],
      );
      if (!session) throw new BadRequestException('Quote expired or not found');

      const payload = session.payload;
      const req     = payload.request ?? {};

      pickupAddress   = pickupAddress   ?? req.pickup_address;
      dropoffAddress  = dropoffAddress  ?? req.dropoff_address;
      pickupAtUtc     = pickupAtUtc     ?? req.pickup_at_utc ?? req.pickup_at;
      serviceTypeId   = serviceTypeId   ?? req.service_type_id ?? null;
      vehicleClassId  = dto.vehicleClassId ?? null;
      currency        = currency        ?? payload.currency ?? 'AUD';
      passengerCount  = passengerCount  ?? req.passenger_count ?? 1;
      quoteSessionId  = session.id;

      // Get final price from quote result for requested car type
      if (dto.vehicleClassId && payload.results?.length) {
        const result = payload.results.find((r: any) => r.service_class_id === dto.vehicleClassId)
          ?? payload.results[0];
        if (result) {
          totalPriceMinor = dto.totalPriceMinor ?? result.estimated_total_minor;
        }
      }
    }

    const ref = `BK-${Date.now().toString(36).toUpperCase()}`;
    const [booking] = await this.db.query(
      `INSERT INTO public.bookings
         (tenant_id, customer_id, customer_email, customer_first_name, customer_last_name,
          customer_phone, pickup_address, dropoff_address, pickup_at_utc,
          service_type_id, vehicle_class_id, total_price_minor, currency,
          status, payment_status, booked_by, booking_reference,
          flight_number, passenger_count, notes, created_at, updated_at)
       VALUES
         ($1, $2,
          (SELECT email FROM public.customers WHERE id=$2),
          (SELECT first_name FROM public.customers WHERE id=$2),
          (SELECT last_name FROM public.customers WHERE id=$2),
          (SELECT phone_number FROM public.customers WHERE id=$2),
          $3, $4, $5, $6, $7, $8, $9,
          'AWAITING_CONFIRMATION', 'UNPAID', 'CUSTOMER', $10,
          $11, $12, $13, now(), now())
       RETURNING *`,
      [
        tenantId, customerId,
        pickupAddress, dropoffAddress, pickupAtUtc,
        serviceTypeId, vehicleClassId,
        totalPriceMinor, currency,
        ref,
        flightNumber,
        passengerCount,
        notes,
      ],
    );

    // Mark quote as converted
    if (quoteSessionId) {
      await this.db.query(
        `UPDATE public.quote_sessions SET converted_at = now() WHERE id = $1`,
        [quoteSessionId],
      ).catch(() => {});
    }

    return booking;
  }

  // ── Cancel booking ────────────────────────────────────────────────────────
  async cancelBooking(customerId: string, tenantId: string, bookingId: string) {
    const rows = await this.db.query(
      `SELECT id, status, pickup_at_utc FROM public.bookings
       WHERE id=$1 AND customer_id=$2 AND tenant_id=$3`,
      [bookingId, customerId, tenantId],
    );
    if (!rows.length) throw new NotFoundException('Booking not found');
    const b = rows[0];
    if (!['DRAFT', 'PENDING', 'CONFIRMED', 'AWAITING_CONFIRMATION'].includes(b.status)) {
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
      `UPDATE public.bookings SET status='CANCELLED', updated_at=now() WHERE id=$1`,
      [bookingId],
    );
    return { success: true };
  }

  // ── Profile ───────────────────────────────────────────────────────────────
  async getProfile(customerId: string) {
    const rows = await this.db.query(
      `SELECT id, first_name, last_name, email, phone_country_code, phone_number, created_at FROM public.customers WHERE id=$1`,
      [customerId],
    );
    if (!rows.length) throw new NotFoundException('Customer not found');
    return rows[0];
  }

  async updateProfile(customerId: string, dto: any) {
    await this.db.query(
      `UPDATE public.customers
       SET first_name=COALESCE($1, first_name),
           last_name=COALESCE($2, last_name),
           phone_number=COALESCE($3, phone_number),
           updated_at=now()
       WHERE id=$4`,
      [dto.firstName ?? null, dto.lastName ?? null, dto.phone ?? null, customerId],
    );
    return this.getProfile(customerId);
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

    // If booking attached, update to AWAITING_CONFIRMATION
    if (dto.bookingId) {
      await this.db.query(
        `UPDATE public.bookings
         SET status='AWAITING_CONFIRMATION',
             stripe_setup_intent_id=$1,
             updated_at=now()
         WHERE id=$2 AND customer_id=$3 AND tenant_id=$4`,
        [dto.setupIntentId, dto.bookingId, customerId, tenantId],
      );
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
      `SELECT b.id, b.booking_reference, b.total_price_minor, b.currency,
              b.customer_first_name, b.status, b.payment_status,
              b.pickup_address, b.dropoff_address, b.pickup_at_utc
       FROM public.bookings b
       WHERE b.payment_link_token=$1`,
      [token],
    );
    if (!rows.length) throw new NotFoundException('Payment link not found');
    return rows[0];
  }

  async payViaToken(token: string, dto: { paymentMethodId: string }) {
    const rows = await this.db.query(
      `SELECT b.id, b.tenant_id, b.total_price_minor, b.currency, b.payment_status
       FROM public.bookings b WHERE b.payment_link_token=$1`,
      [token],
    );
    if (!rows.length) throw new NotFoundException('Payment link not found');
    const b = rows[0];
    if (b.payment_status === 'PAID') throw new BadRequestException('Already paid');

    const stripe = await this.getStripe(b.tenant_id);
    const pi = await stripe.paymentIntents.create({
      amount: b.total_price_minor,
      currency: b.currency.toLowerCase(),
      payment_method: dto.paymentMethodId,
      confirm: true,
      return_url: `${process.env.CUSTOMER_APP_URL ?? 'http://localhost:3001'}/pay/success`,
    });

    if (pi.status === 'succeeded') {
      await this.db.query(
        `UPDATE public.bookings
         SET status='CONFIRMED', payment_status='PAID',
             stripe_payment_intent_id=$1, payment_captured_at=now(), updated_at=now()
         WHERE id=$2`,
        [pi.id, b.id],
      );
    }

    return { success: pi.status === 'succeeded', status: pi.status, clientSecret: pi.client_secret };
  }

  // ── Invoices ──────────────────────────────────────────────────────────────
  async listInvoices(customerId: string, tenantId: string) {
    return this.db.query(
      `SELECT id, invoice_number, status, total_minor, currency, issued_at, due_date, paid_at
       FROM public.invoices
       WHERE customer_id=$1 AND tenant_id=$2
       ORDER BY issued_at DESC`,
      [customerId, tenantId],
    );
  }

  // ── Guest checkout ────────────────────────────────────────────────────────
  async guestCheckout(tenantSlug: string, dto: any) {
    const tenant = await this.db.query(
      `SELECT id FROM public.tenants WHERE slug=$1 LIMIT 1`,
      [tenantSlug],
    );
    if (!tenant.length) throw new NotFoundException('Tenant not found');
    const tenantId = tenant[0].id;

    // Create or find customer by email
    let customerId: string;
    const existing = await this.db.query(
      `SELECT id FROM public.customers WHERE tenant_id=$1 AND email=$2 LIMIT 1`,
      [tenantId, dto.email?.toLowerCase()],
    );
    if (existing.length) {
      customerId = existing[0].id;
    } else {
      const [c] = await this.db.query(
        `INSERT INTO public.customers (tenant_id, email, first_name, last_name, phone_number, is_guest, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,true,now(),now()) RETURNING id`,
        [tenantId, dto.email?.toLowerCase(), dto.firstName, dto.lastName, dto.phone ?? null],
      );
      customerId = c.id;
    }

    // Create booking
    const ref = `BK-${Date.now().toString(36).toUpperCase()}`;
    const [booking] = await this.db.query(
      `INSERT INTO public.bookings
         (tenant_id, customer_id, customer_email, customer_first_name, customer_last_name, customer_phone,
          pickup_address, dropoff_address, pickup_at_utc, service_type_id, vehicle_class_id,
          total_price_minor, currency, status, payment_status, booked_by, booking_reference,
          passenger_count, notes, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'AWAITING_CONFIRMATION','UNPAID','CUSTOMER',$14,$15,$16,now(),now())
       RETURNING *`,
      [
        tenantId, customerId,
        dto.email?.toLowerCase(), dto.firstName, dto.lastName, dto.phone ?? null,
        dto.pickupAddress, dto.dropoffAddress, dto.pickupAtUtc,
        dto.serviceTypeId ?? null, dto.vehicleClassId ?? null,
        dto.totalPriceMinor ?? 0, dto.currency ?? 'AUD',
        ref,
        dto.passengerCount ?? 1,
        dto.notes ?? null,
      ],
    );

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

  private async getStripeCustomerId(customerId: string): Promise<string | null> {
    const rows = await this.db.query(
      `SELECT stripe_customer_id FROM public.customers WHERE id=$1`,
      [customerId],
    );
    return rows[0]?.stripe_customer_id ?? null;
  }
}
