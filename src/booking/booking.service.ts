import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PricingResolver } from '../pricing/pricing.resolver';
import { NotificationService } from '../notification/notification.service';
import { TenantInvoiceService } from '../tenant/tenant-invoice.service';
import { DebugTraceService } from '../debug/debug-trace.service';
import { PaymentService } from '../payment/payment.service';
import { InvoicePdfService } from '../invoice/invoice-pdf.service';
import { randomUUID } from 'crypto';
import { Optional } from '@nestjs/common';
import { TripEvidenceService } from '../trip-evidence/trip-evidence.service';

// ─── Booking operational_status transition rules ──────────────────────────────
// Confirmed product decisions (2026-03-10 state-machine audit):
//   PAYMENT_FAILED = charge attempt failed; retryable via confirmAndCharge()
//   ACCEPTED / ON_THE_WAY / PENDING_ADMIN_CONFIRMATION = deprecated, never written
//
// Valid forward transitions:
const BOOKING_TRANSITION_RULES: Record<string, Set<string>> = {
  DRAFT:                         new Set(['PENDING', 'CONFIRMED', 'CANCELLED']),
  PENDING:                       new Set(['CONFIRMED', 'CANCELLED', 'PENDING_CUSTOMER_CONFIRMATION', 'ASSIGNED']),
  PENDING_CUSTOMER_CONFIRMATION: new Set(['CONFIRMED', 'CANCELLED', 'PAYMENT_FAILED']),
  AWAITING_ADMIN_REVIEW:         new Set(['CONFIRMED', 'CANCELLED', 'PAYMENT_FAILED']),
  PAYMENT_FAILED:                new Set(['CONFIRMED', 'CANCELLED', 'PENDING_CUSTOMER_CONFIRMATION', 'AWAITING_ADMIN_REVIEW']),
  CONFIRMED:                     new Set(['ASSIGNED', 'CANCELLED', 'IN_PROGRESS', 'COMPLETED', 'FULFILLED']),
  ASSIGNED:                      new Set(['IN_PROGRESS', 'CANCELLED', 'CONFIRMED', 'COMPLETED']),
  IN_PROGRESS:                   new Set(['COMPLETED', 'CANCELLED', 'NO_SHOW']),
  COMPLETED:                     new Set(['FULFILLED', 'CANCELLED']),
  FULFILLED:                     new Set([]),   // terminal
  CANCELLED:                     new Set([]),   // terminal
  NO_SHOW:                       new Set(['CANCELLED', 'FULFILLED']),
  // Legacy / deprecated — allow reading but no new transitions out of them
  ACCEPTED:                      new Set(['CONFIRMED', 'IN_PROGRESS', 'CANCELLED']),
  ON_THE_WAY:                    new Set(['IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
  PENDING_ADMIN_CONFIRMATION:    new Set(['CONFIRMED', 'CANCELLED']),
};

// Admin-only override: platform/super admins may bypass the guard
// Set to true temporarily to unblock emergency operational fixes
const BYPASS_TRANSITION_GUARD = false;

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class BookingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly pricing: PricingResolver,
    private readonly notificationService: NotificationService,
    private readonly trace: DebugTraceService,
    private readonly paymentService: PaymentService,
    private readonly invoicePdf: InvoicePdfService,
    private readonly tenantInvoice: TenantInvoiceService,
    @Optional() private readonly tripEvidence?: TripEvidenceService,
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
        b.job_type,
        b.customer_first_name,
        b.customer_last_name,
        b.passenger_first_name,
        b.passenger_last_name,
        b.passenger_phone_country_code,
        b.passenger_phone_number,
        b.passenger_count,
        b.luggage_count,
        tsc.name AS service_class_name,
        tst.display_name AS service_type_name,
        b.passenger_is_customer,
        b.operational_status,
        b.payment_status,
        b.pickup_at_utc,
        b.pickup_at_local,
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
         AND a.status::text NOT IN ('CANCELLED','DECLINED','EXPIRED')
       LEFT JOIN public.tenant_service_classes tsc ON tsc.id = b.service_class_id
       LEFT JOIN public.tenant_service_types tst ON tst.id = b.service_type_id
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

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  private async resolveBookingId(tenantId: string, idOrRef: string): Promise<string> {
    if (this.isUuid(idOrRef)) return idOrRef;
    const rows = await this.dataSource.query(
      `SELECT id FROM public.bookings WHERE booking_reference = $1 AND tenant_id = $2 LIMIT 1`,
      [idOrRef, tenantId],
    );
    if (!rows.length) throw new NotFoundException('Booking not found');
    return rows[0].id;
  }

  async getBookingDetail(tenantId: string, bookingId: string) {
    const resolvedId = await this.resolveBookingId(tenantId, bookingId);
    const bookings = await this.dataSource.query(
      `SELECT b.*,
              tst.display_name AS service_type_name,
              tsc.name  AS service_class_name
         FROM public.bookings b
         LEFT JOIN public.tenant_service_types tst ON tst.id = b.service_type_id
         LEFT JOIN public.tenant_service_classes tsc ON tsc.id = b.service_class_id
        WHERE b.id = $1 AND b.tenant_id = $2`,
      [resolvedId, tenantId],
    );
    if (!bookings.length) throw new NotFoundException('Booking not found');
    const booking = bookings[0];

    const [history, assignments, payments, savedCard, driverExtraReport] = await Promise.all([
      this.dataSource.query(
        `SELECT * FROM public.booking_status_history
         WHERE booking_id = $1
         ORDER BY created_at ASC`,
        [resolvedId],
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
        [resolvedId],
      ),
      this.dataSource.query(
        `SELECT * FROM public.payments
          WHERE booking_id = $1
          ORDER BY created_at ASC`,
        [resolvedId],
      ),
      // Check if customer has a saved Stripe payment method
      booking.customer_id ? this.dataSource.query(
        `SELECT spm.id, spm.stripe_payment_method_id, spm.brand AS card_brand, spm.last4 AS card_last4, spm.exp_month AS card_exp_month, spm.exp_year AS card_exp_year
           FROM public.saved_payment_methods spm
          WHERE spm.customer_id = $1
          ORDER BY spm.created_at DESC LIMIT 1`,
        [booking.customer_id],
      ).catch(() => []) : Promise.resolve([]),
      // Driver extra report for the primary (leg A) assignment — used by admin Review & Fulfil
      this.dataSource.query(
        `SELECT r.*, u.full_name AS driver_name
           FROM public.driver_extra_reports r
           LEFT JOIN public.users u ON u.id = r.driver_id
          WHERE r.booking_id = $1
          ORDER BY r.created_at DESC LIMIT 1`,
        [resolvedId],
      ).catch(() => []),
    ]);

    const summary = payments.length
      ? {
          authorized_minor: payments[0].amount_authorized_minor ?? 0,
          captured_minor: payments[0].amount_captured_minor ?? 0,
          refunded_minor: payments[0].amount_refunded_minor ?? 0,
          currency: payments[0].currency ?? 'AUD',
        }
      : null;

    // Compute has_extras flag for admin surface
    const report = driverExtraReport?.[0] ?? null;
    const reportWithMeta = report ? {
      ...report,
      has_extras: !!(
        (report.extra_waypoints?.length) ||
        report.waiting_minutes ||
        report.extra_toll ||
        report.extra_parking
      ),
    } : null;

    return {
      booking,
      status_history: history,
      assignments,
      payments: payments.length
        ? { summary, items: payments }
        : null,
      saved_card: savedCard?.[0] ?? null,
      // ── Phase 2: driver execution report (admin review surface) ──────────
      // null = no report submitted yet; status: 'pending' | 'reviewed'
      driver_extra_report: reportWithMeta,
    };
  }

  // ── Phase 2: admin get driver extra report ───────────────────────────────
  // Dedicated admin endpoint for driver execution report for a booking.
  // Admin line uses this to review before calling fulfilBooking().
  async getDriverExtraReportForAdmin(tenantId: string, bookingId: string) {
    const rows = await this.dataSource.query(
      `SELECT r.*, u.full_name AS driver_name,
              a.driver_execution_status, a.post_job_status
         FROM public.driver_extra_reports r
         LEFT JOIN public.users u ON u.id = r.driver_id
         LEFT JOIN public.assignments a ON a.id = r.assignment_id
        WHERE r.booking_id = $1 AND r.tenant_id = $2
        ORDER BY r.created_at DESC LIMIT 1`,
      [bookingId, tenantId],
    );
    const report = rows[0] ?? null;
    if (!report) return { report: null, has_report: false };

    return {
      has_report: true,
      report: {
        ...report,
        has_extras: !!(
          (report.extra_waypoints?.length) ||
          report.waiting_minutes ||
          report.extra_toll ||
          report.extra_parking
        ),
      },
    };
  }

  async createBooking(tenantId: string, dto: any) {
    const id = randomUUID();
    const now = new Date().toISOString();
    const pickupAtLocal = dto.pickup_at_utc ?? dto.pickupAtUtc;
    if (!pickupAtLocal) throw new Error('pickup_at_utc is required');

    this.trace.traceInfo('BOOKING_CREATE_START', {
      tenant_id: tenantId,
      booking_id: id,
      message: 'Booking creation started',
      context: { customer_email: dto.customer_email ?? dto.email, total_price_minor: dto.total_price_minor ?? dto.totalPriceMinor, source: dto.booking_source ?? 'ADMIN' },
    });
    const pickupTimezone = dto.timezone || 'Australia/Sydney';
    const pickupAtUtc = this.toUtcFromLocal(pickupAtLocal, pickupTimezone);
    const returnPickupAtLocal = dto.return_pickup_at_utc ?? dto.returnPickupAtUtc ?? null;
    const returnPickupAtUtc = returnPickupAtLocal
      ? this.toUtcFromLocal(returnPickupAtLocal, pickupTimezone)
      : null;

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
      pickupAtUtc: pickupAtLocal,
      returnPickupAtUtc: returnPickupAtLocal,
      timezone: pickupTimezone,
      cityId: dto.city_id ?? null,
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

    // Fetch customer details if customer_id provided (fills missing email/name/phone)
    let customerRecord: any = null;
    if (dto.customer_id) {
      const cRows = await this.dataSource.query(
        `SELECT email, first_name, last_name, phone_country_code, phone_number
         FROM public.customers WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
        [dto.customer_id, tenantId],
      );
      customerRecord = cRows[0] ?? null;
    }
    // Fallback email/name from customer record to avoid NOT NULL violation
    const resolvedEmail = dto.customer_email?.trim() || customerRecord?.email || 'noreply@placeholder.com';
    const resolvedFirstName = dto.customer_first_name?.trim() || customerRecord?.first_name || 'Guest';
    const resolvedLastName = dto.customer_last_name?.trim() || customerRecord?.last_name || '';

    let pricing: any;
    try {
      pricing = await this.pricing.resolve(pricingContext);
    } catch (err: any) {
      throw new Error(`Pricing resolve failed: ${err?.message ?? String(err)}`);
    }

    const jobType = dto.job_type ?? 'NORMAL';
    const paymentStatus = jobType === 'DRIVER_JOB' ? 'PAID' : (dto.payment_status ?? 'UNPAID');
    const operationalStatus = jobType === 'DRIVER_JOB'
      ? 'CONFIRMED'
      : (dto.operational_status ?? 'PENDING_CUSTOMER_CONFIRMATION');

    let bookingRows: any[];
    try {
    bookingRows = await this.dataSource.query(
      `INSERT INTO public.bookings
       (id, tenant_id, booking_reference, booking_source, job_type,
        customer_first_name, customer_last_name, customer_email,
        customer_phone_country_code, customer_phone_number,
        pickup_address_text, pickup_lat, pickup_lng, pickup_place_id,
        dropoff_address_text, dropoff_lat, dropoff_lng, dropoff_place_id,
        pickup_at_utc, pickup_at_local, timezone, passenger_count, luggage_count,
        special_requests, pricing_snapshot, total_price_minor, discount_total_minor, currency,
        operational_status, payment_status,
        estimated_duration_seconds, created_at, updated_at,
        passenger_first_name, passenger_last_name,
        passenger_phone_country_code, passenger_phone_number,
        passenger_is_customer,
        customer_id, passenger_id,
        is_return_trip, return_pickup_at_utc, return_pickup_at_local, return_pickup_address_text,
        return_pickup_lat, return_pickup_lng, return_pickup_place_id,
        service_class_id, service_type_id,
        infant_seats, toddler_seats, booster_seats
       )
       VALUES ($1,$2,$3,$4,$5,
               $6,$7,$8,
               $9,$10,
               $11,$12,$13,$14,
               $15,$16,$17,$18,
               $19,$20,$21,$22,$23,
               $24,$25,$26,$27,$28,
               $29,$30,
               $31,$32,$33,
               $34,$35,
               $36,$37,
               $38,
               $39,$40,
               $41,$42,$43,
               $44,$45,$46,
               $47,$48,
               $49,$50,$51,$52
       )
       RETURNING *`,
      [
        id,
        tenantId,
        dto.booking_reference ?? `${refPrefix}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        dto.booking_source ?? 'ADMIN',
        jobType,
        resolvedFirstName,
        resolvedLastName,
        resolvedEmail,
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
        pickupAtLocal,
        pickupTimezone,
        dto.passenger_count ?? 1,
        dto.luggage_count ?? 0,
        dto.special_requests ?? null,
        pricing,
        pricing.totalPriceMinor ?? 0,
        pricing.discount_amount_minor ?? 0,
        pricing.currency ?? 'AUD',
        operationalStatus,
        paymentStatus,
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
        returnPickupAtUtc,
        returnPickupAtLocal,
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
      context: { booking_reference: bookingRows[0]?.booking_reference, status: operationalStatus },
    });

    await this.dataSource.query(
      `INSERT INTO public.booking_status_history
       (id, tenant_id, booking_id, previous_status, new_status, triggered_by, reason, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [randomUUID(), tenantId, id, null, operationalStatus, null, null, now],
    );

    // ── Admin-created booking: send ONE email to customer (payment request) ──
    // Admin knows they created it — no need to notify admin.
    // If CONFIRMED (e.g. cash booking), send BookingConfirmed instead.
    const notifPayload = { tenant_id: tenantId, booking_id: id };
    const status = operationalStatus;
    if (jobType !== 'DRIVER_JOB' && status === 'PENDING_CUSTOMER_CONFIRMATION') {
      // Generate payment token and send payment request email to customer only
      this.sendPaymentLink(tenantId, id)
        .catch((e) => console.error('[Notification] AdminCreatedPaymentRequest FAILED:', e?.message));
    } else if (jobType !== 'DRIVER_JOB' && status === 'CONFIRMED') {
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

    // ── Strict transition guard ────────────────────────────────────────────
    if (!BYPASS_TRANSITION_GUARD) {
      const allowedFrom = BOOKING_TRANSITION_RULES[booking.operational_status];
      if (!allowedFrom || !allowedFrom.has(newStatus)) {
        throw new BadRequestException(
          `Invalid booking transition: ${booking.operational_status} → ${newStatus}. ` +
          `Allowed from ${booking.operational_status}: [${[...(allowedFrom ?? [])].join(', ') || 'none (terminal)'}]`,
        );
      }
    }
    // ──────────────────────────────────────────────────────────────────────

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
           AND operational_status::text NOT IN ('COMPLETED','FULFILLED','CANCELLED')
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

      // ── Item 2: cascade cancellation to open assignments ──────────────────
      // Any assignment in an unresolved state must be cancelled so drivers no
      // longer see the booking as active work.
      await manager.query(
        `UPDATE public.assignments
         SET status = 'CANCELLED',
             cancellation_reason = 'Booking cancelled',
             updated_at = now()
         WHERE booking_id = $1
           AND status NOT IN ('CANCELLED','DECLINED','JOB_COMPLETED','COMPLETED')`,
        [bookingId],
      );
      // ─────────────────────────────────────────────────────────────────────

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
    // JOIN customers to obtain stripe_customer_id for potential extra charge
    const rows = await this.dataSource.query(
      `SELECT b.id, b.total_price_minor, b.currency, b.operational_status,
              b.customer_id, c.stripe_customer_id
       FROM public.bookings b
       LEFT JOIN public.customers c ON c.id = b.customer_id
       WHERE b.id = $1 AND b.tenant_id = $2`,
      [bookingId, tenantId],
    );
    if (!rows.length) throw new NotFoundException('Booking not found');
    const booking = rows[0];

    const extraMinor = body.extra_amount_minor ?? 0;
    const actualTotal = Number(booking.total_price_minor) + extraMinor;

    // Mark FULFILLED immediately; adjustment_status starts PENDING (resolved after Stripe attempt)
    await this.dataSource.query(
      `UPDATE public.bookings
       SET operational_status      = 'FULFILLED',
           actual_total_minor      = $1,
           adjustment_amount_minor = $2,
           adjustment_status       = CASE WHEN $2 > 0 THEN 'PENDING' ELSE 'NONE' END,
           settled_at              = NOW(),
           updated_at              = NOW()
       WHERE id = $3`,
      [actualTotal, extraMinor, bookingId],
    );

    // Log status transition
    await this.dataSource.query(
      `INSERT INTO public.booking_status_history
       (id, tenant_id, booking_id, previous_status, new_status, triggered_by, reason, created_at)
       VALUES (gen_random_uuid(),$1,$2,$3,'FULFILLED',$4,$5,NOW())`,
      [tenantId, bookingId, booking.operational_status, adminId, body.note ?? null],
    ).catch(() => {});

    // ── Phase 2: mark driver extra report as reviewed ─────────────────────────
    // Admin has reviewed the report (with or without acting on extras).
    // This closes the pending-review state visible in admin UI.
    await this.dataSource.query(
      `UPDATE public.driver_extra_reports
         SET status = 'reviewed', updated_at = NOW()
       WHERE booking_id = $1 AND status = 'pending'`,
      [bookingId],
    ).catch(() => {});
    // Also mark assignment post_job_status = 'reviewed' for dispatch visibility
    await this.dataSource.query(
      `UPDATE public.assignments
         SET post_job_status = 'reviewed', updated_at = NOW()
       WHERE booking_id = $1 AND post_job_status = 'submitted'`,
      [bookingId],
    ).catch(() => {});
    // ─────────────────────────────────────────────────────────────────────────

    // ── Extra amount: off-session Stripe charge ───────────────────────────────
    // Replaces TODO stub. adjustment_status is resolved from actual Stripe outcome.
    let adjustmentStatus: string = extraMinor > 0 ? 'PENDING' : 'NONE';

    if (extraMinor > 0) {
      const hasStripeCustomer = !!booking.stripe_customer_id;

      if (!hasStripeCustomer) {
        // Guest booking or no Stripe customer on file — flag for manual collection
        adjustmentStatus = 'NO_PAYMENT_METHOD';
      } else {
        // Fetch default saved payment method
        const pmRows = await this.dataSource.query(
          `SELECT stripe_payment_method_id FROM public.saved_payment_methods
           WHERE customer_id=$1 AND tenant_id=$2 AND is_default=true LIMIT 1`,
          [booking.customer_id, tenantId],
        );
        if (!pmRows.length) {
          adjustmentStatus = 'NO_PAYMENT_METHOD';
        } else {
          // Resolve tenant Stripe key from tenant_settings (plaintext column)
          // tenant_integrations.config is encrypted — use tenant_settings.stripe_secret_key instead
          const intRows = await this.dataSource.query(
            `SELECT stripe_secret_key FROM public.tenant_settings
             WHERE tenant_id=$1 LIMIT 1`,
            [tenantId],
          );
          const secretKey = intRows[0]?.stripe_secret_key ?? process.env.STRIPE_SECRET_KEY;

          if (!secretKey) {
            adjustmentStatus = 'FAILED';
          } else {
            try {
              const StripeLib = (await import('stripe')).default;
              const stripe = new StripeLib(secretKey);

              const pi = await stripe.paymentIntents.create({
                amount:         extraMinor,
                currency:       (booking.currency ?? 'AUD').toLowerCase(),
                customer:       booking.stripe_customer_id,
                payment_method: pmRows[0].stripe_payment_method_id,
                confirm:        true,
                off_session:    true,
                metadata: {
                  tenant_id:    tenantId,
                  booking_id:   bookingId,
                  payment_type: 'ADJUSTMENT',
                  admin_id:     adminId,
                },
              });

              // Record in payments table as PAID (PI was confirmed + captured inline)
              await this.dataSource.query(
                `INSERT INTO public.payments (
                   tenant_id, booking_id, stripe_payment_intent_id, payment_type,
                   currency, amount_authorized_minor, amount_captured_minor,
                   amount_refunded_minor, payment_status, created_at, updated_at
                 ) VALUES ($1,$2,$3,'ADJUSTMENT',$4,$5,$5,0,'PAID',NOW(),NOW())
                 ON CONFLICT (tenant_id, stripe_payment_intent_id) DO NOTHING`,
                [tenantId, bookingId, pi.id, booking.currency ?? 'AUD', extraMinor],
              );

              adjustmentStatus = 'CAPTURED';
            } catch (err: any) {
              console.error('[fulfilBooking] Extra charge failed:', err?.message ?? err);
              adjustmentStatus = 'FAILED';
            }
          }
        }
      }

      // Persist resolved adjustment_status
      await this.dataSource.query(
        `UPDATE public.bookings SET adjustment_status=$1, updated_at=NOW() WHERE id=$2`,
        [adjustmentStatus, bookingId],
      );
    }

    // Fulfillment notification (non-blocking)
    const notifEvent = extraMinor > 0 ? 'JobFulfilledWithExtras' : 'JobFulfilledNoExtras';
    this.notificationService.handleEvent(notifEvent, {
      tenant_id:           tenantId,
      booking_id:          bookingId,
      extra_minor:         extraMinor,
      actual_total_minor:  actualTotal,
      adjustment_status:   adjustmentStatus,
    }).catch((e: any) =>
      console.error(`[Notification] ${notifEvent} FAILED:`, e?.message ?? e),
    );

    // ── Phase 3: freeze trip evidence when booking is FULFILLED ──────────────
    // Evidence freeze rule: all GPS, SMS, and operation log data becomes read-only.
    // This is the canonical audit evidence point for dispute resolution.
    if (this.tripEvidence) {
      await this.tripEvidence.freezeEvidence(tenantId, bookingId).catch(() => {});
    }
    // ─────────────────────────────────────────────────────────────────────────

    return { success: true, actual_total_minor: actualTotal, adjustment_status: adjustmentStatus };
  }

  async markPaid(tenantId: string, bookingId: string) {
    await this.dataSource.query(
      `UPDATE public.bookings SET payment_status = 'PAID', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [bookingId, tenantId],
    );
    return { success: true };
  }

  // ── Invoice gating helper ─────────────────────────────────────────────────
  /**
   * Checks whether it is safe to generate/send the final invoice for a booking.
   * Product rule (2026-03-10):
   *   - Extra charge required and not yet resolved → BLOCKED
   *   - Extra charge succeeded (CAPTURED/SETTLED) or no extra charge (NONE) → ALLOWED
   *   - FAILED / NO_PAYMENT_METHOD → BLOCKED (extra money still owed)
   */
  private async checkInvoiceGating(
    booking: any,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const adjStatus = booking.adjustment_status ?? 'NONE';
    const opStatus  = booking.operational_status;
    const tenantId  = booking.tenant_id;

    // Booking must be in a final/fulfilled state
    if (!['FULFILLED', 'COMPLETED'].includes(opStatus)) {
      return { allowed: false, reason: `Booking is not yet fulfilled (status: ${opStatus})` };
    }

    // Extra charge was attempted but failed — extra amount still owed
    if (['FAILED', 'NO_PAYMENT_METHOD', 'PENDING'].includes(adjStatus)) {
      return {
        allowed: false,
        reason: `Final invoice cannot be sent while extra charge is unresolved (adjustment_status: ${adjStatus}). ` +
                `Collect the extra amount first (send payment link or resolve via admin).`,
      };
    }

    // ── Tenant invoice readiness check ────────────────────────────────────────
    // Blocks final invoice generation/send if company profile or invoice profile
    // is incomplete. Optional branding fields (logo, colors) do NOT block.
    if (tenantId) {
      const readiness = await this.tenantInvoice.checkReadiness(tenantId);
      if (!readiness.invoice_ready) {
        const missing: string[] = [
          ...readiness.company_profile.missing,
          ...readiness.invoice_profile.missing,
          ...readiness.payment_instruction.missing,
        ];
        return {
          allowed: false,
          reason: `Tenant is not invoice-ready. Complete the following before sending a final invoice: ` +
                  missing.join('; '),
        };
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // NONE (no extra charge) or CAPTURED/SETTLED (extra charge succeeded) → allowed
    return { allowed: true };
  }

  // ── Resend final invoice email (admin action) ─────────────────────────────
  /**
   * Re-fires the InvoiceSent notification for the most recent SENT/PAID
   * CUSTOMER invoice attached to this booking.
   * Returns { success: true, invoice_number } on success.
   * Returns { success: false, reason } if no invoice exists yet or gating blocks it.
   */
  async resendInvoice(tenantId: string, bookingId: string): Promise<{ success: boolean; invoice_number?: string; reason?: string }> {
    // Check invoice gating rules (extra charge must be resolved first)
    const [bookingRow] = await this.dataSource.query(
      `SELECT operational_status, adjustment_status, tenant_id FROM public.bookings WHERE id=$1 AND tenant_id=$2`,
      [bookingId, tenantId],
    );
    if (!bookingRow) return { success: false, reason: 'Booking not found' };
    const gate = await this.checkInvoiceGating(bookingRow);
    if (!gate.allowed) return { success: false, reason: gate.reason };

    const [invoice] = await this.dataSource.query(
      `SELECT * FROM public.invoices
       WHERE booking_id=$1 AND tenant_id=$2
         AND invoice_type='CUSTOMER' AND status IN ('SENT','PAID')
         AND deleted_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [bookingId, tenantId],
    );
    if (!invoice) return { success: false, reason: 'No final invoice found for this booking' };

    await this.notificationService.handleEvent('InvoiceSent', {
      tenant_id:      tenantId,
      invoice_id:     invoice.id,
      invoice_number: invoice.invoice_number,
      recipient_name:  invoice.recipient_name,
      recipient_email: invoice.recipient_email,
      total_minor:     invoice.total_minor,
      currency:        invoice.currency,
      due_date:        invoice.due_date,
      line_items:      invoice.line_items,
      notes:           invoice.notes,
      subtotal_minor:  invoice.subtotal_minor,
      tax_minor:       invoice.tax_minor,
      discount_minor:  invoice.discount_minor,
    });

    return { success: true, invoice_number: invoice.invoice_number };
  }

  // ── Admin invoice PDF download ─────────────────────────────────────────────
  /**
   * Generates the final invoice PDF for admin download.
   * Admin auth is handled by the controller (JwtGuard + tenant_id check).
   * Returns null if no SENT/PAID CUSTOMER invoice exists for this booking.
   */
  async getInvoicePdfForAdmin(
    tenantId: string,
    bookingId: string,
  ): Promise<{ buffer: Buffer; filename: string } | null> {
    const [booking] = await this.dataSource.query(
      `SELECT booking_reference, currency FROM public.bookings
       WHERE id=$1 AND tenant_id=$2`,
      [bookingId, tenantId],
    );
    if (!booking) throw new NotFoundException('Booking not found');

    const [invoice] = await this.dataSource.query(
      `SELECT i.*, ii.description, ii.quantity, ii.unit_price_minor, ii.total_minor as item_total
       FROM public.invoices i
       LEFT JOIN public.invoice_items ii ON ii.invoice_id = i.id
       WHERE i.booking_id=$1 AND i.tenant_id=$2
         AND i.invoice_type='CUSTOMER' AND i.status IN ('SENT','PAID')
         AND i.deleted_at IS NULL
       ORDER BY i.created_at DESC LIMIT 1`,
      [bookingId, tenantId],
    );
    if (!invoice) return null;

    const [branding] = await this.dataSource.query(
      `SELECT company_name, contact_email, contact_phone
       FROM public.tenant_branding WHERE tenant_id=$1 LIMIT 1`,
      [tenantId],
    ).catch(() => []);

    let lineItems: any[] | null = null;
    if (invoice.description) {
      lineItems = [{ description: invoice.description, quantity: invoice.quantity, unit_price_minor: invoice.unit_price_minor, total_minor: invoice.item_total }];
    }
    if (invoice.line_items && (!lineItems || !lineItems.length)) {
      try { lineItems = typeof invoice.line_items === 'string' ? JSON.parse(invoice.line_items) : invoice.line_items; } catch { lineItems = null; }
    }

    const buffer = await this.invoicePdf.generate({
      invoice_number:    invoice.invoice_number,
      issue_date:        invoice.issue_date ?? invoice.created_at,
      due_date:          invoice.due_date ?? null,
      booking_reference: booking.booking_reference,
      company_name:      branding?.company_name ?? 'ASChauffeured',
      company_email:     branding?.contact_email ?? null,
      company_phone:     branding?.contact_phone ?? null,
      recipient_name:    invoice.recipient_name,
      recipient_email:   invoice.recipient_email,
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
    // Validate booking belongs to tenant + is in capturable state
    const rows = await this.dataSource.query(
      `SELECT id, payment_status, stripe_payment_intent_id
       FROM public.bookings
       WHERE id = $1 AND tenant_id = $2`,
      [bookingId, tenantId],
    );
    if (!rows.length) throw new NotFoundException('Booking not found');

    const b = rows[0];
    if (b.payment_status !== 'AUTHORIZED') {
      throw new BadRequestException(
        `Cannot capture: booking payment_status is "${b.payment_status}", expected "AUTHORIZED"`,
      );
    }

    // Delegate to PaymentService — reads payments table for AUTHORIZED row,
    // calls stripe.paymentIntents.capture(), then sets payment_status = CAPTURE_PENDING.
    // charge.captured webhook → PAID; failure → FAILED.
    return this.paymentService.capturePayment(
      bookingId,
      b.stripe_payment_intent_id ?? undefined,
    );
  }

  // ── Confirm and charge off-session (AWAITING_ADMIN_REVIEW → CONFIRMED/PAYMENT_FAILED) ──
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
    // Guard: only CONFIRMED or PAYMENT_FAILED (retry) are valid sources
    // PAYMENT_FAILED = confirmed product state for retryable charge failure
    if (!['CONFIRMED', 'PAYMENT_FAILED'].includes(b.operational_status)) {
      throw new BadRequestException(
        `Cannot confirm-and-charge: booking is in ${b.operational_status} state. ` +
        `Expected CONFIRMED or PAYMENT_FAILED.`,
      );
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

    // Get tenant Stripe key from tenant_settings (plaintext column)
    // tenant_integrations.config is encrypted — use tenant_settings.stripe_secret_key instead
    const intRows = await this.dataSource.query(
      `SELECT stripe_secret_key FROM public.tenant_settings WHERE tenant_id=$1 LIMIT 1`,
      [tenantId],
    );
    const secretKey = intRows[0]?.stripe_secret_key ?? process.env.STRIPE_SECRET_KEY;
    if (!secretKey) throw new BadRequestException('Stripe not configured');

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(secretKey);

    // ── Stripe charge — isolated try/catch so DB errors don't corrupt Stripe outcome ──
    let pi: any;
    let stripeError: string | null = null;
    try {
      pi = await stripe.paymentIntents.create({
        amount: b.total_price_minor,
        currency: (b.currency ?? 'AUD').toLowerCase(),
        customer: b.stripe_customer_id,
        payment_method: pmRows[0].stripe_payment_method_id,
        confirm: true,
        off_session: true,
        metadata: { tenant_id: tenantId, booking_id: bookingId, payment_type: 'INITIAL' },
      });
    } catch (err: any) {
      stripeError = err.message ?? String(err);
    }

    if (stripeError || !pi) {
      // Stripe charge failed — set PAYMENT_FAILED (confirmed product state; retryable)
      // Separate DB write: does NOT set payment_status=FAILED if DB write itself fails
      await this.dataSource.query(
        `UPDATE public.bookings
         SET operational_status='PAYMENT_FAILED', payment_status='FAILED', updated_at=now()
         WHERE id=$1`,
        [bookingId],
      ).catch((dbErr: any) =>
        console.error('[confirmAndCharge] DB update to PAYMENT_FAILED failed:', dbErr?.message),
      );
      // Write to status history
      await this.dataSource.query(
        `INSERT INTO public.booking_status_history (id,tenant_id,booking_id,previous_status,new_status,triggered_by,reason,created_at)
         VALUES ($1,$2,$3,$4,'PAYMENT_FAILED',$5,$6,$7)`,
        [randomUUID(), tenantId, bookingId, b.operational_status, null, `Stripe error: ${stripeError}`, new Date().toISOString()],
      ).catch(() => {});
      return { success: false, error: stripeError };
    }

    // ── Stripe charge succeeded — update booking state ───────────────────────
    await this.dataSource.query(
      `UPDATE public.bookings
       SET operational_status='CONFIRMED', payment_status='PAID',
           stripe_payment_intent_id=$1, payment_captured_at=now(), updated_at=now()
       WHERE id=$2`,
      [pi.id, bookingId],
    );

    // Write to status history
    await this.dataSource.query(
      `INSERT INTO public.booking_status_history (id,tenant_id,booking_id,previous_status,new_status,triggered_by,reason,created_at)
       VALUES ($1,$2,$3,$4,'CONFIRMED',$5,$6,$7)`,
      [randomUUID(), tenantId, bookingId, b.operational_status, null, 'confirmAndCharge success', new Date().toISOString()],
    ).catch(() => {});

    // ── Record in payments table (DB errors do NOT roll back Stripe charge) ───
    await this.dataSource.query(
      `INSERT INTO public.payments (
         tenant_id, booking_id, stripe_payment_intent_id, payment_type,
         currency, amount_authorized_minor, amount_captured_minor,
         amount_refunded_minor, payment_status, created_at, updated_at
       ) VALUES ($1,$2,$3,'INITIAL',$4,$5,$5,0,'PAID',NOW(),NOW())
       ON CONFLICT (tenant_id, stripe_payment_intent_id) DO NOTHING`,
      [tenantId, bookingId, pi.id, b.currency ?? 'AUD', b.total_price_minor],
    ).catch((dbErr: any) =>
      // Non-fatal: booking is CONFIRMED/PAID; payments row may be missing but charge happened
      // This will be caught by reconciliation script
      console.error('[confirmAndCharge] Failed to insert payments row:', dbErr?.message, 'PI:', pi.id),
    );

    return { success: true, paymentIntentId: pi.id };
  }

  // ── Reject booking (AWAITING_ADMIN_REVIEW → CANCELLED) ────────────────────
  async rejectBooking(tenantId: string, bookingId: string, actorId: string, reason?: string) {
    const rows = await this.dataSource.query(
      `SELECT operational_status FROM public.bookings WHERE id=$1 AND tenant_id=$2`,
      [bookingId, tenantId],
    );
    if (!rows.length) throw new NotFoundException('Booking not found');
    if (!['PENDING_CUSTOMER_CONFIRMATION', 'AWAITING_ADMIN_REVIEW'].includes(rows[0].operational_status)) {
      throw new BadRequestException('Booking is not in PENDING_CUSTOMER_CONFIRMATION state');
    }
    await this.dataSource.query(
      `UPDATE public.bookings
       SET operational_status='CANCELLED', updated_at=now()
       WHERE id=$1 AND tenant_id=$2`,
      [bookingId, tenantId],
    );
    await this.dataSource.query(
      `INSERT INTO public.booking_status_history
       (id, tenant_id, booking_id, previous_status, new_status, triggered_by, reason, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT DO NOTHING`,
      [
        randomUUID(),
        tenantId,
        bookingId,
        rows[0].operational_status,
        'CANCELLED',
        actorId,
        reason ?? null,
        new Date().toISOString(),
      ],
    ).catch(() => {});
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

  // ── Admin modify booking (manual price) ─────────────────────────────────
  async modifyBookingAdmin(tenantId: string, bookingId: string, adminId: string, dto: any) {
    const [booking] = await this.dataSource.query(
      `SELECT * FROM public.bookings WHERE id = $1 AND tenant_id = $2`,
      [bookingId, tenantId],
    );
    if (!booking) throw new NotFoundException('Booking not found');

    const allowed = new Set([
      'pickup_address_text', 'dropoff_address_text', 'pickup_at_utc', 'return_pickup_at_utc',
      'service_type_id', 'service_class_id', 'passenger_count', 'luggage_count',
      'flight_number', 'special_requests', 'waypoints',
      'customer_first_name', 'customer_last_name', 'customer_email',
      'customer_phone_country_code', 'customer_phone_number',
      'passenger_first_name', 'passenger_last_name', 'passenger_phone_country_code', 'passenger_phone_number',
    ]);

    const update: Record<string, any> = {};
    for (const [k, v] of Object.entries(dto ?? {})) {
      if (allowed.has(k)) update[k] = v;
    }

    if (Array.isArray(update.waypoints)) {
      update.waypoints = update.waypoints.filter(Boolean);
    }

    if (update.pickup_at_utc) {
      update.pickup_at_local = update.pickup_at_utc;
      update.pickup_at_utc = this.toUtcFromLocal(update.pickup_at_utc, booking.timezone ?? 'Australia/Sydney');
    }
    if (update.return_pickup_at_utc) {
      update.return_pickup_at_local = update.return_pickup_at_utc;
      update.return_pickup_at_utc = this.toUtcFromLocal(update.return_pickup_at_utc, booking.timezone ?? 'Australia/Sydney');
    }

    const totalMinor = typeof dto?.total_price_minor === 'number' ? dto.total_price_minor : null;
    if (typeof totalMinor === 'number') update.total_price_minor = totalMinor;

    const snapshot = booking.pricing_snapshot ?? {};
    if (typeof totalMinor === 'number') {
      snapshot.final_fare_minor = totalMinor;
      snapshot.grand_total_minor = totalMinor;
      snapshot.total_price_minor = totalMinor;
      snapshot.price_override_minor = totalMinor;
      snapshot.price_override_by = adminId;
      snapshot.price_override_reason = dto?.price_override_reason ?? 'Admin modify';
    }
    update.pricing_snapshot = snapshot;

    if (!Object.keys(update).length) {
      throw new BadRequestException('No valid fields to update');
    }

    const setCols = Object.keys(update).map((k, i) => `${k} = $${i + 3}`);
    await this.dataSource.query(
      `UPDATE public.bookings SET ${setCols.join(', ')}, updated_at = now() WHERE id = $1 AND tenant_id = $2`,
      [bookingId, tenantId, ...Object.values(update)],
    );

    // notify customer + driver + partner (best-effort)
    this.notificationService.handleEvent('BookingModified', {
      tenant_id: tenantId,
      booking_id: bookingId,
    }).catch(() => {});

    const [assignment] = await this.dataSource.query(
      `SELECT id FROM public.assignments WHERE booking_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [bookingId],
    );

    return { ok: true, assignment_id: assignment?.id ?? null };
  }

  // ── Settle (charge/refund final balance difference) ───────────────────────
  /**
   * Settles the difference between actual_total_minor and prepay_total_minor.
   *   adjustmentMinor > 0: customer owes extra → off-session charge
   *   adjustmentMinor < 0: customer overpaid → refund from original INITIAL payment
   *   adjustmentMinor = 0: balanced → no Stripe movement, mark SETTLED
   *
   * Requires adjustment_status IN ('NONE','FAILED','NO_PAYMENT_METHOD') or null.
   * Cannot re-settle a SETTLED or already-CAPTURED booking.
   */
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

    // Guard: only settle FULFILLED bookings; don't re-settle
    if (b.operational_status !== 'FULFILLED') {
      throw new BadRequestException(`Booking must be FULFILLED to settle; current: ${b.operational_status}`);
    }
    if (b.adjustment_status === 'SETTLED') {
      throw new BadRequestException('Booking is already settled');
    }

    const adjustmentMinor = (b.actual_total_minor ?? 0) - (b.prepay_total_minor ?? 0);

    // ── Zero delta — no money movement needed ────────────────────────────────
    if (adjustmentMinor === 0) {
      await this.dataSource.query(
        `UPDATE public.bookings
         SET adjustment_amount_minor=0, adjustment_status='SETTLED',
             settled_at=now(), updated_at=now()
         WHERE id=$1`,
        [bookingId],
      );
      return { success: true, adjustmentMinor: 0, action: 'NO_OP' };
    }

    // Get tenant Stripe key
    const intRows = await this.dataSource.query(
      `SELECT stripe_secret_key FROM public.tenant_settings WHERE tenant_id=$1 LIMIT 1`,
      [tenantId],
    );
    const secretKey = intRows[0]?.stripe_secret_key ?? process.env.STRIPE_SECRET_KEY;
    if (!secretKey) throw new BadRequestException('Stripe not configured for this tenant');

    const StripeLib = (await import('stripe')).default;
    const stripe = new StripeLib(secretKey);

    // ── Positive delta: charge customer for extra amount ──────────────────────
    if (adjustmentMinor > 0) {
      if (!b.stripe_customer_id) {
        // No card on file — mark NO_PAYMENT_METHOD; admin must send payment link
        await this.dataSource.query(
          `UPDATE public.bookings
           SET adjustment_amount_minor=$1, adjustment_status='NO_PAYMENT_METHOD', updated_at=now()
           WHERE id=$2`,
          [adjustmentMinor, bookingId],
        );
        return { success: false, adjustmentMinor, action: 'NO_PAYMENT_METHOD', reason: 'No stripe_customer_id on file' };
      }

      const pmRows = await this.dataSource.query(
        `SELECT stripe_payment_method_id FROM public.saved_payment_methods
         WHERE customer_id=$1 AND tenant_id=$2 AND is_default=true LIMIT 1`,
        [b.customer_id, tenantId],
      );
      if (!pmRows.length) {
        await this.dataSource.query(
          `UPDATE public.bookings
           SET adjustment_amount_minor=$1, adjustment_status='NO_PAYMENT_METHOD', updated_at=now()
           WHERE id=$2`,
          [adjustmentMinor, bookingId],
        );
        return { success: false, adjustmentMinor, action: 'NO_PAYMENT_METHOD', reason: 'No default payment method' };
      }

      let pi: any;
      let stripeError: string | null = null;
      try {
        pi = await stripe.paymentIntents.create({
          amount:         adjustmentMinor,
          currency:       (b.currency ?? 'AUD').toLowerCase(),
          customer:       b.stripe_customer_id,
          payment_method: pmRows[0].stripe_payment_method_id,
          confirm:        true,
          off_session:    true,
          metadata: { tenant_id: tenantId, booking_id: bookingId, payment_type: 'ADJUSTMENT', admin_id: adminId },
        });
      } catch (err: any) {
        stripeError = err.message ?? String(err);
      }

      if (stripeError || !pi) {
        await this.dataSource.query(
          `UPDATE public.bookings
           SET adjustment_amount_minor=$1, adjustment_status='FAILED', updated_at=now()
           WHERE id=$2`,
          [adjustmentMinor, bookingId],
        );
        return { success: false, adjustmentMinor, action: 'CHARGE_FAILED', reason: stripeError };
      }

      // Charge succeeded — update booking and insert payments row
      await this.dataSource.query(
        `UPDATE public.bookings
         SET adjustment_amount_minor=$1, adjustment_status='SETTLED',
             settled_at=now(), updated_at=now()
         WHERE id=$2`,
        [adjustmentMinor, bookingId],
      );
      await this.dataSource.query(
        `INSERT INTO public.payments (
           tenant_id, booking_id, stripe_payment_intent_id, payment_type,
           currency, amount_authorized_minor, amount_captured_minor,
           amount_refunded_minor, payment_status, created_at, updated_at
         ) VALUES ($1,$2,$3,'ADJUSTMENT',$4,$5,$5,0,'PAID',NOW(),NOW())
         ON CONFLICT (tenant_id, stripe_payment_intent_id) DO NOTHING`,
        [tenantId, bookingId, pi.id, b.currency ?? 'AUD', adjustmentMinor],
      ).catch((dbErr: any) =>
        console.error('[settleBooking] Failed to insert ADJUSTMENT payments row:', dbErr?.message, 'PI:', pi.id),
      );

      return { success: true, adjustmentMinor, action: 'CHARGED', paymentIntentId: pi.id };
    }

    // ── Negative delta: refund over-collected amount ──────────────────────────
    // Find the original INITIAL PAID payments row to refund against
    const initPayment = await this.dataSource.query(
      `SELECT stripe_payment_intent_id FROM public.payments
       WHERE booking_id=$1 AND payment_type='INITIAL' AND payment_status='PAID'
       ORDER BY created_at ASC LIMIT 1`,
      [bookingId],
    );
    if (!initPayment.length) {
      // Cannot refund — no original payment row; mark SETTLED with explanation
      console.warn(`[settleBooking] Booking ${bookingId} has negative delta but no INITIAL payments row; marking SETTLED without refund`);
      await this.dataSource.query(
        `UPDATE public.bookings
         SET adjustment_amount_minor=$1, adjustment_status='SETTLED',
             settled_at=now(), updated_at=now()
         WHERE id=$2`,
        [adjustmentMinor, bookingId],
      );
      return { success: false, adjustmentMinor, action: 'REFUND_SKIPPED', reason: 'No INITIAL payments row found to refund against' };
    }

    const refundMinor = Math.abs(adjustmentMinor);
    try {
      await stripe.refunds.create({
        payment_intent: initPayment[0].stripe_payment_intent_id,
        amount: refundMinor,
      });
    } catch (err: any) {
      return { success: false, adjustmentMinor, action: 'REFUND_FAILED', reason: err.message };
    }

    // Refund succeeded
    await this.dataSource.query(
      `UPDATE public.bookings
       SET adjustment_amount_minor=$1, adjustment_status='SETTLED',
           settled_at=now(), updated_at=now()
       WHERE id=$2`,
      [adjustmentMinor, bookingId],
    );
    // Update original payments row to reflect refund
    await this.dataSource.query(
      `UPDATE public.payments
       SET amount_refunded_minor = amount_refunded_minor + $1,
           payment_status = CASE
             WHEN (amount_captured_minor - amount_refunded_minor - $1) <= 0 THEN 'REFUNDED'
             ELSE 'PARTIALLY_REFUNDED'
           END,
           updated_at = now()
       WHERE stripe_payment_intent_id = $2`,
      [refundMinor, initPayment[0].stripe_payment_intent_id],
    ).catch(() => {});

    return { success: true, adjustmentMinor, action: 'REFUNDED', refundMinor };
  }

  private toUtcFromLocal(local: string, timeZone: string): string {
    if (!local) return local;
    if (/Z$|[+-]\d{2}:?\d{2}$/.test(local)) {
      const d = new Date(local);
      return Number.isNaN(d.getTime()) ? local : d.toISOString();
    }

    const [datePart, timePartRaw] = local.split('T');
    const timePart = (timePartRaw ?? '00:00:00').slice(0, 8);
    const [y, m, d] = datePart.split('-').map(Number);
    const [hh, mm, ss] = timePart.split(':').map(Number);
    if (!y || !m || !d) return local;

    const utcGuess = new Date(Date.UTC(y, m - 1, d, hh || 0, mm || 0, ss || 0));
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).formatToParts(utcGuess);
      const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00';
      const tzY = Number(get('year'));
      const tzM = Number(get('month'));
      const tzD = Number(get('day'));
      const tzH = Number(get('hour'));
      const tzMin = Number(get('minute'));
      const tzS = Number(get('second'));
      const tzTime = Date.UTC(tzY, tzM - 1, tzD, tzH, tzMin, tzS);
      const offset = tzTime - utcGuess.getTime();
      const utc = Date.UTC(y, m - 1, d, hh || 0, mm || 0, ss || 0) - offset;
      return new Date(utc).toISOString();
    } catch {
      const dObj = new Date(`${datePart}T${timePart}Z`);
      return Number.isNaN(dObj.getTime()) ? local : dObj.toISOString();
    }
  }
}
