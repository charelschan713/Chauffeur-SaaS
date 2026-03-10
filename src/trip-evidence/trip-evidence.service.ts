import {
  Injectable, Logger, OnModuleInit, ForbiddenException, NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

// ─── Types ────────────────────────────────────────────────────────────────────
export type MilestoneType = 'on_the_way' | 'arrived' | 'pob' | 'job_done' | 'trace';
export type OperationEventType =
  | 'sms_bridge_opened'   | 'sms_bridge_closed'
  | 'driver_message_sent' | 'passenger_message_received'
  | 'tracking_started'    | 'tracking_closed'
  | 'milestone_recorded'  | 'route_image_generated'
  | 'audit_report_generated' | 'evidence_frozen';

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class TripEvidenceService implements OnModuleInit {
  private readonly logger = new Logger(TripEvidenceService.name);

  constructor(private readonly dataSource: DataSource) {}

  // ── DB migration ─────────────────────────────────────────────────────────

  async onModuleInit() {
    this.logger.log('TripEvidenceService: running schema migrations');

    // trip_evidence_records — one umbrella record per booking
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS public.trip_evidence_records (
        id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id                 UUID NOT NULL,
        booking_id                UUID NOT NULL UNIQUE,
        driver_id                 UUID,
        passenger_phone           TEXT,
        twilio_proxy_number       TEXT,
        sms_bridge_opened_at      TIMESTAMPTZ,
        sms_bridge_closed_at      TIMESTAMPTZ,
        tracking_started_at       TIMESTAMPTZ,
        tracking_closed_at        TIMESTAMPTZ,
        route_image_url           TEXT,
        route_image_generated_at  TIMESTAMPTZ,
        evidence_status           TEXT NOT NULL DEFAULT 'active',
        evidence_frozen_at        TIMESTAMPTZ,
        audit_report_url          TEXT,
        created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `).catch(e => this.logger.warn('trip_evidence_records:', e.message));

    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_ter_booking ON public.trip_evidence_records(booking_id);
      CREATE INDEX IF NOT EXISTS idx_ter_tenant  ON public.trip_evidence_records(tenant_id);
    `).catch(() => {});

    // trip_gps_milestones — milestone GPS captures
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS public.trip_gps_milestones (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       UUID NOT NULL,
        booking_id      UUID NOT NULL,
        driver_id       UUID NOT NULL,
        milestone_type  TEXT NOT NULL,
        latitude        NUMERIC(10,7) NOT NULL,
        longitude       NUMERIC(10,7) NOT NULL,
        accuracy_meters NUMERIC(8,2),
        source          TEXT NOT NULL DEFAULT 'driver_app',
        recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        metadata        JSONB
      )
    `).catch(e => this.logger.warn('trip_gps_milestones:', e.message));

    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_tgm_booking ON public.trip_gps_milestones(booking_id);
      CREATE INDEX IF NOT EXISTS idx_tgm_type    ON public.trip_gps_milestones(booking_id, milestone_type);
    `).catch(() => {});

    // trip_sms_messages — SMS bridge transcript
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS public.trip_sms_messages (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       UUID NOT NULL,
        booking_id      UUID NOT NULL,
        driver_id       UUID NOT NULL,
        direction       TEXT NOT NULL CHECK (direction IN ('outbound','inbound')),
        from_number     TEXT,
        to_number       TEXT,
        body            TEXT NOT NULL,
        twilio_sid      TEXT,
        delivery_status TEXT NOT NULL DEFAULT 'sent',
        sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        metadata        JSONB
      )
    `).catch(e => this.logger.warn('trip_sms_messages:', e.message));

    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_tsm_booking ON public.trip_sms_messages(booking_id);
    `).catch(() => {});

    // trip_operation_logs — immutable append-only event log
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS public.trip_operation_logs (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id   UUID NOT NULL,
        booking_id  UUID NOT NULL,
        event_type  TEXT NOT NULL,
        actor       TEXT,
        metadata    JSONB,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `).catch(e => this.logger.warn('trip_operation_logs:', e.message));

    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_tol_booking ON public.trip_operation_logs(booking_id);
    `).catch(() => {});

    this.logger.log('TripEvidenceService: schema migrations complete');
  }

  // ── Evidence record lifecycle ────────────────────────────────────────────

  /** Called when booking enters on_the_way — opens evidence record */
  async openEvidence(
    tenantId: string,
    bookingId: string,
    driverId: string,
    passengerPhone: string | null,
    twilioProxyNumber: string | null,
  ): Promise<string> {
    const rows = await this.dataSource.query(
      `INSERT INTO public.trip_evidence_records
         (tenant_id, booking_id, driver_id, passenger_phone, twilio_proxy_number,
          sms_bridge_opened_at, tracking_started_at, evidence_status)
       VALUES ($1,$2,$3,$4,$5,NOW(),NOW(),'active')
       ON CONFLICT (booking_id) DO UPDATE SET
         driver_id = EXCLUDED.driver_id,
         sms_bridge_opened_at = COALESCE(trip_evidence_records.sms_bridge_opened_at, NOW()),
         tracking_started_at  = COALESCE(trip_evidence_records.tracking_started_at, NOW()),
         updated_at = NOW()
       RETURNING id`,
      [tenantId, bookingId, driverId, passengerPhone, twilioProxyNumber],
    );
    const evidenceId = rows[0]?.id;
    await this.logEvent(tenantId, bookingId, 'sms_bridge_opened', 'system');
    await this.logEvent(tenantId, bookingId, 'tracking_started', 'system');
    return evidenceId;
  }

  /** Called when booking enters job_done — closes bridge & tracking */
  async closeTracking(tenantId: string, bookingId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE public.trip_evidence_records SET
         sms_bridge_closed_at = COALESCE(sms_bridge_closed_at, NOW()),
         tracking_closed_at   = COALESCE(tracking_closed_at, NOW()),
         updated_at = NOW()
       WHERE booking_id = $1 AND tenant_id = $2`,
      [bookingId, tenantId],
    );
    await this.logEvent(tenantId, bookingId, 'sms_bridge_closed', 'system');
    await this.logEvent(tenantId, bookingId, 'tracking_closed', 'system');
  }

  /** Called when booking → FULFILLED — freezes all evidence */
  async freezeEvidence(tenantId: string, bookingId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE public.trip_evidence_records SET
         evidence_status    = 'frozen',
         evidence_frozen_at = NOW(),
         sms_bridge_closed_at = COALESCE(sms_bridge_closed_at, NOW()),
         tracking_closed_at   = COALESCE(tracking_closed_at, NOW()),
         updated_at = NOW()
       WHERE booking_id = $1 AND tenant_id = $2`,
      [bookingId, tenantId],
    );
    await this.logEvent(tenantId, bookingId, 'evidence_frozen', 'system');
  }

  // ── GPS milestones ───────────────────────────────────────────────────────

  async recordMilestone(params: {
    tenantId: string;
    bookingId: string;
    driverId: string;
    milestoneType: MilestoneType;
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    source?: string;
  }): Promise<void> {
    // Guard: cannot record after evidence frozen
    const rec = await this.getEvidenceRecord(params.tenantId, params.bookingId);
    if (rec?.evidence_status === 'frozen') {
      this.logger.warn(`GPS record blocked — evidence frozen for booking ${params.bookingId}`);
      return;
    }

    await this.dataSource.query(
      `INSERT INTO public.trip_gps_milestones
         (tenant_id, booking_id, driver_id, milestone_type,
          latitude, longitude, accuracy_meters, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        params.tenantId, params.bookingId, params.driverId,
        params.milestoneType, params.latitude, params.longitude,
        params.accuracyMeters ?? null, params.source ?? 'driver_app',
      ],
    );
    await this.logEvent(params.tenantId, params.bookingId, 'milestone_recorded', params.driverId, {
      milestone_type: params.milestoneType,
      lat: params.latitude,
      lng: params.longitude,
    });

    // On job_done: auto-generate route image
    if (params.milestoneType === 'job_done') {
      await this.generateRouteImage(params.tenantId, params.bookingId).catch(e =>
        this.logger.error('Route image generation failed', e),
      );
    }
  }

  // ── SMS bridge ───────────────────────────────────────────────────────────

  async recordOutboundSms(params: {
    tenantId: string;
    bookingId: string;
    driverId: string;
    fromNumber: string;
    toNumber: string;
    body: string;
    twilioSid?: string;
    deliveryStatus?: string;
  }): Promise<void> {
    const rec = await this.getEvidenceRecord(params.tenantId, params.bookingId);
    if (rec?.evidence_status === 'frozen') {
      throw new ForbiddenException('Trip evidence is frozen — conversation closed.');
    }
    await this.dataSource.query(
      `INSERT INTO public.trip_sms_messages
         (tenant_id, booking_id, driver_id, direction,
          from_number, to_number, body, twilio_sid, delivery_status)
       VALUES ($1,$2,$3,'outbound',$4,$5,$6,$7,$8)`,
      [
        params.tenantId, params.bookingId, params.driverId,
        params.fromNumber, params.toNumber, params.body,
        params.twilioSid ?? null, params.deliveryStatus ?? 'sent',
      ],
    );
    await this.logEvent(params.tenantId, params.bookingId, 'driver_message_sent', params.driverId, {
      body_preview: params.body.substring(0, 80),
    });
  }

  async recordInboundSms(params: {
    tenantId: string;
    bookingId: string;
    driverId: string;
    fromNumber: string;
    toNumber: string;
    body: string;
    twilioSid?: string;
  }): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO public.trip_sms_messages
         (tenant_id, booking_id, driver_id, direction,
          from_number, to_number, body, twilio_sid, delivery_status)
       VALUES ($1,$2,$3,'inbound',$4,$5,$6,$7,'received')`,
      [
        params.tenantId, params.bookingId, params.driverId,
        params.fromNumber, params.toNumber, params.body, params.twilioSid ?? null,
      ],
    );
    await this.logEvent(params.tenantId, params.bookingId, 'passenger_message_received', 'system', {
      body_preview: params.body.substring(0, 80),
    });
  }

  // ── Route image ──────────────────────────────────────────────────────────

  async generateRouteImage(tenantId: string, bookingId: string): Promise<string | null> {
    const mapsKey = process.env.GOOGLE_MAPS_API_KEY;

    // Fetch POB and job_done milestones
    const milestones = await this.dataSource.query(
      `SELECT milestone_type, latitude, longitude, recorded_at
       FROM public.trip_gps_milestones
       WHERE booking_id = $1 AND tenant_id = $2
         AND milestone_type IN ('on_the_way','arrived','pob','job_done')
       ORDER BY recorded_at ASC`,
      [bookingId, tenantId],
    );

    if (milestones.length < 1) {
      this.logger.warn(`No milestones found for route image — booking ${bookingId}`);
      return null;
    }

    // Build Google Static Maps URL
    const LABEL: Record<string, string> = {
      on_the_way: 'S', arrived: 'A', pob: 'P', job_done: 'E',
    };
    const COLOR: Record<string, string> = {
      on_the_way: 'blue', arrived: 'yellow', pob: 'green', job_done: 'red',
    };

    let url = `https://maps.googleapis.com/maps/api/staticmap?size=640x400&maptype=roadmap`;

    for (const m of milestones) {
      const label  = LABEL[m.milestone_type]  ?? 'X';
      const colour = COLOR[m.milestone_type]  ?? 'gray';
      url += `&markers=color:${colour}%7Clabel:${label}%7C${m.latitude},${m.longitude}`;
    }

    // If both POB and job_done exist, add a path
    const pob     = milestones.find((m: any) => m.milestone_type === 'pob');
    const jobDone = milestones.find((m: any) => m.milestone_type === 'job_done');
    if (pob && jobDone) {
      url += `&path=color:0x0000ffcc|weight:3|${pob.latitude},${pob.longitude}|${jobDone.latitude},${jobDone.longitude}`;
    }

    if (mapsKey) {
      url += `&key=${mapsKey}`;
    }

    // Persist URL in evidence record
    await this.dataSource.query(
      `UPDATE public.trip_evidence_records SET
         route_image_url = $1, route_image_generated_at = NOW(), updated_at = NOW()
       WHERE booking_id = $2 AND tenant_id = $3`,
      [url, bookingId, tenantId],
    );

    await this.logEvent(tenantId, bookingId, 'route_image_generated', 'system', {
      milestone_count: milestones.length,
    });

    return url;
  }

  // ── Operation log ────────────────────────────────────────────────────────

  async logEvent(
    tenantId: string,
    bookingId: string,
    eventType: OperationEventType,
    actor: string = 'system',
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO public.trip_operation_logs
         (tenant_id, booking_id, event_type, actor, metadata)
       VALUES ($1,$2,$3,$4,$5)`,
      [tenantId, bookingId, eventType, actor, metadata ? JSON.stringify(metadata) : null],
    ).catch(e => this.logger.error('logEvent failed', e.message));
  }

  // ── Read methods ─────────────────────────────────────────────────────────

  async getEvidenceRecord(tenantId: string, bookingId: string) {
    const rows = await this.dataSource.query(
      `SELECT * FROM public.trip_evidence_records
       WHERE booking_id = $1 AND tenant_id = $2`,
      [bookingId, tenantId],
    );
    return rows[0] ?? null;
  }

  async getMilestones(tenantId: string, bookingId: string) {
    return this.dataSource.query(
      `SELECT id, milestone_type, latitude, longitude, accuracy_meters, source, recorded_at
       FROM public.trip_gps_milestones
       WHERE booking_id = $1 AND tenant_id = $2
       ORDER BY recorded_at ASC`,
      [bookingId, tenantId],
    );
  }

  async getSmsTranscript(tenantId: string, bookingId: string) {
    return this.dataSource.query(
      `SELECT id, direction, body, delivery_status, sent_at
       FROM public.trip_sms_messages
       WHERE booking_id = $1 AND tenant_id = $2
       ORDER BY sent_at ASC`,
      [bookingId, tenantId],
    );
  }

  async getOperationLog(tenantId: string, bookingId: string) {
    return this.dataSource.query(
      `SELECT id, event_type, actor, metadata, occurred_at
       FROM public.trip_operation_logs
       WHERE booking_id = $1 AND tenant_id = $2
       ORDER BY occurred_at ASC`,
      [bookingId, tenantId],
    );
  }

  /** Full evidence package — used by admin booking detail and audit report */
  async getFullEvidence(tenantId: string, bookingId: string) {
    const [record, milestones, transcript, opLog] = await Promise.all([
      this.getEvidenceRecord(tenantId, bookingId),
      this.getMilestones(tenantId, bookingId),
      this.getSmsTranscript(tenantId, bookingId),
      this.getOperationLog(tenantId, bookingId),
    ]);
    return {
      record,
      milestones,
      transcript,
      operation_log: opLog,
      summary: {
        has_gps:          milestones.length > 0,
        has_sms:          transcript.length > 0,
        has_route_image:  !!record?.route_image_url,
        is_frozen:        record?.evidence_status === 'frozen',
        milestone_types:  [...new Set(milestones.map((m: any) => m.milestone_type))],
        message_count:    transcript.length,
      },
    };
  }

  /** Find which booking a Twilio proxy number + passenger phone belongs to */
  async findBookingByTwilioMapping(
    tenantId: string,
    passengerFromNumber: string,
    twilioToNumber: string,
  ): Promise<{ bookingId: string; driverId: string } | null> {
    const rows = await this.dataSource.query(
      `SELECT booking_id, driver_id
       FROM public.trip_evidence_records
       WHERE tenant_id = $1
         AND passenger_phone = $2
         AND twilio_proxy_number = $3
         AND evidence_status = 'active'
         AND sms_bridge_closed_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [tenantId, passengerFromNumber, twilioToNumber],
    );
    return rows[0] ? { bookingId: rows[0].booking_id, driverId: rows[0].driver_id } : null;
  }

  /** Find booking by just passenger phone (latest active trip for this tenant) */
  async findActiveBookingByPassengerPhone(
    tenantId: string,
    passengerPhone: string,
  ): Promise<{ bookingId: string; driverId: string } | null> {
    const rows = await this.dataSource.query(
      `SELECT ter.booking_id, ter.driver_id
       FROM public.trip_evidence_records ter
       WHERE ter.tenant_id = $1
         AND ter.passenger_phone = $2
         AND ter.evidence_status = 'active'
         AND ter.sms_bridge_closed_at IS NULL
       ORDER BY ter.created_at DESC
       LIMIT 1`,
      [tenantId, passengerPhone],
    );
    return rows[0] ? { bookingId: rows[0].booking_id, driverId: rows[0].driver_id } : null;
  }
}
