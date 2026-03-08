import { Injectable, NotFoundException, ForbiddenException, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * DriverAppService — driver-facing API (iOS/Android driver app)
 * All endpoints scoped to the authenticated driver's own data.
 */
@Injectable()
export class DriverAppService implements OnModuleInit {
  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    // Auto-migrate: driver_trip_reviews table
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS public.driver_trip_reviews (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id        UUID NOT NULL,
        assignment_id    UUID NOT NULL UNIQUE,
        booking_id       UUID NOT NULL,
        driver_id        UUID NOT NULL,
        passenger_rating INT CHECK (passenger_rating BETWEEN 1 AND 5),
        notes            TEXT,
        flags            TEXT[],
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `).catch(() => {});
  }

  // ─── Me ─────────────────────────────────────────────────────────────────

  async getMe(userId: string) {
    const rows = await this.dataSource.query(
      `SELECT u.id AS driver_id, u.full_name, u.email,
              u.phone_country_code, u.phone_number,
              m.tenant_id, m.status AS membership_status,
              COALESCE(ds.status, 'OFFLINE') AS availability_status
       FROM users u
       JOIN memberships m ON m.user_id = u.id AND m.role = 'driver'
       LEFT JOIN dispatch_driver_status ds ON ds.driver_id = u.id AND ds.tenant_id = m.tenant_id
       WHERE u.id = $1
       LIMIT 1`,
      [userId],
    );
    if (!rows.length) throw new NotFoundException('Driver not found');
    return rows[0];
  }

  // ─── Dashboard ──────────────────────────────────────────────────────────

  async getDashboard(userId: string) {
    const me = await this.getMe(userId);
    const tenantId = me.tenant_id;
    const driverId = me.driver_id;

    const sydneyNow = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Australia/Sydney' }),
    );
    const todayStart = new Date(sydneyNow);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(sydneyNow);
    todayEnd.setHours(23, 59, 59, 999);

    const monthStart = new Date(sydneyNow.getFullYear(), sydneyNow.getMonth(), 1);
    const weekStart = new Date(sydneyNow);
    weekStart.setDate(sydneyNow.getDate() - sydneyNow.getDay());

    // Today & upcoming assignments with nested booking
    const assignments = await this.dataSource.query(
      `SELECT
         a.id,
         a.driver_execution_status,
         a.driver_pay_minor,
         a.toll_parking_minor,
         a.dispatch_notes,
         b.id               AS booking_id,
         b.booking_reference,
         b.pickup_at_utc,
         b.pickup_address_text,
         b.dropoff_address_text,
         b.service_class_id,
         sc.name            AS service_type_name,
         b.total_price_minor,
         b.currency,
         b.passenger_count,
         b.luggage_count,
         b.special_requests AS notes,
         NULL AS flight_number,
         b.is_return_trip,
         b.return_pickup_at_utc,
         b.waypoints,
         COALESCE(b.infant_seats, 0)  AS infant_seats,
         COALESCE(b.toddler_seats, 0) AS toddler_seats,
         COALESCE(b.booster_seats, 0) AS booster_seats,
         CONCAT(pv.make, ' ', pv.model) AS vehicle_name,
         tv.plate                        AS vehicle_plate
       FROM assignments a
       JOIN bookings b ON b.id = a.booking_id
       LEFT JOIN tenant_service_classes sc ON sc.id = b.service_class_id
       LEFT JOIN tenant_vehicles tv ON tv.id = a.vehicle_id
       LEFT JOIN platform_vehicles pv ON pv.id = tv.platform_vehicle_id
       WHERE a.driver_id = $1
         AND a.tenant_id = $2
         AND a.driver_execution_status NOT IN ('job_done','cancelled')
       ORDER BY b.pickup_at_utc ASC
       LIMIT 50`,
      [driverId, tenantId],
    );

    const todayJobs = assignments
      .filter((a: any) => {
        const t = new Date(a.pickup_at_utc);
        return t >= todayStart && t <= todayEnd;
      })
      .map(this.shapeAssignment);

    const upcomingJobs = assignments
      .filter((a: any) => new Date(a.pickup_at_utc) > todayEnd)
      .map(this.shapeAssignment);

    // Stats
    const [statsRow] = await this.dataSource.query(
      `SELECT
         COUNT(*) FILTER (WHERE b.pickup_at_utc::date = CURRENT_DATE AT TIME ZONE 'Australia/Sydney')                    AS today_count,
         COUNT(*) FILTER (WHERE b.pickup_at_utc >= (NOW() AT TIME ZONE 'Australia/Sydney')::date - INTERVAL '7 days')    AS week_count,
         COALESCE(SUM(a.driver_pay_minor) FILTER (
           WHERE b.pickup_at_utc >= DATE_TRUNC('month', NOW() AT TIME ZONE 'Australia/Sydney')
             AND a.driver_execution_status = 'job_done'
         ), 0) AS month_earnings_minor
       FROM assignments a
       JOIN bookings b ON b.id = a.booking_id
       WHERE a.driver_id = $1 AND a.tenant_id = $2`,
      [driverId, tenantId],
    );

    return {
      today_jobs: todayJobs,
      upcoming_jobs: upcomingJobs,
      stats: {
        today_count: Number(statsRow.today_count),
        week_count: Number(statsRow.week_count),
        month_earnings: Number(statsRow.month_earnings_minor) / 100,
      },
    };
  }

  // ─── Assignments ─────────────────────────────────────────────────────────

  async listAssignments(userId: string, filter?: string) {
    const me = await this.getMe(userId);

    let statusFilter = `a.driver_execution_status NOT IN ('job_done','cancelled')`;
    if (filter === 'active') {
      statusFilter = `a.driver_execution_status IN ('accepted','on_the_way','arrived','passenger_on_board')`;
    } else if (filter === 'upcoming') {
      statusFilter = `a.driver_execution_status IN ('assigned','accepted')`;
    } else if (filter === 'completed') {
      statusFilter = `a.driver_execution_status = 'job_done'`;
    }

    const rows = await this.dataSource.query(
      `SELECT ${this.assignmentSelect}
       FROM assignments a
       JOIN bookings b ON b.id = a.booking_id
       LEFT JOIN tenant_service_classes sc ON sc.id = b.service_class_id
       LEFT JOIN tenant_vehicles tv ON tv.id = a.vehicle_id
       LEFT JOIN platform_vehicles pv ON pv.id = tv.platform_vehicle_id
       WHERE a.driver_id = $1 AND a.tenant_id = $2 AND ${statusFilter}
       ORDER BY b.pickup_at_utc DESC
       LIMIT 100`,
      [me.driver_id, me.tenant_id],
    );

    return rows.map(this.shapeFullAssignment);
  }

  async getAssignment(userId: string, assignmentId: string) {
    const me = await this.getMe(userId);

    const rows = await this.dataSource.query(
      `SELECT ${this.assignmentSelect}
       FROM assignments a
       JOIN bookings b ON b.id = a.booking_id
       LEFT JOIN tenant_service_classes sc ON sc.id = b.service_class_id
       LEFT JOIN tenant_vehicles tv ON tv.id = a.vehicle_id
       LEFT JOIN platform_vehicles pv ON pv.id = tv.platform_vehicle_id
       WHERE a.id = $1 AND a.driver_id = $2 AND a.tenant_id = $3
       LIMIT 1`,
      [assignmentId, me.driver_id, me.tenant_id],
    );

    if (!rows.length) throw new NotFoundException('Assignment not found');
    return this.shapeFullAssignment(rows[0]);
  }

  async updateExecutionStatus(
    userId: string,
    assignmentId: string,
    newStatus: string,
    location?: { lat: number; lng: number },
    remarks?: string,
  ) {
    const me = await this.getMe(userId);

    const rows = await this.dataSource.query(
      `SELECT id, driver_execution_status FROM assignments WHERE id = $1 AND driver_id = $2`,
      [assignmentId, me.driver_id],
    );
    if (!rows.length) throw new ForbiddenException('Assignment not found');

    const validTransitions: Record<string, string[]> = {
      assigned: ['accepted'],
      accepted: ['on_the_way'],
      on_the_way: ['arrived'],
      arrived: ['passenger_on_board'],
      passenger_on_board: ['job_done'],
      job_done: ['fulfilled'],
    };

    const current = rows[0].driver_execution_status;
    if (!validTransitions[current]?.includes(newStatus)) {
      throw new ForbiddenException(`Cannot transition from ${current} to ${newStatus}`);
    }

    const locationUpdate = location
      ? `, status_locations = COALESCE(status_locations, '{}'::jsonb) || jsonb_build_object($4::text, jsonb_build_object('timestamp', NOW()::text, 'lat', $5::float, 'lng', $6::float))`
      : '';

    const params: any[] = [newStatus, remarks ?? null, assignmentId];
    if (location) params.push(newStatus, location.lat, location.lng);

    await this.dataSource.query(
      `UPDATE assignments
       SET driver_execution_status = $1,
           driver_remarks = COALESCE($2, driver_remarks),
           updated_at = NOW()
           ${locationUpdate}
       WHERE id = $3`,
      params,
    );

    // job_done → booking COMPLETED
    if (newStatus === 'job_done') {
      await this.dataSource.query(
        `UPDATE bookings SET operational_status = 'COMPLETED', updated_at = NOW()
         WHERE id = (SELECT booking_id FROM assignments WHERE id = $1)`,
        [assignmentId],
      );
    }

    // fulfilled → booking FULFILLED (triggers invoice generation)
    if (newStatus === 'fulfilled') {
      const bookingRows = await this.dataSource.query(
        `UPDATE bookings SET operational_status = 'FULFILLED', settled_at = NOW(), updated_at = NOW()
         WHERE id = (SELECT booking_id FROM assignments WHERE id = $1)
         RETURNING id, tenant_id, pricing_snapshot, total_price_minor`,
        [assignmentId],
      );
      // Emit event for invoice auto-generation (no extra = auto)
      if (bookingRows[0]) {
        await this.dataSource.query(
          `INSERT INTO public.booking_status_history
           (id, tenant_id, booking_id, previous_status, new_status, triggered_by, reason, created_at)
           VALUES (gen_random_uuid(), $1, $2, 'COMPLETED', 'FULFILLED', 'DRIVER', 'Driver fulfilled', NOW())`,
          [bookingRows[0].tenant_id, bookingRows[0].id],
        ).catch(() => {});
      }
    }

    return { success: true, new_status: newStatus };
  }

  // ─── Trip Review + Fulfilled ─────────────────────────────────────────────

  async submitTripReview(
    userId: string,
    assignmentId: string,
    body: {
      passenger_rating: number;
      notes?: string;
      flags?: string[];
    },
  ) {
    const me = await this.getMe(userId);

    // Verify assignment is in job_done state
    const rows = await this.dataSource.query(
      `SELECT id, booking_id, driver_execution_status
       FROM public.assignments
       WHERE id = $1 AND driver_id = $2 AND tenant_id = $3`,
      [assignmentId, me.driver_id, me.tenant_id],
    );
    if (!rows.length) throw new NotFoundException('Assignment not found');
    if (rows[0].driver_execution_status !== 'job_done') {
      throw new ForbiddenException('Review can only be submitted after job_done');
    }

    const bookingId = rows[0].booking_id;

    // Upsert review
    await this.dataSource.query(
      `INSERT INTO public.driver_trip_reviews
         (tenant_id, assignment_id, booking_id, driver_id, passenger_rating, notes, flags)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (assignment_id) DO UPDATE
         SET passenger_rating = EXCLUDED.passenger_rating,
             notes = EXCLUDED.notes,
             flags = EXCLUDED.flags`,
      [
        me.tenant_id,
        assignmentId,
        bookingId,
        me.driver_id,
        body.passenger_rating,
        body.notes ?? null,
        body.flags ?? [],
      ],
    );

    // Auto-transition: job_done → fulfilled
    await this.dataSource.query(
      `UPDATE public.assignments
       SET driver_execution_status = 'fulfilled', updated_at = NOW()
       WHERE id = $1`,
      [assignmentId],
    );

    // Mark booking FULFILLED
    await this.dataSource.query(
      `UPDATE public.bookings
       SET operational_status = 'FULFILLED', settled_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [bookingId],
    );

    // Status history
    await this.dataSource.query(
      `INSERT INTO public.booking_status_history
         (id, tenant_id, booking_id, previous_status, new_status, triggered_by, reason, created_at)
       VALUES (gen_random_uuid(), $1, $2, 'COMPLETED', 'FULFILLED', 'DRIVER', 'Driver submitted trip review', NOW())`,
      [me.tenant_id, bookingId],
    ).catch(() => {});

    return { success: true, status: 'fulfilled' };
  }

  async getTripReview(userId: string, assignmentId: string) {
    const me = await this.getMe(userId);
    const rows = await this.dataSource.query(
      `SELECT r.* FROM public.driver_trip_reviews r
       JOIN public.assignments a ON a.id = r.assignment_id
       WHERE r.assignment_id = $1 AND a.driver_id = $2`,
      [assignmentId, me.driver_id],
    );
    return rows[0] ?? null;
  }

  async submitExtraReport(
    driverId: string,
    tenantId: string,
    body: {
      assignment_id: string;
      extra_waypoints?: string[];
      waiting_minutes?: number;
      extra_toll?: number;
      extra_parking?: number;
      notes?: string;
    },
  ) {
    // Verify assignment belongs to this driver
    const rows = await this.dataSource.query(
      `SELECT id, booking_id FROM public.assignments
       WHERE id = $1 AND driver_id = $2 AND driver_execution_status = 'job_done'`,
      [body.assignment_id, driverId],
    );
    if (!rows.length) throw new ForbiddenException('Assignment not found or not in job_done state');

    const assignment = rows[0];

    // Upsert — one report per assignment
    const existing = await this.dataSource.query(
      `SELECT id FROM public.driver_extra_reports WHERE assignment_id = $1`,
      [body.assignment_id],
    );

    if (existing.length) {
      await this.dataSource.query(
        `UPDATE public.driver_extra_reports
         SET extra_waypoints = $1, waiting_minutes = $2, extra_toll = $3,
             extra_parking = $4, notes = $5, status = 'pending', updated_at = NOW()
         WHERE assignment_id = $6`,
        [
          body.extra_waypoints ?? [],
          body.waiting_minutes ?? null,
          body.extra_toll ?? null,
          body.extra_parking ?? null,
          body.notes ?? null,
          body.assignment_id,
        ],
      );
    } else {
      await this.dataSource.query(
        `INSERT INTO public.driver_extra_reports
         (tenant_id, assignment_id, booking_id, driver_id, extra_waypoints,
          waiting_minutes, extra_toll, extra_parking, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          tenantId,
          body.assignment_id,
          assignment.booking_id,
          driverId,
          body.extra_waypoints ?? [],
          body.waiting_minutes ?? null,
          body.extra_toll ?? null,
          body.extra_parking ?? null,
          body.notes ?? null,
        ],
      );
    }

    // Update assignment post_job_status
    await this.dataSource.query(
      `UPDATE public.assignments SET post_job_status = 'submitted', updated_at = NOW()
       WHERE id = $1`,
      [body.assignment_id],
    );

    return { success: true };
  }

  async getExtraReport(driverId: string, assignmentId: string) {
    const rows = await this.dataSource.query(
      `SELECT r.* FROM public.driver_extra_reports r
       JOIN public.assignments a ON a.id = r.assignment_id
       WHERE r.assignment_id = $1 AND a.driver_id = $2`,
      [assignmentId, driverId],
    );
    return rows[0] ?? null;
  }

  async updateLocation(userId: string, lat: number, lng: number) {
    const me = await this.getMe(userId);
    await this.dataSource.query(
      `INSERT INTO dispatch_driver_status (driver_id, tenant_id, lat, lng, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (driver_id, tenant_id)
       DO UPDATE SET lat = $3, lng = $4, updated_at = NOW()`,
      [me.driver_id, me.tenant_id, lat, lng],
    );
    return { success: true };
  }

  async selfUnbind(userId: string, reason?: string) {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `SELECT tenant_id FROM public.memberships
         WHERE user_id = $1 AND role = 'driver' AND status = 'active'`,
        [userId],
      );
      if (!rows.length) throw new NotFoundException('No active tenant binding found');
      const tenantId = rows[0].tenant_id;

      await manager.query(
        `UPDATE public.memberships SET status = 'disabled', updated_at = NOW()
         WHERE user_id = $1 AND role = 'driver' AND status = 'active'`,
        [userId],
      );

      await manager.query(
        `UPDATE public.driver_binding_history
         SET unbound_at = NOW(), unbound_by = 'driver', unbound_reason = $2
         WHERE user_id = $1 AND tenant_id = $3 AND unbound_at IS NULL`,
        [userId, reason ?? null, tenantId],
      );

      return { success: true, message: 'You have been unbound from the tenant' };
    });
  }

  async saveApnsToken(userId: string, token: string, platform: string = 'expo') {
    // token could be an Expo push token (ExponentPushToken[...]) or raw APNs token
    const isExpo = token?.startsWith('ExponentPushToken');
    await this.dataSource.query(
      `UPDATE users
       SET apns_token = $1, apns_platform = $2,
           expo_push_token = CASE WHEN $3 THEN $1 ELSE expo_push_token END,
           updated_at = now()
       WHERE id = $4`,
      [token, platform, isExpo, userId],
    );
    return { success: true };
  }

  async sendExpoPush(driverId: string, title: string, body: string, data?: Record<string, any>) {
    const rows = await this.dataSource.query(
      `SELECT expo_push_token FROM users WHERE id = $1`,
      [driverId],
    );
    const token = rows[0]?.expo_push_token;
    if (!token) return { sent: false, reason: 'no_token' };

    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          to: token,
          title,
          body,
          data: data ?? {},
          sound: 'default',
          priority: 'high',
          channelId: 'default',
        }),
      });
      const json = await res.json() as any;
      return { sent: true, result: json };
    } catch (e: any) {
      return { sent: false, error: e?.message };
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private readonly assignmentSelect = `
    a.id,
    a.booking_id,
    a.driver_id,
    a.leg,
    a.driver_execution_status,
    a.driver_pay_minor,
    a.toll_parking_minor,
    a.dispatch_notes,
    a.driver_remarks,
    a.status_locations,
    a.driver_payout_status,
    a.post_job_status,
    b.booking_reference,
    b.pickup_at_utc,
    b.pickup_address_text,
    b.dropoff_address_text,
    b.service_class_id,
    sc.name            AS service_type_name,
    b.total_price_minor,
    b.currency,
    b.passenger_count,
    b.luggage_count,
    b.special_requests AS notes,
    NULL AS admin_note,
    NULL AS flight_number,
    b.is_return_trip,
    b.return_pickup_at_utc,
    b.return_pickup_address_text,
    b.waypoints,
    b.operational_status,
    b.timezone,
    b.customer_id,
    b.passenger_first_name,
    b.passenger_last_name,
    b.passenger_phone_country_code,
    b.passenger_phone_number,
    COALESCE(b.infant_seats, 0)  AS infant_seats,
    COALESCE(b.toddler_seats, 0) AS toddler_seats,
    COALESCE(b.booster_seats, 0) AS booster_seats,
    CONCAT(pv.make, ' ', pv.model) AS vehicle_name,
    tv.plate                        AS vehicle_plate
  `;

  private shapeAssignment(row: any) {
    return {
      id: row.id,
      booking_id: row.booking_id,
      booking_reference: row.booking_reference,
      pickup_at: row.pickup_at_utc,
      pickup_location: row.pickup_address_text,
      dropoff_location: row.dropoff_address_text,
      vehicle_name: row.vehicle_name ?? null,
      vehicle_plate: row.vehicle_plate ?? null,
      driver_execution_status: row.driver_execution_status,
      service_type: row.service_type_name,
      driver_pay_minor: row.driver_pay_minor,
      currency: row.currency,
      baby_seats: (row.infant_seats ?? 0) + (row.toddler_seats ?? 0) + (row.booster_seats ?? 0),
      infant_seats:  row.infant_seats  ?? 0,
      toddler_seats: row.toddler_seats ?? 0,
      booster_seats: row.booster_seats ?? 0,
    };
  }

  private shapeFullAssignment(row: any) {
    const passengerName = [row.passenger_first_name, row.passenger_last_name]
      .filter(Boolean)
      .join(' ') || null;
    const passengerPhone =
      row.passenger_phone_number
        ? `${row.passenger_phone_country_code ?? ''}${row.passenger_phone_number}`
        : null;

    // Leg B = return leg: swap pickup↔dropoff, use return_pickup_at as pickup time
    const isLegB = row.leg === 'B';
    const pickupAt       = isLegB ? row.return_pickup_at_utc   : row.pickup_at_utc;
    const pickupLocation = isLegB ? row.return_pickup_address_text : row.pickup_address_text;
    const dropoffLocation = isLegB ? row.pickup_address_text   : row.dropoff_address_text;

    return {
      // Assignment
      id: row.id,
      booking_id: row.booking_id,
      driver_id: row.driver_id,
      leg: row.leg ?? 'A',
      driver_execution_status: row.driver_execution_status,
      driver_pay_amount: row.driver_pay_minor ? row.driver_pay_minor / 100 : null,
      toll_parking_amount: row.toll_parking_minor ? row.toll_parking_minor / 100 : null,
      dispatch_notes: row.dispatch_notes,
      driver_remarks: row.driver_remarks,
      status_locations: row.status_locations ?? {},
      driver_payout_status: row.driver_payout_status,
      post_job_status: row.post_job_status,
      // Nested booking — Leg B uses return trip addresses/time
      booking: {
        id: row.booking_id,
        booking_number: row.booking_reference,
        pickup_at: pickupAt,
        pickup_location: pickupLocation,
        dropoff_location: dropoffLocation,
        service_type: row.service_type_name,
        order_status: row.operational_status,
        total_price_minor: row.total_price_minor,
        currency: row.currency,
        passengers: row.passenger_count?.toString() ?? null,
        luggage: row.luggage_count?.toString() ?? null,
        notes: row.notes,
        admin_note: row.admin_note,
        flight_number: row.flight_number,
        is_return_trip: row.is_return_trip,
        leg: row.leg ?? 'A',
        // Keep original fields for reference
        original_pickup_at: row.pickup_at_utc,
        original_pickup_location: row.pickup_address_text,
        return_pickup_at: row.return_pickup_at_utc,
        return_pickup_location: row.return_pickup_address_text,
        waypoint_addresses: row.waypoints ?? [],
        fare_total: row.total_price_minor ? row.total_price_minor / 100 : null,
        timezone: row.timezone,
        passenger_name: passengerName,
        passenger_phone: passengerPhone,
        passenger_type: passengerName ? 'other' : 'customer',
        baby_seats: (row.infant_seats ?? 0) + (row.toddler_seats ?? 0) + (row.booster_seats ?? 0),
        infant_seats:  row.infant_seats  ?? 0,
        toddler_seats: row.toddler_seats ?? 0,
        booster_seats: row.booster_seats ?? 0,
        vehicle_name:  row.vehicle_name  ?? null,
        vehicle_plate: row.vehicle_plate ?? null,
      },
      vehicle_name:  row.vehicle_name  ?? null,
      vehicle_plate: row.vehicle_plate ?? null,
    };
  }

  // ─── Banking ────────────────────────────────────────────────────────────

  async updateBanking(driverId: string, body: {
    abn?: string;
    bank_bsb?: string;
    bank_account?: string;
    bank_name?: string;
    is_gst_registered?: boolean;
  }) {
    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;
    if (body.abn !== undefined)              { sets.push(`abn = $${i++}`);              vals.push(body.abn); }
    if (body.bank_bsb !== undefined)         { sets.push(`bank_bsb = $${i++}`);         vals.push(body.bank_bsb); }
    if (body.bank_account !== undefined)     { sets.push(`bank_account = $${i++}`);     vals.push(body.bank_account); }
    if (body.bank_name !== undefined)        { sets.push(`bank_name = $${i++}`);        vals.push(body.bank_name); }
    if (body.is_gst_registered !== undefined){ sets.push(`is_gst_registered = $${i++}`); vals.push(body.is_gst_registered); }
    if (!sets.length) return { updated: false };
    sets.push(`updated_at = now()`);
    vals.push(driverId);
    await this.dataSource.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${i}`,
      vals,
    );
    return { updated: true };
  }

  // ─── Driver Invoices ────────────────────────────────────────────────────

  async listDriverInvoices(driverId: string) {
    return this.dataSource.query(
      `SELECT i.id, i.invoice_number, i.status, i.total_minor, i.currency,
              i.created_at, i.submitted_at, i.paid_at
       FROM driver_invoices i
       WHERE i.driver_id = $1
       ORDER BY i.created_at DESC`,
      [driverId],
    );
  }

  async getInvoiceableJobs(driverId: string) {
    return this.dataSource.query(
      `SELECT a.id, a.driver_pay_minor, a.currency,
              b.booking_reference, b.pickup_at_utc, b.pickup_address_text, b.dropoff_address_text
       FROM assignments a
       JOIN bookings b ON b.id = a.booking_id
       WHERE a.driver_id = $1
         AND a.status = 'COMPLETED'
         AND a.id NOT IN (
           SELECT unnest(di.assignment_ids) FROM driver_invoices di WHERE di.driver_id = $1
         )
       ORDER BY b.pickup_at_utc DESC`,
      [driverId],
    );
  }

  async createDriverInvoice(driverId: string, tenantId: string, assignmentIds: string[]) {
    if (!assignmentIds?.length) throw new Error('No assignments provided');
    const rows = await this.dataSource.query(
      `SELECT COALESCE(SUM(driver_pay_minor), 0) AS total, MAX(currency) AS currency
       FROM assignments WHERE id = ANY($1) AND driver_id = $2`,
      [assignmentIds, driverId],
    );
    const total = Number(rows[0]?.total ?? 0);
    const currency = rows[0]?.currency ?? 'AUD';
    const num = `INV-${Date.now()}`;
    const [inv] = await this.dataSource.query(
      `INSERT INTO driver_invoices (driver_id, tenant_id, invoice_number, assignment_ids, total_minor, currency, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT') RETURNING id, invoice_number, status`,
      [driverId, tenantId, num, assignmentIds, total, currency],
    );
    return inv;
  }

  async submitDriverInvoice(driverId: string, invoiceId: string) {
    await this.dataSource.query(
      `UPDATE driver_invoices SET status = 'SUBMITTED', submitted_at = now()
       WHERE id = $1 AND driver_id = $2 AND status = 'DRAFT'`,
      [invoiceId, driverId],
    );
    return { submitted: true };
  }

  async verifyAbn(abn: string) {
    // Simple format validation — ABR lookup requires API key
    const cleaned = abn?.replace(/\s/g, '');
    const valid = /^\d{11}$/.test(cleaned ?? '');
    return { abn: cleaned, abn_verified: valid, abn_name: valid ? 'ABN Valid' : null };
  }
}
