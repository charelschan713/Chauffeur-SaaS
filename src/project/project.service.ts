/**
 * ProjectService — Customer Project / Event Transfer aggregation layer
 *
 * A Project groups multiple bookings into one operational dashboard for
 * customer/admin visibility (event transfers, VIP coordination, delegations, etc.).
 *
 * DESIGN PRINCIPLES:
 *   - Project is an aggregation layer ABOVE existing bookings — does NOT replace them
 *   - Timeline is aggregated from booking_status_history + trip_gps_milestones
 *     (no separate timeline table — avoids data duplication)
 *   - Badge model maps driver_execution_status → customer-facing label
 *   - Tracking visible from on_the_way → job_done (no downgrade after POB)
 *   - Admin sees full detail; customer sees controlled subset
 *   - Strict tenant + customer isolation enforced on every query
 *
 * STATUS TRANSITIONS:
 *   DRAFT → ACTIVE: admin activates, or auto on any booking entering on_the_way
 *   ACTIVE → COMPLETED: all bookings job_done/fulfilled, or admin closes
 *   ACTIVE → CANCELLED: admin cancels
 *   COMPLETED/CANCELLED → ARCHIVED: admin archives
 */
import {
  Injectable, Logger, OnModuleInit, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

// ── Badge mapping ────────────────────────────────────────────────────────────
// Maps driver_execution_status (more granular for active trips) + operational_status
// to a clean customer-facing badge.
export function resolveBookingBadge(
  operationalStatus: string,
  driverExecStatus: string | null,
): { label: string; color: string; trackingActive: boolean } {
  // Terminal / cancelled states take priority
  if (['CANCELLED', 'NO_SHOW'].includes(operationalStatus)) {
    return { label: 'Cancelled', color: 'red', trackingActive: false };
  }
  if (operationalStatus === 'FULFILLED') {
    return { label: 'Completed', color: 'emerald', trackingActive: false };
  }

  // Active execution (driver has taken over)
  switch (driverExecStatus) {
    case 'on_the_way':         return { label: 'On The Way',          color: 'blue',   trackingActive: true };
    case 'arrived':            return { label: 'Arrived',             color: 'yellow', trackingActive: true };
    case 'passenger_on_board': return { label: 'Passenger On Board',  color: 'purple', trackingActive: true };
    case 'job_done':           return { label: 'Job Done',            color: 'green',  trackingActive: false };
    case 'accepted':
    case 'assigned':           return { label: 'Assigned',            color: 'gray',   trackingActive: false };
  }

  // Fallback from operational status
  switch (operationalStatus) {
    case 'ASSIGNED':     return { label: 'Assigned',     color: 'gray',   trackingActive: false };
    case 'IN_PROGRESS':  return { label: 'In Progress',  color: 'blue',   trackingActive: true  };
    case 'COMPLETED':    return { label: 'Job Done',      color: 'green',  trackingActive: false };
    case 'CONFIRMED':    return { label: 'Confirmed',     color: 'gray',   trackingActive: false };
    default:             return { label: operationalStatus, color: 'gray', trackingActive: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class ProjectService implements OnModuleInit {
  private readonly logger = new Logger(ProjectService.name);

  constructor(private readonly dataSource: DataSource) {}

  // ── Schema migration ─────────────────────────────────────────────────────

  async onModuleInit() {
    this.logger.log('ProjectService: running schema migrations');

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS public.projects (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id        UUID NOT NULL,
        customer_id      UUID,
        project_name     TEXT NOT NULL,
        project_type     TEXT NOT NULL DEFAULT 'EVENT_TRANSFER',
        status           TEXT NOT NULL DEFAULT 'DRAFT',
        start_at         TIMESTAMPTZ,
        end_at           TIMESTAMPTZ,
        notes            TEXT,
        customer_visible BOOLEAN NOT NULL DEFAULT true,
        created_by       UUID,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT projects_status_check CHECK (
          status IN ('DRAFT','ACTIVE','COMPLETED','CANCELLED','ARCHIVED')
        )
      )
    `).catch(e => this.logger.warn('projects table:', e.message));

    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_projects_tenant   ON public.projects(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_projects_customer ON public.projects(customer_id);
      CREATE INDEX IF NOT EXISTS idx_projects_status   ON public.projects(tenant_id, status);
    `).catch(() => {});

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS public.project_bookings (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id        UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
        booking_id        UUID NOT NULL,
        booking_reference TEXT,
        sort_order        INT NOT NULL DEFAULT 0,
        added_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        added_by          UUID,
        CONSTRAINT uix_project_booking UNIQUE (project_id, booking_id)
      )
    `).catch(e => this.logger.warn('project_bookings table:', e.message));

    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_pb_project ON public.project_bookings(project_id);
      CREATE INDEX IF NOT EXISTS idx_pb_booking ON public.project_bookings(booking_id);
    `).catch(() => {});

    this.logger.log('ProjectService: schema migrations complete');
  }

  // ── Admin: project CRUD ──────────────────────────────────────────────────

  async createProject(
    tenantId: string,
    adminId: string,
    body: {
      project_name: string;
      project_type?: string;
      customer_id?: string;
      start_at?: string;
      end_at?: string;
      notes?: string;
      customer_visible?: boolean;
      booking_ids?: string[];
    },
  ) {
    const rows = await this.dataSource.query(
      `INSERT INTO public.projects
         (tenant_id, customer_id, project_name, project_type,
          start_at, end_at, notes, customer_visible, created_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'DRAFT')
       RETURNING *`,
      [
        tenantId,
        body.customer_id ?? null,
        body.project_name,
        body.project_type ?? 'EVENT_TRANSFER',
        body.start_at ?? null,
        body.end_at ?? null,
        body.notes ?? null,
        body.customer_visible ?? true,
        adminId,
      ],
    );
    const project = rows[0];

    // Add initial bookings if provided
    if (body.booking_ids?.length) {
      await this.addBookings(tenantId, project.id, adminId, body.booking_ids);
    }

    return project;
  }

  async listProjects(
    tenantId: string,
    query: { status?: string; customer_id?: string; page?: number; limit?: number },
  ) {
    const page  = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(Math.max(Number(query.limit ?? 20), 1), 100);
    const offset = (page - 1) * limit;

    const conditions: string[] = ['p.tenant_id = $1'];
    const params: any[]         = [tenantId];
    let idx = 2;

    if (query.status) {
      conditions.push(`p.status = $${idx++}`);
      params.push(query.status);
    }
    if (query.customer_id) {
      conditions.push(`p.customer_id = $${idx++}`);
      params.push(query.customer_id);
    }

    const WHERE = conditions.join(' AND ');
    params.push(limit, offset);

    const rows = await this.dataSource.query(
      `SELECT p.*,
              c.first_name || ' ' || c.last_name AS customer_name,
              c.email AS customer_email,
              COUNT(pb.id)::int AS booking_count
       FROM public.projects p
       LEFT JOIN public.customers c ON c.id = p.customer_id
       LEFT JOIN public.project_bookings pb ON pb.project_id = p.id
       WHERE ${WHERE}
       GROUP BY p.id, c.first_name, c.last_name, c.email
       ORDER BY p.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params,
    );
    return rows;
  }

  async getProjectDetail(tenantId: string, projectId: string, includeAdmin = true) {
    const rows = await this.dataSource.query(
      `SELECT p.*,
              c.first_name || ' ' || c.last_name AS customer_name,
              c.email AS customer_email
       FROM public.projects p
       LEFT JOIN public.customers c ON c.id = p.customer_id
       WHERE p.id = $1 AND p.tenant_id = $2`,
      [projectId, tenantId],
    );
    if (!rows.length) throw new NotFoundException('Project not found');
    const project = rows[0];

    const bookings = await this.getProjectBookings(tenantId, projectId, includeAdmin);
    const timeline = await this.getProjectTimeline(tenantId, projectId, includeAdmin);

    return { ...project, bookings, timeline };
  }

  async updateProject(
    tenantId: string,
    projectId: string,
    adminId: string,
    body: Partial<{
      project_name: string;
      project_type: string;
      status: string;
      start_at: string;
      end_at: string;
      notes: string;
      customer_visible: boolean;
    }>,
  ) {
    const allowed = ['DRAFT','ACTIVE','COMPLETED','CANCELLED','ARCHIVED'];
    if (body.status && !allowed.includes(body.status)) {
      throw new ForbiddenException(`Invalid status: ${body.status}`);
    }

    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[]         = [];
    let idx = 1;

    for (const [k, v] of Object.entries(body)) {
      if (v !== undefined && ['project_name','project_type','status','start_at','end_at','notes','customer_visible'].includes(k)) {
        setClauses.push(`${k} = $${idx++}`);
        params.push(v);
      }
    }

    params.push(projectId, tenantId);
    const rows = await this.dataSource.query(
      `UPDATE public.projects SET ${setClauses.join(', ')}
       WHERE id = $${idx} AND tenant_id = $${idx + 1}
       RETURNING *`,
      params,
    );
    if (!rows.length) throw new NotFoundException('Project not found');
    return rows[0];
  }

  // ── Bookings management ──────────────────────────────────────────────────

  async addBookings(
    tenantId: string,
    projectId: string,
    adminId: string,
    bookingIds: string[],
  ) {
    // Verify project ownership
    const pRows = await this.dataSource.query(
      `SELECT id FROM public.projects WHERE id = $1 AND tenant_id = $2`,
      [projectId, tenantId],
    );
    if (!pRows.length) throw new NotFoundException('Project not found');

    const added: string[] = [];
    for (let i = 0; i < bookingIds.length; i++) {
      const bId = bookingIds[i];
      // Verify booking belongs to this tenant
      const bRows = await this.dataSource.query(
        `SELECT id, booking_reference FROM public.bookings WHERE id = $1 AND tenant_id = $2`,
        [bId, tenantId],
      );
      if (!bRows.length) continue; // skip invalid

      await this.dataSource.query(
        `INSERT INTO public.project_bookings (project_id, booking_id, booking_reference, sort_order, added_by)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (project_id, booking_id) DO NOTHING`,
        [projectId, bId, bRows[0].booking_reference, i, adminId],
      );
      added.push(bId);
    }
    return { added };
  }

  async removeBooking(tenantId: string, projectId: string, bookingId: string) {
    const pRows = await this.dataSource.query(
      `SELECT id FROM public.projects WHERE id = $1 AND tenant_id = $2`,
      [projectId, tenantId],
    );
    if (!pRows.length) throw new NotFoundException('Project not found');

    await this.dataSource.query(
      `DELETE FROM public.project_bookings WHERE project_id = $1 AND booking_id = $2`,
      [projectId, bookingId],
    );
    return { removed: true };
  }

  // ── Core: enriched booking cards ────────────────────────────────────────

  async getProjectBookings(tenantId: string, projectId: string, includeAdmin = true) {
    const rows = await this.dataSource.query(
      `SELECT b.id, b.booking_reference, b.operational_status,
              b.pickup_address_text, b.dropoff_address_text, b.pickup_at_utc,
              b.passenger_first_name, b.passenger_last_name,
              pb.sort_order,
              -- Driver info from latest active assignment
              a.id AS assignment_id,
              a.driver_execution_status,
              a.status AS assignment_status,
              u.full_name AS driver_name,
              v.registration_number AS vehicle_rego,
              v.make AS vehicle_make, v.model AS vehicle_model,
              -- Last GPS location for map marker
              tgm.latitude AS last_lat,
              tgm.longitude AS last_lng,
              tgm.milestone_type AS last_milestone,
              tgm.recorded_at AS last_location_at
       FROM public.project_bookings pb
       JOIN public.bookings b ON b.id = pb.booking_id
       LEFT JOIN public.assignments a ON a.booking_id = b.id
         AND a.status NOT IN ('CANCELLED','DECLINED','EXPIRED','REJECTED')
         AND a.driver_id IS NOT NULL
       LEFT JOIN public.users u ON u.id = a.driver_id
       LEFT JOIN public.vehicles v ON v.id = a.vehicle_id
       LEFT JOIN LATERAL (
         SELECT latitude, longitude, milestone_type, recorded_at
         FROM public.trip_gps_milestones
         WHERE booking_id = b.id AND tenant_id = $1
         ORDER BY recorded_at DESC
         LIMIT 1
       ) tgm ON true
       WHERE pb.project_id = $2 AND b.tenant_id = $1
       ORDER BY pb.sort_order, b.pickup_at_utc`,
      [tenantId, projectId],
    );

    return rows.map((row: any) => {
      const badge = resolveBookingBadge(row.operational_status, row.driver_execution_status);
      return {
        id:                row.id,
        booking_reference: row.booking_reference,
        operational_status: row.operational_status,
        pickup_address_text: row.pickup_address_text,
        dropoff_address_text: row.dropoff_address_text,
        pickup_at_utc:     row.pickup_at_utc,
        passenger_name:    [row.passenger_first_name, row.passenger_last_name].filter(Boolean).join(' ') || null,
        // Driver + vehicle — always shown (admin visibility)
        driver_name:       row.driver_name ?? null,
        vehicle_rego:      row.vehicle_rego ?? null,
        vehicle_make:      row.vehicle_make ?? null,
        vehicle_model:     row.vehicle_model ?? null,
        // Badge
        badge:             badge,
        // Map marker (only when tracking active and GPS available)
        map_marker: badge.trackingActive && row.last_lat ? {
          lat:             parseFloat(row.last_lat),
          lng:             parseFloat(row.last_lng),
          milestone_type:  row.last_milestone,
          recorded_at:     row.last_location_at,
          driver_name:     row.driver_name ?? null,
          vehicle_rego:    row.vehicle_rego ?? null,
          badge_label:     badge.label,
          badge_color:     badge.color,
        } : null,
        // Admin-only fields
        ...(includeAdmin ? {
          assignment_id:          row.assignment_id,
          driver_execution_status: row.driver_execution_status,
        } : {}),
      };
    });
  }

  // ── Timeline: aggregated from existing data sources ──────────────────────
  //
  // Design choice: NO dedicated project_timeline_events table.
  // Instead we aggregate from:
  //   1. booking_status_history — operational state transitions (admin/system)
  //   2. trip_gps_milestones    — GPS milestone events (driver)
  // This avoids data duplication, keeps the source of truth in existing tables,
  // and stays consistent with the trip evidence model already in place.

  async getProjectTimeline(tenantId: string, projectId: string, includeAdmin = true) {
    // Fetch booking IDs for this project
    const pb = await this.dataSource.query(
      `SELECT pb.booking_id, b.booking_reference,
              u.full_name AS driver_name,
              v.registration_number AS vehicle_rego
       FROM public.project_bookings pb
       JOIN public.bookings b ON b.id = pb.booking_id
       LEFT JOIN public.assignments a ON a.booking_id = b.id
         AND a.status NOT IN ('CANCELLED','DECLINED','EXPIRED','REJECTED')
         AND a.driver_id IS NOT NULL
       LEFT JOIN public.users u ON u.id = a.driver_id
       LEFT JOIN public.vehicles v ON v.id = a.vehicle_id
       WHERE pb.project_id = $1 AND b.tenant_id = $2`,
      [projectId, tenantId],
    );

    if (!pb.length) return [];

    const bookingIds = pb.map((r: any) => r.booking_id);
    const driverMap: Record<string, { driver_name: string; vehicle_rego: string }> = {};
    for (const r of pb) {
      driverMap[r.booking_id] = { driver_name: r.driver_name, vehicle_rego: r.vehicle_rego };
      // booking_reference lookup
      driverMap[r.booking_id] = { ...driverMap[r.booking_id], ...r };
    }

    const idList = bookingIds.map((_: any, i: number) => `$${i + 2}`).join(',');

    // GPS milestones — driver execution milestones (all visibility levels)
    const milestones = await this.dataSource.query(
      `SELECT tgm.booking_id, tgm.milestone_type AS event_type,
              tgm.recorded_at AS occurred_at,
              tgm.latitude, tgm.longitude,
              'GPS_MILESTONE' AS source
       FROM public.trip_gps_milestones tgm
       WHERE tgm.tenant_id = $1 AND tgm.booking_id IN (${idList})
         AND tgm.milestone_type IN ('on_the_way','arrived','pob','job_done')
       ORDER BY tgm.recorded_at ASC`,
      [tenantId, ...bookingIds],
    );

    // Booking status history — operational transitions (admin-enriched)
    const adminStatusEvents = includeAdmin
      ? await this.dataSource.query(
          `SELECT bsh.booking_id, bsh.new_status AS event_type,
                  bsh.created_at AS occurred_at,
                  bsh.triggered_by AS actor,
                  bsh.reason AS note,
                  'STATUS_TRANSITION' AS source
           FROM public.booking_status_history bsh
           WHERE bsh.booking_id IN (${idList})
             AND bsh.new_status NOT IN ('DRAFT','PENDING')
           ORDER BY bsh.created_at ASC`,
          [...bookingIds],
        ).catch(() => [])
      : [];

    // Merge + annotate with driver/vehicle/booking_reference
    const allEvents = [...milestones, ...adminStatusEvents]
      .map((e: any) => {
        const bookingCtx = driverMap[e.booking_id] ?? {};
        return {
          ...e,
          booking_reference: (bookingCtx as any).booking_reference ?? null,
          driver_name:       (bookingCtx as any).driver_name ?? null,
          vehicle_rego:      (bookingCtx as any).vehicle_rego ?? null,
          // Customer-friendly label
          event_label: TIMELINE_LABELS[e.event_type] ?? e.event_type,
        };
      })
      .sort((a: any, b: any) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());

    return allEvents;
  }

  // ── Customer portal: scoped access ──────────────────────────────────────

  async getCustomerProjects(tenantId: string, customerId: string) {
    return this.dataSource.query(
      `SELECT p.id, p.project_name, p.project_type, p.status,
              p.start_at, p.end_at,
              COUNT(pb.id)::int AS booking_count
       FROM public.projects p
       LEFT JOIN public.project_bookings pb ON pb.project_id = p.id
       WHERE p.tenant_id = $1
         AND p.customer_id = $2
         AND p.customer_visible = true
         AND p.status != 'ARCHIVED'
       GROUP BY p.id
       ORDER BY p.start_at DESC, p.created_at DESC`,
      [tenantId, customerId],
    );
  }

  async getCustomerProjectDetail(
    tenantId: string,
    customerId: string,
    projectId: string,
  ) {
    // Security: project must belong to this customer + tenant, must be visible
    const rows = await this.dataSource.query(
      `SELECT p.id, p.project_name, p.project_type, p.status,
              p.start_at, p.end_at
       FROM public.projects p
       WHERE p.id = $1 AND p.tenant_id = $2
         AND p.customer_id = $3
         AND p.customer_visible = true`,
      [projectId, tenantId, customerId],
    );
    if (!rows.length) throw new NotFoundException('Project not found');
    const project = rows[0];

    const bookings = await this.getProjectBookings(tenantId, projectId, false);
    const timeline = await this.getProjectTimeline(tenantId, projectId, false);

    // Strip any admin-only fields from customer view
    const customerTimeline = timeline.filter((e: any) =>
      e.source === 'GPS_MILESTONE' || CUSTOMER_VISIBLE_EVENTS.has(e.event_type),
    );

    return { ...project, bookings, timeline: customerTimeline };
  }
}

// ── Event label maps ─────────────────────────────────────────────────────────
const TIMELINE_LABELS: Record<string, string> = {
  on_the_way:         'Driver On The Way',
  arrived:            'Driver Arrived at Pickup',
  pob:                'Passenger On Board',
  job_done:           'Job Completed',
  CONFIRMED:          'Booking Confirmed',
  ASSIGNED:           'Driver Assigned',
  IN_PROGRESS:        'Service Started',
  COMPLETED:          'Trip Completed',
  FULFILLED:          'Booking Fulfilled',
  CANCELLED:          'Booking Cancelled',
};

const CUSTOMER_VISIBLE_EVENTS = new Set([
  'CONFIRMED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'FULFILLED', 'CANCELLED',
]);
