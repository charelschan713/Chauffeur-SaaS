import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PricingResolver } from '../pricing/pricing.resolver';
import { NotificationService } from '../notification/notification.service';
import { DebugTraceService } from '../debug/debug-trace.service';
import { randomUUID } from 'crypto';

@Injectable()
export class BookingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly pricing: PricingResolver,
    private readonly notificationService: NotificationService,
    private readonly trace: DebugTraceService,
  ) {}

  async listBookings(tenantId: string, query: Record<string, any>) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(Math.max(Number(query.limit ?? 20), 1), 100);
    const offset = (page - 1) * limit;

    let where = 'WHERE b.tenant_id = $1';
    const params: any[] = [tenantId];
    let index = 2;

    if (query.operational_status) {
      where += ` AND b.operational_status = ANY($${index}::operational_status_enum[])`;
      params.push(String(query.operational_status).split(','));
      index++;
    }

    if (query.date_from) {
      where += ` AND b.pickup_at_utc >= $${index}`;
      params.push(query.date_from);
      index++;
    }

    if (query.date_to) {
      where += ` AND b.pickup_at_utc <= $${index}`;
      params.push(query.date_to);
      index++;
    }

    if (query.search) {
      where += ` AND (b.booking_reference ILIKE $${index} OR b.customer_first_name ILIKE $${index} OR b.customer_last_name ILIKE $${index})`;
      params.push(`%${query.search}%`);
      index++;
    }

    const countResult = await this.dataSource.query(
      `SELECT COUNT(*) FROM public.bookings b ${where}`,
      params,
    );
    const total = Number(countResult[0]?.count ?? 0);

    const data = await this.dataSource.query(
      `SELECT 
        b.id,
        b.booking_reference,
        b.booking_source,
        b.customer_first_name,
        b.customer_last_name,
        b.passenger_first_name,
        b.passenger_last_name,
        b.passenger_phone_country_code,
        b.passenger_phone_number,
        b.passenger_is_customer,
        b.operational_status,
        b.payment_status,
        b.pickup_at_utc,
        b.timezone,
        b.pickup_address_text,
        b.dropoff_address_text,
        b.total_price_minor,
        b.currency,
        b.owner_tenant_id,
        b.executor_tenant_id,
        b.transfer_source_tenant_name_snapshot,
        a.driver_id,
        a.status as assignment_status,
        a.driver_execution_status
       FROM public.bookings b
       LEFT JOIN public.assignments a
         ON a.booking_id = b.id
         AND a.status NOT IN ('CANCELLED','DECLINED','EXPIRED')
       ${where}
       ORDER BY b.pickup_at_utc DESC
       LIMIT $${index} OFFSET $${index + 1}`,
      [...params, limit, offset],
    );

    return {
      data,
      meta: {
        page,
        limit,
        total,
        has_next: page * limit < total,
      },
    };
  }

  async getBookingDetail(tenantId: string, bookingId: string) {
    const bookings = await this.dataSource.query(
      `SELECT b.*,
              tst.name  AS service_type_name,
              tsc.name  AS service_class_name
         FROM public.bookings b
         LEFT JOIN public.tenant_service_types tst ON tst.id = b.service_type_id
         LEFT JOIN public.tenant_service_classes tsc ON tsc.id = b.service_class_id
        WHERE b.id = $1 AND b.tenant_id = $2`,
      [bookingId, tenantId],
    );
    if (!bookings.length) throw new NotFoundException('Booking not found');
    const booking = bookings[0];

    const [history, assignments, payments, savedCard] = await Promise.all([
      this.dataSource.query(
        `SELECT * FROM public.booking_status_history
         WHERE booking_id = $1
         ORDER BY created_at ASC`,
        [bookingId],
      ),
      this.dataSource.query(
        `SELECT a.*, u.full_name as driver_name,
                tv.plate as vehicle_plate,
                pv.make as vehicle_make,
                pv.model as vehicle_model,
                a.leg,
                COALESCE(dp.source_type, 'INTERNAL')   AS driver_source_type,
                COALESCE(dp.approval_status, 'APPROVED') AS driver_approval_status,
                COALESCE(dp.platform_verified, false)  AS driver_platform_verified,
                COALESCE(tv.source_type, 'INTERNAL')   AS vehicle_source_type,
                COALESCE(tv.approval_status, 'APPROVED') AS vehicle_approval_status,
                COALESCE(tv.platform_verified, false)  AS vehicle_platform_verified
           FROM public.assignments a
           LEFT JOIN public.users u ON u.id = a.driver_id
           LEFT JOIN public.driver_profiles dp ON dp.user_id = a.driver_id
           LEFT JOIN public.tenant_vehicles tv ON tv.id = a.vehicle_id
           LEFT JOIN public.platform_vehicles pv ON pv.id = tv.platform_vehicle_id
          WHERE a.booking_id = $1
          ORDER BY a.created_at DESC`,
        [bookingId],
      ),
      this.dataSource.query(
        `SELECT * FROM public.payments
          WHERE booking_id = $1
          ORDER BY created_at ASC`,
        [bookingId],
      ),
      // Check if customer has a saved Stripe payment method
      booking.customer_id ? this.dataSource.query(
        `SELECT spm.id, spm.stripe_payment_method_id, spm.card_brand, spm.card_last4, spm.card_exp_month, spm.card_exp_year
           FROM public.saved_payment_methods spm
           JOIN public.customers c ON c.id = spm.customer_id
          WHERE c.id = $1
          ORDER BY spm.created_at DESC LIMIT 1`,
        [booking.customer_id],
      ).catch(() => []) : Promise.resolve([]),
    ]);

    const summary = payments.length
      ? {
          authorized_minor: payments[0].amount_authorized_minor ?? 0,
          captured_minor: payments[0].amount_captured_minor ?? 0,
          refunded_minor: payments[0].amount_refunded_minor ?? 0,
          currency: payments[0].currency ?? 'AUD',
        }
      : null;

    return {
      booking,
      status_history: history,
      assignments,
      payments: payments.length
        ? { summary, items: payments }
        : null,
      saved_card: savedCard?.[0] ?? null,
    };
  }

  async createBooking(tenantId: string, dto: any) {
    const id = randomUUID();
    const now = new Date().toISOString();
    const pickupAtUtc = dto.pickup_at_utc ?? dto.pickupAtUtc;
    if (!pickupAtUtc) throw new Error('pickup_at_utc is required');

    this.trace.traceInfo('BOOKING_CREATE_START', {
      tenant_id: tenantId,
      booking_id: id,
      message: 'Booking creation started',
      context: { customer_email: dto.customer_email ?? dto.email, total_price_minor: dto.total_price_minor ?? dto.totalPriceMinor, source: dto.booking_source ?? 'ADMIN' },
    });
    const pickupTimezone = dto.timezone || 'Australia/Sydney';

    // Fetch tenant booking_ref_prefix
    const tenantRows = await this.dataSource.query(
      `SELECT booking_ref_prefix FROM public.tenants WHERE id = $1`,
      [tenantId],
    );
    const refPrefix = tenantRows[0]?.booking_ref_prefix?.trim().toUpperCase() || 'BK';

    // Fetch toll_enabled flag from service TYPE (not car type)
    let tollEnabled = false;
    if (dto.service_type_id) {
      const stRows = await this.dataSource.query(
        `SELECT toll_enabled FROM public.tenant_service_types
         WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
        [dto.service_type_id, tenantId],
      );
      tollEnabled = stRows[0]?.toll_enabled ?? false;
    }

    const pricingContext: any = {
      tenantId,
      serviceClassId: dto.service_class_id,
      serviceTypeId: dto.service_type_id ?? null,
      distanceKm: dto.distance_km ?? 0,
      durationMinutes: dto.duration_minutes ?? 0,
      waypointsCount: Array.isArray(dto.waypoints) ? dto.waypoints.length : 0,
      babyseatCount: (dto.infant_seats ?? 0) + (dto.toddler_seats ?? 0) + (dto.booster_seats ?? 0) + (dto.babyseat_count ?? 0),
      infantSeats:  dto.infant_seats  ?? 0,
      toddlerSeats: dto.toddler_seats ?? 0,
      boosterSeats: dto.booster_seats ?? 0,
      requestedAtUtc: new Date(pickupAtUtc),
      currency: dto.currency ?? 'AUD',
      customerId: dto.customer_id ?? null,
      tripType: dto.is_return_trip ? 'RETURN' : 'ONE_WAY' as const,
      returnDistanceKm: dto.return_distance_km ?? null,
      returnDurationMinutes: dto.return_duration_minutes ?? null,
      bookedHours: dto.booked_hours ?? null,
      tollEnabled,
      pickupAddress: dto.pickup_address_text ?? null,
      dropoffAddress: dto.dropoff_address_text ?? null,
    };

    let pricing: any;
    try {
      pricing = await this.pricing.resolve(pricingContext);
    } catch (err: any) {
      throw new Error(`Pricing resolve failed: ${err?.message ?? String(err)}`);
    }

    let bookingRows: any[];
    try {
    bookingRows = await this.dataSource.query(
      `INSERT INTO public.bookings
       (id, tenant_id, booking_reference, booking_source,
        customer_first_name, customer_last_name, customer_email,
        customer_phone_country_code, customer_phone_number,
        pickup_address_text, pickup_lat, pickup_lng, pickup_place_id,
        dropoff_address_text, dropoff_lat, dropoff_lng, dropoff_place_id,
        pickup_at_utc, timezone, passenger_count, luggage_count,
        special_requests, pricing_snapshot, total_price_minor, currency,
        operational_status, payment_status,
        estimated_duration_seconds, created_at, updated_at,
        passenger_first_name, passenger_last_name,
        passenger_phone_country_code, passenger_phone_number,
        passenger_is_customer,
        customer_id, passenger_id,
        is_return_trip, return_pickup_at_utc, return_pickup_address_text,
        return_pickup_lat, return_pickup_lng, return_pickup_place_id,
        service_class_id, service_type_id,
        infant_seats, toddler_seats, booster_seats
       )
       VALUES ($1,$2,$3,$4,
               $5,$6,$7,
               $8,$9,
               $10,$11,$12,$13,
               $14,$15,$16,$17,
               $18,$19,$20,$21,
               $22,$23,$24,$25,
               $26,$27,
               $28,$29,
               $30,$31,
               $32,$33,
               $34,
               $35,$36,
               $37,$38,$39,
               $40,$41,$42,
               $43,$44,
               $45,$46,$47,$48
       )
       RETURNING *`,
      [
        id,
        tenantId,
        dto.booking_reference ?? `${refPrefix}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        dto.booking_source ?? 'ADMIN',
        dto.customer_first_name,
        dto.customer_last_name,
        dto.customer_email ?? null,
        dto.customer_phone_country_code ?? null,
        dto.customer_phone_number ?? null,
        dto.pickup_address_text,
        dto.pickup_lat ?? null,
        dto.pickup_lng ?? null,
        dto.pickup_place_id ?? null,
        dto.dropoff_address_text,
        dto.dropoff_lat ?? null,
        dto.dropoff_lng ?? null,
        dto.dropoff_place_id ?? null,
        pickupAtUtc,
        pickupTimezone,
        dto.passenger_count ?? 1,
        dto.luggage_count ?? 0,
        dto.special_requests ?? null,
        pricing,
        pricing.totalPriceMinor ?? 0,
        pricing.currency ?? 'AUD',
        dto.operational_status ?? 'PENDING_CUSTOMER_CONFIRMATION',
        dto.payment_status ?? 'UNPAID',
        dto.estimated_duration_seconds ?? null,
        now,
        now,
        dto.passenger_first_name ?? dto.customer_first_name,
        dto.passenger_last_name ?? dto.customer_last_name,
        dto.passenger_phone_country_code ?? null,
        dto.passenger_phone_number ?? null,
        dto.passenger_is_customer ?? true,
        dto.customer_id ?? null,
        dto.passenger_id ?? null,
        dto.is_return_trip ?? false,
        dto.return_pickup_at_utc ?? null,
        dto.return_pickup_address_text ?? null,
        dto.return_pickup_lat ?? null,
        dto.return_pickup_lng ?? null,
        dto.return_pickup_place_id ?? null,
        dto.service_class_id ?? null,
        dto.service_type_id ?? null,
        dto.infant_seats  ?? 0,
        dto.toddler_seats ?? 0,
        dto.booster_seats ?? 0,
      ],
    );
    } catch (err: any) {
      this.trace.traceError('BOOKING_CREATE_FAILED', {
        tenant_id: tenantId, booking_id: id,
        message: 'Booking INSERT failed',
        error: err,
        context: { customer_email: dto.customer_email ?? dto.email },
      });
      throw new Error(`Booking INSERT failed: ${err?.message ?? String(err)}`);
    }

    this.trace.traceInfo('BOOKING_SAVED', {
      tenant_id: tenantId, booking_id: id,
      message: 'Booking saved to DB',
      context: { booking_reference: bookingRows[0]?.booking_reference, status: dto.operational_status ?? 'PENDING_CUSTOMER_CONFIRMATION' },
    });

    await this.dataSource.query(
      `INSERT INTO public.booking_status_history
       (id, tenant_id, booking_id, previous_status, new_status, triggered_by, reason, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [randomUUID(), tenantId, id, null, dto.operational_status ?? 'PENDING_CUSTOMER_CONFIRMATION', null, null, now],
    );

    // Fire notifications (non-blocking)
    const notifPayload = { tenant_id: tenantId, booking_id: id };
    this.notificationService.handleEvent('AdminNewBooking', notifPayload)
      .catch((e) => console.error('[Notification] AdminNewBooking FAILED:', e?.message));
    this.notificationService.handleEvent('AdminBookingPendingConfirm', notifPayload)
      .catch((e) => console.error('[Notification] AdminBookingPendingConfirm FAILED:', e?.message));

    // Auto-generate payment token + send payment request email to customer
    const status = dto.operational_status ?? 'PENDING_CUSTOMER_CONFIRMATION';
    if (status === 'PENDING_CUSTOMER_CONFIRMATION') {
      this.sendPaymentLink(tenantId, id)
        .catch((e) => console.error('[Notification] Auto payment link FAILED:', e?.message));
    } else if (status === 'CONFIRMED') {
      this.notificationService.handleEvent('BookingConfirmed', notifPayload)
        .catch((e) => console.error('[Notification] BookingConfirmed FAILED:', e?.message));
    }

    return bookingRows[0];
  }

  async transition(
    bookingId: string,
    newStatus: string,
    userId: string,
    reason?: string,
  ) {
    const bookings = await this.dataSource.query(
      `SELECT tenant_id, operational_status FROM public.bookings WHERE id = $1`,
      [bookingId],
    );
    if (!bookings.length) throw new NotFoundException('Booking not found');
    const booking = bookings[0];

    if (newStatus === booking.operational_status) return { success: true };

    await this.dataSource.query(
      `UPDATE public.bookings
       SET operational_status = $1,
           updated_at = now()
       WHERE id = $2`,
      [newStatus, bookingId],
    );

    await this.dataSource.query(
      `INSERT INTO public.booking_status_history
       (id, tenant_id, booking_id, previous_status, new_status, triggered_by, reason, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [randomUUID(), booking.tenant_id, bookingId, booking.operational_status, newStatus, userId, reason ?? null, new Date().toISOString()],
    );

    // Fire notifications based on new status
    const notifPayload = { tenant_id: booking.tenant_id, booking_id: bookingId };
    if (newStatus === 'CONFIRMED') {
      this.notificationService.handleEvent('BookingConfirmed', notifPayload)
        .catch((e) => console.error('[Notification] BookingConfirmed (transition) FAILED:', e?.message));
    } else if (newStatus === 'CANCELLED') {
      this.notificationService.handleEvent('BookingCancelled', { ...notifPayload, cancelled_by: 'admin' })
        .catch((e) => console.error('[Notification] BookingCancelled (transition) FAILED:', e?.message));
    } else if (newStatus === 'COMPLETED' || newStatus === 'FULFILLED') {
      this.notificationService.handleEvent('JobCompleted', notifPayload)
        .catch((e) => console.error('[Notification] JobCompleted (transition) FAILED:', e?.message));
    }

    return { success: true };
  }

  async cancelBooking(tenantId: string, bookingId: string, actor: string) {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `SELECT id, operational_status FROM public.bookings WHERE id = $1 AND tenant_id = $2`,
        [bookingId, tenantId],
      );
      if (!rows.length) throw new NotFoundException('Booking not found');
      const booking = rows[0];

      if (['CANCELLED', 'COMPLETED', 'FULFILLED'].includes(booking.operational_status)) {
        return { success: true };
      }

      const updated = await manager.query(
        `UPDATE public.bookings
         SET operational_status = 'CANCELLED',
             updated_at = now()
         WHERE id = $1
           AND operational_status NOT IN ('COMPLETED','FULFILLED','CANCELLED')
         RETURNING id`,
        [bookingId],
      );
      if (!updated.length) {
        // Race condition: status changed between SELECT and UPDATE
        throw new Error('Booking cannot be cancelled in its current status');
      }

      await manager.query(
        `INSERT INTO public.booking_status_history
         (id, tenant_id, booking_id, previous_status, new_status, triggered_by, reason, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [randomUUID(), tenantId, bookingId, booking.operational_status, 'CANCELLED', actor, null, new Date().toISOString()],
      );

      // Fire cancellation notification (non-blocking)
      this.notificationService.handleEvent('BookingCancelled', { tenant_id: booking.tenant_id ?? tenantId, booking_id: bookingId, cancelled_by: 'admin' })
        .catch((e) => console.error('[Notification] BookingCancelled FAILED:', e?.message ?? e));

      return { success: true };
    });
  }

  async fulfilBooking(
    tenantId: string,
    bookingId: string,
    adminId: string,
    body: { extra_amount_minor?: number; note?: string },
  ) {
    const rows = await this.dataSource.query(
      `SELECT id, total_price_minor, currency, operational_status
       FROM public.bookings WHERE id = $1 AND tenant_id = $2`,
      [bookingId, tenantId],
    );
    if (!rows.length) throw new NotFoundException('Booking not found');
    const booking = rows[0];

    if (!['COMPLETED', 'job_done'].includes(booking.operational_status)) {
      // Allow fulfil from COMPLETED or any terminal job state
    }

    const extraMinor = body.extra_amount_minor ?? 0;
    const actualTotal = Number(booking.total_price_minor) + extraMinor;

    await this.dataSource.query(
      `UPDATE public.bookings
       SET operational_status   = 'FULFILLED',
           actual_total_minor   = $1,
           adjustment_amount_minor = $2,
           adjustment_status    = CASE WHEN $2 > 0 THEN 'CAPTURED' ELSE 'NONE' END,
           settled_at           = NOW(),
           updated_at           = NOW()
       WHERE id = $3`,
      [actualTotal, extraMinor, bookingId],
    );

    // Log status history
    await this.dataSource.query(
      `INSERT INTO public.booking_status_history
       (id, tenant_id, booking_id, previous_status, new_status, triggered_by, reason, created_at)
       VALUES (gen_random_uuid(),$1,$2,$3,'FULFILLED',$4,$5,NOW())`,
      [tenantId, bookingId, booking.operational_status, adminId, body.note ?? null],
    ).catch(() => {});

    // TODO: trigger Stripe charge for extraMinor if > 0 + send fulfilled email

    return { success: true, actual_total_minor: actualTotal };
  }

  async markPaid(tenantId: string, bookingId: string) {
    await this.dataSource.query(
      `UPDATE public.bookings SET payment_status = 'PAID', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [bookingId, tenantId],
    );
    return { success: true };
  }

  async sendPaymentLink(tenantId: string, bookingId: string) {
    const rows = await this.dataSource.query(
      `SELECT id, customer_email, customer_first_name, total_price_minor, currency, booking_reference, pickup_at_utc
       FROM public.bookings WHERE id = $1 AND tenant_id = $2`,
      [bookingId, tenantId],
    );
    if (!rows.length) throw new NotFoundException('Booking not found');
    const booking = rows[0];

    // Generate payment token (TTL = min(24h, pickup time))
    const now = new Date();
    const pickup = new Date(booking.pickup_at_utc);
    const maxExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const expiry = pickup > now && pickup < maxExpiry ? pickup : maxExpiry;
    const token = randomUUID();

    await this.dataSource.query(
      `UPDATE public.bookings SET payment_token = $1, payment_token_expires_at = $2, updated_at = NOW()
       WHERE id = $3`,
      [token, expiry.toISOString(), bookingId],
    );

    // Fire notification to customer with payment link
    const portalUrl = process.env.CUSTOMER_PORTAL_URL ?? 'https://aschauffeured.chauffeurssolution.com';
    const paymentUrl = `${portalUrl}/pay/${token}`;
    this.notificationService.handleEvent('AdminCreatedPaymentRequest', {
      tenant_id: tenantId,
      booking_id: bookingId,
      payment_link: paymentUrl,
      payment_url:  paymentUrl,
    }).catch((e) => console.error('[Notification] AdminCreatedPaymentRequest FAILED:', e?.message));

    return { success: true, token, expires_at: expiry.toISOString(), payment_url: paymentUrl };
  }

  async chargeNow(tenantId: string, bookingId: string) {
    throw new BadRequestException('Stripe charge not yet configured. Use "Send Payment Link" or "Mark as Paid".');
  }

  // ── Confirm and charge off-session (AWAITING_CONFIRMATION → CONFIRMED/PAYMENT_FAILED) ──
  async confirmAndCharge(tenantId: string, bookingId: string) {
    const rows = await this.dataSource.query(
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

    const pmRows = await this.dataSource.query(
      `SELECT stripe_payment_method_id FROM public.saved_payment_methods
       WHERE customer_id=$1 AND tenant_id=$2 AND is_default=true LIMIT 1`,
      [b.customer_id, tenantId],
    );
    if (!pmRows.length) throw new BadRequestException('No default payment method saved');

    // Get tenant Stripe key
    const intRows = await this.dataSource.query(
      `SELECT config FROM public.tenant_integrations WHERE tenant_id=$1 AND type='stripe' LIMIT 1`,
      [tenantId],
    );
    const secretKey = intRows[0]?.config?.secret_key ?? process.env.STRIPE_SECRET_KEY;
    if (!secretKey) throw new BadRequestException('Stripe not configured');

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(secretKey);

    try {
      const pi = await stripe.paymentIntents.create({
        amount: b.total_price_minor,
        currency: (b.currency ?? 'AUD').toLowerCase(),
        customer: b.stripe_customer_id,
        payment_method: pmRows[0].stripe_payment_method_id,
        confirm: true,
        off_session: true,
      });

      await this.dataSource.query(
        `UPDATE public.bookings
         SET status='CONFIRMED', payment_status='PAID',
             stripe_payment_intent_id=$1, payment_captured_at=now(), updated_at=now()
         WHERE id=$2`,
        [pi.id, bookingId],
      );
      return { success: true, paymentIntentId: pi.id };
    } catch (err: any) {
      await this.dataSource.query(
        `UPDATE public.bookings SET status='PAYMENT_FAILED', updated_at=now() WHERE id=$1`,
        [bookingId],
      );
      return { success: false, error: err.message };
    }
  }

  // ── Reject booking (AWAITING_CONFIRMATION → CANCELLED) ────────────────────
  async rejectBooking(tenantId: string, bookingId: string, reason?: string) {
    const rows = await this.dataSource.query(
      `SELECT status FROM public.bookings WHERE id=$1 AND tenant_id=$2`,
      [bookingId, tenantId],
    );
    if (!rows.length) throw new NotFoundException('Booking not found');
    if (rows[0].status !== 'AWAITING_CONFIRMATION') {
      throw new BadRequestException('Booking is not in AWAITING_CONFIRMATION state');
    }
    await this.dataSource.query(
      `UPDATE public.bookings
       SET status='CANCELLED', notes=COALESCE($1, notes), updated_at=now()
       WHERE id=$2`,
      [reason ? `Rejected: ${reason}` : null, bookingId],
    );
    return { success: true };
  }

  // ── Finalize (enter actual amounts from driver report) ────────────────────
  async finalizeBooking(tenantId: string, bookingId: string, adminId: string, body: any) {
    const rows = await this.dataSource.query(
      `SELECT * FROM public.bookings WHERE id=$1 AND tenant_id=$2`,
      [bookingId, tenantId],
    );
    if (!rows.length) throw new NotFoundException('Booking not found');

    // Save driver report if provided
    if (body.driverReport) {
      const dr = body.driverReport;
      await this.dataSource.query(
        `INSERT INTO public.driver_reports
           (booking_id, driver_id, tenant_id, actual_distance_km, actual_duration_minutes,
            actual_toll_minor, actual_parking_minor, waiting_time_minutes, notes, reviewed_by, reviewed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
         ON CONFLICT DO NOTHING`,
        [
          bookingId, dr.driverId ?? adminId, tenantId,
          dr.distanceKm ?? null, dr.durationMinutes ?? null,
          dr.tollMinor ?? 0, dr.parkingMinor ?? 0,
          dr.waitingMinutes ?? 0, dr.notes ?? null, adminId,
        ],
      );
    }

    await this.dataSource.query(
      `UPDATE public.bookings
       SET actual_base_fare_minor=COALESCE($1, prepay_base_fare_minor),
           actual_extras_minor=COALESCE($2, prepay_extras_minor),
           actual_total_minor=COALESCE($3, total_price_minor),
           updated_at=now()
       WHERE id=$4`,
      [
        body.actualBaseFareMinor ?? null,
        body.actualExtrasMinor ?? null,
        body.actualTotalMinor ?? null,
        bookingId,
      ],
    );

    return { success: true };
  }

  // ── Settle (charge/refund difference after finalize) ──────────────────────
  async settleBooking(tenantId: string, bookingId: string, adminId: string, body: any) {
    const rows = await this.dataSource.query(
      `SELECT b.*, c.stripe_customer_id
       FROM public.bookings b
       JOIN public.customers c ON c.id = b.customer_id
       WHERE b.id=$1 AND b.tenant_id=$2`,
      [bookingId, tenantId],
    );
    if (!rows.length) throw new NotFoundException('Booking not found');
    const b = rows[0];

    const adjustmentMinor = (b.actual_total_minor ?? 0) - (b.prepay_total_minor ?? 0);

    await this.dataSource.query(
      `UPDATE public.bookings
       SET adjustment_amount_minor=$1, adjustment_status='SETTLED',
           settled_at=now(), updated_at=now()
       WHERE id=$2`,
      [adjustmentMinor, bookingId],
    );

    return { success: true, adjustmentMinor };
  }
}
