import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PricingResolver } from '../pricing/pricing.resolver';
import { randomUUID } from 'crypto';

@Injectable()
export class BookingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly pricing: PricingResolver
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
        a.status as assignment_status
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
      `SELECT * FROM public.bookings WHERE id = $1 AND tenant_id = $2`,
      [bookingId, tenantId],
    );
    if (!bookings.length) throw new NotFoundException('Booking not found');
    const booking = bookings[0];

    const [history, assignments, payments] = await Promise.all([
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
        ? {
            summary,
            items: payments,
          }
        : null,
    };
  }

  async createBooking(tenantId: string, dto: any) {
    const id = randomUUID();
    const now = new Date().toISOString();
    const pickupAtUtc = dto.pickup_at_utc;
    const pickupTimezone = dto.timezone || 'Australia/Sydney';

    // Fetch toll_enabled flag from service class
    let tollEnabled = false;
    if (dto.service_class_id) {
      const scRows = await this.dataSource.query(
        `SELECT toll_enabled FROM public.tenant_service_classes
         WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
        [dto.service_class_id, tenantId],
      );
      tollEnabled = scRows[0]?.toll_enabled ?? false;
    }

    const pricingContext: any = {
      tenantId,
      serviceClassId: dto.service_class_id,
      serviceTypeId: dto.service_type_id ?? null,
      distanceKm: dto.distance_km ?? 0,
      durationMinutes: dto.duration_minutes ?? 0,
      waypointsCount: Array.isArray(dto.waypoints) ? dto.waypoints.length : 0,
      babyseatCount: dto.babyseat_count ?? 0,
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

    const pricing = await this.pricing.resolve(pricingContext);

    const bookingRows = await this.dataSource.query(
      `INSERT INTO public.bookings
       (id, tenant_id, booking_reference, booking_source,
        customer_first_name, customer_last_name, customer_email,
        customer_phone_country_code, customer_phone_number,
        pickup_address_text, pickup_lat, pickup_lng, pickup_place_id,
        dropoff_address_text, dropoff_lat, dropoff_lng, dropoff_place_id,
        pickup_at_utc, timezone, passenger_count, luggage_count,
        special_requests, pricing_snapshot, total_price_minor, currency,
        booking_status, operational_status, payment_status,
        estimated_duration_seconds, created_at, updated_at,
        passenger_first_name, passenger_last_name,
        passenger_phone_country_code, passenger_phone_number,
        passenger_is_customer,
        customer_id, passenger_id,
        is_return_trip, return_pickup_at_utc, return_pickup_address_text,
        return_pickup_lat, return_pickup_lng, return_pickup_place_id,
        service_class_id, service_type_id
       )
       VALUES ($1,$2,$3,$4,
               $5,$6,$7,
               $8,$9,
               $10,$11,$12,$13,
               $14,$15,$16,$17,
               $18,$19,$20,$21,
               $22,$23,$24,$25,
               $26,$27,$28,
               $29,$30,
               $31,$32,
               $33,$34,
               $35,
               $36,$37,
               $38,$39,$40,
               $41,$42,$43,
               $44,$45
       )
       RETURNING *`,
      [
        id,
        tenantId,
        dto.booking_reference ?? `BK-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
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
        'PENDING',
        dto.operational_status ?? 'PENDING',
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
      ],
    );

    await this.dataSource.query(
      `INSERT INTO public.booking_status_history
       (id, tenant_id, booking_id, previous_status, new_status, triggered_by, reason, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [randomUUID(), tenantId, id, null, dto.operational_status ?? 'PENDING', null, null, now],
    );

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

      if (['CANCELLED', 'COMPLETED'].includes(booking.operational_status)) {
        return { success: true };
      }

      const updated = await manager.query(
        `UPDATE public.bookings
         SET operational_status = 'CANCELLED',
             updated_at = now()
         WHERE id = $1
           AND operational_status IN ('DRAFT','PENDING','CONFIRMED','ASSIGNED')
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

      return { success: true };
    });
  }
}
