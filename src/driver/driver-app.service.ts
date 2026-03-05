import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * DriverAppService — driver-facing API (iOS/Android driver app)
 * All endpoints scoped to the authenticated driver's own data.
 */
@Injectable()
export class DriverAppService {
  constructor(private readonly dataSource: DataSource) {}

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
         COALESCE(b.booster_seats, 0) AS booster_seats
       FROM assignments a
       JOIN bookings b ON b.id = a.booking_id
       LEFT JOIN tenant_service_classes sc ON sc.id = b.service_class_id
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

    // If job_done, mark booking completed
    if (newStatus === 'job_done') {
      await this.dataSource.query(
        `UPDATE bookings SET operational_status = 'JOB_COMPLETED', updated_at = NOW()
         WHERE id = (SELECT booking_id FROM assignments WHERE id = $1)`,
        [assignmentId],
      );
    }

    return { success: true, new_status: newStatus };
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

  async saveApnsToken(userId: string, token: string, platform: string = 'ios') {
    const me = await this.getMe(userId);
    await this.dataSource.query(
      `UPDATE users SET apns_token = $1, apns_platform = $2 WHERE id = $3`,
      [token, platform, me.driver_id],
    );
    return { success: true };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private readonly assignmentSelect = `
    a.id,
    a.booking_id,
    a.driver_id,
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
    COALESCE(b.booster_seats, 0) AS booster_seats
  `;

  private shapeAssignment(row: any) {
    return {
      id: row.id,
      booking_id: row.booking_id,
      booking_reference: row.booking_reference,
      pickup_at: row.pickup_at_utc,
      pickup_location: row.pickup_address_text,
      dropoff_location: row.dropoff_address_text,
      vehicle_name: null,
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

    return {
      // Assignment
      id: row.id,
      booking_id: row.booking_id,
      driver_id: row.driver_id,
      driver_execution_status: row.driver_execution_status,
      driver_pay_amount: row.driver_pay_minor ? row.driver_pay_minor / 100 : null,
      toll_parking_amount: row.toll_parking_minor ? row.toll_parking_minor / 100 : null,
      dispatch_notes: row.dispatch_notes,
      driver_remarks: row.driver_remarks,
      status_locations: row.status_locations ?? {},
      driver_payout_status: row.driver_payout_status,
      post_job_status: row.post_job_status,
      // Nested booking (same key as legacy app expects)
      booking: {
        id: row.booking_id,
        booking_number: row.booking_reference,
        pickup_at: row.pickup_at_utc,
        pickup_location: row.pickup_address_text,
        dropoff_location: row.dropoff_address_text,
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
        return_pickup_at: row.return_pickup_at_utc,
        return_pickup_location: row.return_pickup_address_text,
        waypoint_addresses: row.waypoints ?? [],
        fare_total: row.total_price_minor ? row.total_price_minor / 100 : null,
        timezone: row.timezone,
        passenger_name: passengerName,
        passenger_phone: passengerPhone,
        passenger_type: passengerName ? 'other' : 'customer',
        // Baby seats
        baby_seats: (row.infant_seats ?? 0) + (row.toddler_seats ?? 0) + (row.booster_seats ?? 0),
        infant_seats:  row.infant_seats  ?? 0,
        toddler_seats: row.toddler_seats ?? 0,
        booster_seats: row.booster_seats ?? 0,
      },
    };
  }
}
