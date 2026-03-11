import { Injectable, NotFoundException, ForbiddenException, BadRequestException, OnModuleInit, Logger, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TripEvidenceService } from '../trip-evidence/trip-evidence.service';

/**
 * DriverAppService — driver-facing API (iOS/Android driver app)
 * All endpoints scoped to the authenticated driver's own data.
 */
@Injectable()
export class DriverAppService implements OnModuleInit {
  private readonly logger = new Logger('DriverAppService');
  constructor(
    private readonly dataSource: DataSource,
    @Optional() private readonly tripEvidence?: TripEvidenceService,
  ) {}

  async onModuleInit() {
    // ── Item 5: DB CHECK constraint for driver_execution_status ───────────────
    // All live values are NULL — safe to add. Guards against direct DB writes.
    await this.dataSource.query(`
      ALTER TABLE public.assignments
        DROP CONSTRAINT IF EXISTS assignments_execution_status_check;
      ALTER TABLE public.assignments
        ADD CONSTRAINT assignments_execution_status_check
          CHECK (driver_execution_status IS NULL OR driver_execution_status IN (
            'assigned','accepted','on_the_way','arrived',
            'passenger_on_board','job_done'
          ));
    `).catch(() => {});
    // ─────────────────────────────────────────────────────────────────────────

    // Auto-migrate: driver_extra_reports table (if not already exists)
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS public.driver_extra_reports (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id        UUID NOT NULL,
        assignment_id    UUID NOT NULL UNIQUE,
        booking_id       UUID NOT NULL,
        driver_id        UUID NOT NULL,
        extra_waypoints  TEXT[] DEFAULT '{}',
        waiting_minutes  INT,
        extra_toll       NUMERIC(10,2),
        extra_parking    NUMERIC(10,2),
        notes            TEXT,
        status           TEXT NOT NULL DEFAULT 'pending',
        admin_note       TEXT,
        reviewed_by      UUID,
        reviewed_at      TIMESTAMPTZ,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `).catch(() => {});

    // ── Driver settlement: driver_payable_reviews ─────────────────────────────
    // Authoritative per-assignment driver payout confirmed by admin after
    // job completion and fulfil review. Used as the source for driver invoice
    // line-item amounts. Driver CANNOT create or edit this record.
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS public.driver_payable_reviews (
        id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id                 UUID NOT NULL,
        booking_id                UUID NOT NULL,
        assignment_id             UUID NOT NULL UNIQUE,
        driver_id                 UUID NOT NULL,

        base_driver_pay_minor     INT  NOT NULL DEFAULT 0,
        extra_waiting_pay_minor   INT  NOT NULL DEFAULT 0,
        extra_waypoint_pay_minor  INT  NOT NULL DEFAULT 0,
        toll_parking_reimburse_minor INT NOT NULL DEFAULT 0,
        other_adjustment_minor    INT  NOT NULL DEFAULT 0,
        total_driver_payable_minor INT  NOT NULL GENERATED ALWAYS AS (
          base_driver_pay_minor + extra_waiting_pay_minor +
          extra_waypoint_pay_minor + toll_parking_reimburse_minor +
          other_adjustment_minor
        ) STORED,

        currency                  TEXT NOT NULL DEFAULT 'AUD',
        review_notes              TEXT,
        reviewed_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        reviewed_by               UUID NOT NULL,

        CONSTRAINT fk_dpr_assignment FOREIGN KEY (assignment_id)
          REFERENCES public.assignments(id) ON DELETE CASCADE
      );
    `).catch(() => {});

    // ── Driver invoice items table ────────────────────────────────────────────
    // One row per job/assignment per driver invoice.
    // driver_payable_amount sourced from driver_payable_reviews.total_driver_payable_minor.
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS public.driver_invoice_items (
        id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        driver_invoice_id      UUID NOT NULL,
        tenant_id              UUID NOT NULL,
        assignment_id          UUID NOT NULL,
        booking_id             UUID NOT NULL,
        booking_reference      TEXT,
        service_date           TIMESTAMPTZ,
        description            TEXT,
        driver_payable_minor   INT  NOT NULL DEFAULT 0,
        currency               TEXT NOT NULL DEFAULT 'AUD',
        payable_review_id      UUID,   -- reference to driver_payable_reviews.id
        created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_dii_invoice ON public.driver_invoice_items(driver_invoice_id);
      CREATE UNIQUE INDEX IF NOT EXISTS uix_dii_assignment
        ON public.driver_invoice_items(driver_invoice_id, assignment_id);
    `).catch(() => {});

    // ── Extend driver_invoices table ─────────────────────────────────────────
    await this.dataSource.query(`
      ALTER TABLE public.driver_invoices
        ADD COLUMN IF NOT EXISTS invoice_status         TEXT,
        ADD COLUMN IF NOT EXISTS paid_by_admin_at       TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS paid_by_admin_by       UUID,
        ADD COLUMN IF NOT EXISTS received_by_driver_at  TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS received_by_driver_by  UUID,
        ADD COLUMN IF NOT EXISTS dispute_reason         TEXT,
        ADD COLUMN IF NOT EXISTS item_count             INT DEFAULT 0;
    `).catch(() => {});

    // Normalise legacy status column (old col is 'status'; new col is 'invoice_status')
    // Copy non-null status → invoice_status for existing rows
    await this.dataSource.query(`
      UPDATE public.driver_invoices
        SET invoice_status = status
      WHERE invoice_status IS NULL AND status IS NOT NULL;
    `).catch(() => {});

    // ── driver_payout_status CHECK constraint ────────────────────────────────
    await this.dataSource.query(`
      ALTER TABLE public.assignments
        DROP CONSTRAINT IF EXISTS assignments_driver_payout_status_check;
      ALTER TABLE public.assignments
        ADD CONSTRAINT assignments_driver_payout_status_check
          CHECK (driver_payout_status IS NULL OR driver_payout_status IN (
            'NOT_READY','AWAITING_ADMIN_REVIEW','READY_FOR_DRIVER_INVOICE',
            'INVOICED','PAID_BY_ADMIN','RECEIVED_BY_DRIVER','DISPUTED'
          ));
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

  // ─── Dual-line model constants ────────────────────────────────────────────
  // DRIVER LINE = execution progress only. Max milestone: job_done.
  // ADMIN LINE  = official business lifecycle (fulfil, settle, invoice).
  // Driver cannot directly move booking to FULFILLED, COMPLETED (accounting),
  // or trigger invoice. Admin remains the authority for those transitions.
  //
  // Item 3 + 7: 'fulfilled' removed from driver-controlled transitions.
  //   Before: job_done → fulfilled (driver could trigger booking=FULFILLED)
  //   After:  job_done is the terminal driver milestone; handoff to admin via report
  //
  // Item 5: ALLOWED_EXECUTION_STATUSES validated at runtime and in DB constraint
  static readonly ALLOWED_EXECUTION_STATUSES = new Set([
    'assigned', 'accepted', 'on_the_way', 'arrived',
    'passenger_on_board', 'job_done',
    // 'fulfilled' intentionally excluded — admin line only
  ]);

  // Valid driver-controlled transitions (sequential; no skipping)
  private static readonly EXECUTION_TRANSITIONS: Record<string, string[]> = {
    assigned:           ['accepted'],
    accepted:           ['on_the_way'],
    on_the_way:         ['arrived'],
    arrived:            ['passenger_on_board'],
    passenger_on_board: ['job_done'],
    // job_done: no driver-controlled next state — must submit report + await admin
  };

  async updateExecutionStatus(
    userId: string,
    assignmentId: string,
    newStatus: string,
    location?: { lat: number; lng: number },
    remarks?: string,
  ) {
    const me = await this.getMe(userId);

    // ── Item 5: validate canonical status value ──────────────────────────────
    if (!DriverAppService.ALLOWED_EXECUTION_STATUSES.has(newStatus)) {
      throw new ForbiddenException(
        `Invalid execution status: '${newStatus}'. ` +
        `Allowed: [${[...DriverAppService.ALLOWED_EXECUTION_STATUSES].join(', ')}]`,
      );
    }

    const rows = await this.dataSource.query(
      `SELECT a.id, a.driver_execution_status, a.booking_id, b.adjustment_status
       FROM assignments a
       JOIN bookings b ON b.id = a.booking_id
       WHERE a.id = $1 AND a.driver_id = $2`,
      [assignmentId, me.driver_id],
    );
    if (!rows.length) throw new ForbiddenException('Assignment not found');

    const current = rows[0].driver_execution_status;

    // ── Item 3/7: dual-line guard — block any attempt to drive admin semantics ──
    if (newStatus === 'fulfilled') {
      throw new ForbiddenException(
        `Driver cannot set execution status to 'fulfilled'. ` +
        `Submit a job report after job_done and await admin review to finalise the booking.`,
      );
    }

    // ── Transition guard ─────────────────────────────────────────────────────
    const allowed = DriverAppService.EXECUTION_TRANSITIONS[current ?? ''] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new ForbiddenException(
        `Cannot transition execution status from '${current ?? 'null'}' to '${newStatus}'. ` +
        `Allowed next steps: [${allowed.join(', ') || 'none — submit job report for admin review'}]`,
      );
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

    // ── job_done: driver line milestone — update booking to COMPLETED ─────────
    // COMPLETED = trip is physically done. Admin retains authority to:
    //   fulfilBooking() — review extra charges, finalise, invoice
    // Driver must submit a driver_extra_report for admin review.
    // ── Settlement: mark driver payout as awaiting admin review ──────────────
    if (newStatus === 'job_done') {
      await this.dataSource.query(
        `UPDATE bookings
         SET operational_status = 'COMPLETED', updated_at = NOW()
         WHERE id = $1
           AND operational_status NOT IN ('FULFILLED','CANCELLED')`,
        [rows[0].booking_id],
      );
      // Mark driver payout awaiting admin review (settlement state machine)
      await this.dataSource.query(
        `UPDATE public.assignments
         SET driver_payout_status = 'AWAITING_ADMIN_REVIEW', updated_at = NOW()
         WHERE id = $1`,
        [assignmentId],
      );
      // Record transition
      await this.dataSource.query(
        `INSERT INTO public.booking_status_history
         (id, tenant_id, booking_id, previous_status, new_status, triggered_by, reason, created_at)
         VALUES (gen_random_uuid(),
           (SELECT tenant_id FROM bookings WHERE id=$1),
           $1, 'IN_PROGRESS', 'COMPLETED', 'DRIVER', 'Driver job_done', NOW())`,
        [rows[0].booking_id],
      ).catch(() => {});
    }

    // NOTE: 'fulfilled' block removed — driver cannot trigger FULFILLED.
    // Admin must call BookingService.fulfilBooking() after reviewing the driver report.

    // ── Trip Evidence: GPS milestone + lifecycle hooks ────────────────────────
    if (this.tripEvidence && location) {
      const bookingId = rows[0].booking_id;
      const tenantId  = me.tenant_id;

      // Record GPS milestone for every execution status with location
      const isMilestone = ['on_the_way','arrived','passenger_on_board','job_done'].includes(newStatus);
      if (isMilestone) {
        const milestoneType = newStatus === 'passenger_on_board' ? 'pob' : newStatus as any;
        await this.tripEvidence.recordMilestone({
          tenantId, bookingId, driverId: userId,
          milestoneType,
          latitude: location.lat,
          longitude: location.lng,
        }).catch(() => {});
      }

      // on_the_way: open evidence record (idempotent upsert)
      if (newStatus === 'on_the_way') {
        // Fetch passenger phone from booking
        const bRows = await this.dataSource.query(
          `SELECT COALESCE(passenger_phone_country_code,'') || COALESCE(passenger_phone_number,'')
             AS passenger_phone,
             COALESCE(customer_phone_country_code,'') || COALESCE(customer_phone_number,'')
             AS customer_phone
           FROM public.bookings WHERE id = $1`, [bookingId],
        );
        const passengerPhone = bRows[0]?.passenger_phone || bRows[0]?.customer_phone || null;
        await this.tripEvidence.openEvidence(tenantId, bookingId, userId, passengerPhone, null).catch(() => {});
      }

      // job_done: close tracking + bridge
      if (newStatus === 'job_done') {
        await this.tripEvidence.closeTracking(tenantId, bookingId).catch(() => {});
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    return { success: true, new_status: newStatus };
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
    // Phase 2: block edits once admin has marked the report as 'reviewed'
    const existing = await this.dataSource.query(
      `SELECT id, status FROM public.driver_extra_reports WHERE assignment_id = $1`,
      [body.assignment_id],
    );

    if (existing.length && existing[0].status === 'reviewed') {
      throw new ForbiddenException(
        'Report has already been reviewed by admin and cannot be modified.',
      );
    }

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
      `SELECT expo_push_token, apns_token FROM users WHERE id = $1`,
      [driverId],
    );
    const expoToken = rows[0]?.expo_push_token;
    const apnsToken = rows[0]?.apns_token;

    // Try Expo push first (ExponentPushToken[...])
    if (expoToken?.startsWith('ExponentPushToken')) {
      try {
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            to: expoToken,
            title,
            body,
            data: data ?? {},
            sound: 'default',
            priority: 'high',
            channelId: 'default',
          }),
        });
        const json = await res.json() as any;
        return { sent: true, via: 'expo', result: json };
      } catch (e: any) {
        this.logger.error(`[Push] Expo failed: ${e?.message}`);
      }
    }

    // Fall back to APNs direct (native iOS app with raw APNs token)
    if (apnsToken) {
      return await this.sendApnsPush(apnsToken, title, body, data);
    }

    return { sent: false, reason: 'no_token' };
  }

  /** Send push notification directly via APNs HTTP/2 API */
  private async sendApnsPush(deviceToken: string, title: string, body: string, data?: Record<string, any>) {
    const keyId   = process.env.APNS_KEY_ID;
    const teamId  = process.env.APNS_TEAM_ID;
    const privKey = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const bundleId = process.env.APNS_BUNDLE_ID ?? 'com.aschauffeured.driver';

    if (!keyId || !teamId || !privKey) {
      this.logger.warn(`[Push] APNs env vars not set — skipping push to ${deviceToken.slice(0, 8)}...`);
      return { sent: false, reason: 'apns_not_configured' };
    }

    try {
      // Build JWT for APNs auth
      const { createSign } = await import('crypto');
      const header  = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) })).toString('base64url');
      const toSign  = `${header}.${payload}`;
      const sign    = createSign('SHA256');
      sign.update(toSign);
      const sig = sign.sign({ key: privKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
      const jwt = `${toSign}.${sig}`;

      const apnsPayload = JSON.stringify({
        aps: { alert: { title, body }, sound: 'default', badge: 1 },
        ...(data ?? {}),
      });

      const url = `https://api.push.apple.com/3/device/${deviceToken}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          authorization: `bearer ${jwt}`,
          'apns-topic': bundleId,
          'apns-push-type': 'alert',
          'apns-priority': '10',
          'content-type': 'application/json',
        },
        body: apnsPayload,
      });

      if (res.status === 200) {
        this.logger.log(`[Push] APNs sent to ${deviceToken.slice(0, 8)}...`);
        return { sent: true, via: 'apns' };
      } else {
        const err = await res.text();
        this.logger.error(`[Push] APNs error ${res.status}: ${err}`);
        return { sent: false, via: 'apns', error: err };
      }
    } catch (e: any) {
      this.logger.error(`[Push] APNs exception: ${e?.message}`);
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

  // ── Settlement: list jobs eligible for driver invoice ───────────────────
  // Only returns jobs where admin has confirmed the final driver payable.
  // Driver cannot see jobs that are not yet admin-reviewed.
  async getInvoiceableJobs(driverId: string) {
    return this.dataSource.query(
      `SELECT a.id, a.driver_payout_status, b.currency,
              dpr.total_driver_payable_minor,
              dpr.id AS review_id,
              b.booking_reference, b.pickup_at_utc,
              b.pickup_address_text, b.dropoff_address_text
       FROM assignments a
       JOIN bookings b ON b.id = a.booking_id
       LEFT JOIN public.driver_payable_reviews dpr ON dpr.assignment_id = a.id
       WHERE a.driver_id = $1
         AND a.driver_payout_status = 'READY_FOR_DRIVER_INVOICE'
       ORDER BY b.pickup_at_utc DESC`,
      [driverId],
    );
  }

  // ── Settlement: create driver invoice (multi-job) ────────────────────────
  // Amounts sourced ONLY from admin-confirmed driver_payable_reviews.
  // Driver cannot pass arbitrary amounts.
  async createDriverInvoice(driverId: string, tenantId: string, assignmentIds: string[]) {
    if (!assignmentIds?.length) throw new BadRequestException('No assignments provided');

    // 1. Verify all assignments are eligible (READY_FOR_DRIVER_INVOICE + belong to driver)
    const eligible = await this.dataSource.query(
      `SELECT a.id, dpr.total_driver_payable_minor, dpr.id AS review_id,
              dpr.currency,
              b.booking_reference, b.pickup_at_utc, b.id AS booking_id
         FROM assignments a
         JOIN public.driver_payable_reviews dpr ON dpr.assignment_id = a.id
         JOIN bookings b ON b.id = a.booking_id
        WHERE a.id = ANY($1)
          AND a.driver_id = $2
          AND a.driver_payout_status = 'READY_FOR_DRIVER_INVOICE'`,
      [assignmentIds, driverId],
    );

    if (eligible.length !== assignmentIds.length) {
      const found = new Set(eligible.map((r: any) => r.id));
      const bad = assignmentIds.filter(id => !found.has(id));
      throw new BadRequestException(
        `Some assignments are not eligible for invoicing: [${bad.join(', ')}]. ` +
        `Assignments must be in READY_FOR_DRIVER_INVOICE status with admin-confirmed payout.`,
      );
    }

    const totalMinor = eligible.reduce((s: number, r: any) => s + (Number(r.total_driver_payable_minor) || 0), 0);
    const currency = eligible[0]?.currency ?? 'AUD';

    // 2. Generate tenant-prefixed invoice number: <BOOKING_REF_PREFIX>-DRIVER-<SEQ>
    const [tenant] = await this.dataSource.query(
      `SELECT COALESCE(booking_ref_prefix, 'DRV') AS prefix FROM public.tenants WHERE id = $1`,
      [tenantId],
    );
    const [seqRow] = await this.dataSource.query(
      `SELECT COUNT(*) AS n FROM public.driver_invoices WHERE tenant_id = $1`,
      [tenantId],
    );
    const seq = String(Number(seqRow.n) + 1).padStart(4, '0');
    const invoiceNumber = `${tenant.prefix}-DRIVER-${seq}`;

    // 3. Insert driver invoice header
    const [inv] = await this.dataSource.query(
      `INSERT INTO public.driver_invoices
         (driver_id, tenant_id, invoice_number, assignment_ids,
          total_minor, currency, status, invoice_status, item_count)
       VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT', 'DRAFT', $7)
       RETURNING id, invoice_number, status, invoice_status, total_minor`,
      [driverId, tenantId, invoiceNumber, assignmentIds, totalMinor, currency, eligible.length],
    );

    // 4. Insert per-job line items (amounts from admin-confirmed reviews)
    for (const row of eligible) {
      await this.dataSource.query(
        `INSERT INTO public.driver_invoice_items
           (driver_invoice_id, tenant_id, assignment_id, booking_id, booking_reference,
            service_date, driver_payable_minor, currency, payable_review_id,
            description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          inv.id, tenantId, row.id, row.booking_id, row.booking_reference,
          row.pickup_at_utc,
          Number(row.total_driver_payable_minor),
          currency,
          row.review_id,
          `Job — ${row.booking_reference}`,
        ],
      );
      // 5. Mark assignment as INVOICED
      await this.dataSource.query(
        `UPDATE public.assignments
           SET driver_payout_status = 'INVOICED', updated_at = NOW()
         WHERE id = $1`,
        [row.id],
      );
    }

    return inv;
  }

  async submitDriverInvoice(driverId: string, invoiceId: string) {
    await this.dataSource.query(
      `UPDATE public.driver_invoices
       SET status = 'SUBMITTED', invoice_status = 'SUBMITTED', submitted_at = now(), updated_at = now()
       WHERE id = $1 AND driver_id = $2 AND invoice_status = 'DRAFT'`,
      [invoiceId, driverId],
    );
    return { submitted: true };
  }

  // ── Settlement: driver marks invoice received ────────────────────────────
  // Final settlement step. Driver confirms funds received.
  async markDriverInvoiceReceived(driverId: string, invoiceId: string) {
    const [inv] = await this.dataSource.query(
      `UPDATE public.driver_invoices
       SET invoice_status = 'RECEIVED_BY_DRIVER',
           received_by_driver_at = NOW(),
           received_by_driver_by = $1,
           updated_at = NOW()
       WHERE id = $2 AND driver_id = $1 AND invoice_status = 'PAID_BY_ADMIN'
       RETURNING id, invoice_number, invoice_status`,
      [driverId, invoiceId],
    );
    if (!inv) throw new BadRequestException('Invoice not eligible to mark received (must be PAID_BY_ADMIN)');

    // Mark all assignments on this invoice as RECEIVED_BY_DRIVER
    await this.dataSource.query(
      `UPDATE public.assignments
         SET driver_payout_status = 'RECEIVED_BY_DRIVER', updated_at = NOW()
       WHERE id IN (
         SELECT assignment_id FROM public.driver_invoice_items WHERE driver_invoice_id = $1
       )`,
      [invoiceId],
    );
    return { success: true, invoice_number: inv.invoice_number };
  }

  // ── Settlement: driver invoice detail (with line items) ─────────────────
  async getDriverInvoiceDetail(driverId: string, invoiceId: string) {
    const [inv] = await this.dataSource.query(
      `SELECT * FROM public.driver_invoices WHERE id = $1 AND driver_id = $2`,
      [invoiceId, driverId],
    );
    if (!inv) throw new NotFoundException('Invoice not found');

    const items = await this.dataSource.query(
      `SELECT dii.*, b.pickup_at_utc, b.pickup_address_text, b.dropoff_address_text
         FROM public.driver_invoice_items dii
         JOIN public.bookings b ON b.id = dii.booking_id
        WHERE dii.driver_invoice_id = $1
        ORDER BY dii.service_date ASC`,
      [invoiceId],
    );
    return { ...inv, items };
  }

  // ── Settlement: list driver invoices (with item count) ───────────────────
  async listDriverInvoicesEnriched(driverId: string) {
    const invoices = await this.dataSource.query(
      `SELECT i.id, i.invoice_number, i.invoice_status, i.total_minor, i.currency,
              i.created_at, i.submitted_at, i.paid_by_admin_at, i.received_by_driver_at,
              i.dispute_reason, i.item_count
         FROM public.driver_invoices i
        WHERE i.driver_id = $1
        ORDER BY i.created_at DESC`,
      [driverId],
    );
    return invoices;
  }

  async verifyAbn(abn: string) {
    // Simple format validation — ABR lookup requires API key
    const cleaned = abn?.replace(/\s/g, '');
    const valid = /^\d{11}$/.test(cleaned ?? '');
    return { abn: cleaned, abn_verified: valid, abn_name: valid ? 'ABN Valid' : null };
  }
}
