/**
 * TripAuditService — generates a PDF audit/evidence report for admin use.
 * Uses pdfkit (already installed). Report is generated on-demand (not stored).
 *
 * Evidence freeze rule: report can be generated any time (frozen evidence is
 * read-only and therefore always consistent).
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import PDFDocument from 'pdfkit';
import { TripEvidenceService } from './trip-evidence.service';

@Injectable()
export class TripAuditService {
  private readonly logger = new Logger(TripAuditService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly evidenceSvc: TripEvidenceService,
  ) {}

  /** Generate PDF audit report buffer. Returns { buffer, filename }. */
  async generateReport(
    tenantId: string,
    bookingId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    // Fetch all evidence data
    const evidence = await this.evidenceSvc.getFullEvidence(tenantId, bookingId);
    if (!evidence.record) {
      throw new NotFoundException(`No trip evidence record found for booking ${bookingId}`);
    }

    // Fetch booking + driver details
    const bookingRows = await this.dataSource.query(
      `SELECT b.booking_reference, b.pickup_address_text, b.dropoff_address_text,
              b.pickup_at_utc, b.operational_status,
              b.passenger_first_name, b.passenger_last_name,
              b.passenger_phone_number, b.customer_phone_number,
              u.full_name AS driver_name, u.email AS driver_email,
              t.business_name AS company_name
       FROM public.bookings b
       LEFT JOIN public.users u ON u.id = $2
       LEFT JOIN public.tenants t ON t.id = b.tenant_id
       WHERE b.id = $1 AND b.tenant_id = $3`,
      [bookingId, evidence.record.driver_id, tenantId],
    );
    const booking = bookingRows[0];
    if (!booking) throw new NotFoundException('Booking not found');

    const record = evidence.record;
    const milestones: any[] = evidence.milestones;
    const transcript: any[] = evidence.transcript;
    const opLog: any[]      = evidence.operation_log;

    const fmtDt = (dt: string | null) =>
      dt ? new Date(dt).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', hour12: false }) : 'N/A';
    const fmtCoord = (lat: any, lng: any) =>
      lat && lng ? `${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}` : 'N/A';

    return new Promise<{ buffer: Buffer; filename: string }>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 48, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve({
        buffer: Buffer.concat(chunks),
        filename: `trip-audit-${booking.booking_reference}-${Date.now()}.pdf`,
      }));
      doc.on('error', reject);

      const grey    = '#888';
      const dark    = '#1a1a1a';
      const mid     = '#444';
      const accent  = '#2563eb';
      const divider = '#e5e7eb';

      const line = (y?: number) => {
        doc.moveTo(48, y ?? doc.y).lineTo(547, y ?? doc.y).strokeColor(divider).stroke();
      };

      // ── Header ──────────────────────────────────────────────────────────
      doc.fontSize(18).font('Helvetica-Bold').fillColor(dark)
         .text('Trip Evidence Audit Report', 48, 48);
      doc.fontSize(10).font('Helvetica').fillColor(grey)
         .text(`${booking.company_name ?? 'Company N/A'}  ·  Generated ${fmtDt(new Date().toISOString())}`, 48, 72);
      doc.moveDown(0.5);
      line();

      // ── Section helper ───────────────────────────────────────────────────
      const section = (title: string) => {
        doc.moveDown(0.8);
        doc.fontSize(11).font('Helvetica-Bold').fillColor(accent).text(title.toUpperCase());
        doc.moveDown(0.2);
        line();
        doc.moveDown(0.3);
      };

      const row = (label: string, value: string) => {
        doc.fontSize(9).font('Helvetica-Bold').fillColor(mid).text(label, 48, doc.y, { continued: true, width: 150 });
        doc.fontSize(9).font('Helvetica').fillColor(dark).text(value, { width: 350 });
      };

      // ── Booking Info ─────────────────────────────────────────────────────
      section('Trip Information');
      row('Booking Reference', booking.booking_reference ?? bookingId);
      row('Service Date',      fmtDt(booking.pickup_at_utc));
      row('Status',            booking.operational_status ?? 'N/A');
      row('Pickup',            booking.pickup_address_text ?? 'N/A');
      row('Dropoff',           booking.dropoff_address_text ?? 'N/A');

      // ── Driver Info ──────────────────────────────────────────────────────
      section('Driver');
      row('Name',  booking.driver_name ?? 'N/A');
      row('Email', booking.driver_email ?? 'N/A');
      row('ID',    record.driver_id ?? 'N/A');

      // ── Passenger Contact ────────────────────────────────────────────────
      section('Passenger Contact Bridge');
      const maskedPhone = record.passenger_phone
        ? record.passenger_phone.replace(/(\+?\d{2,4})\d{4}(\d{3})/, '$1****$2')
        : 'N/A';
      row('Passenger Phone (masked)', maskedPhone);
      row('Twilio Proxy Number',      record.twilio_proxy_number ?? 'N/A');
      row('Bridge Opened',            fmtDt(record.sms_bridge_opened_at));
      row('Bridge Closed',            fmtDt(record.sms_bridge_closed_at));

      // ── Evidence Status ──────────────────────────────────────────────────
      section('Evidence Record');
      row('Status',       record.evidence_status === 'frozen' ? '✓ FROZEN (finalized)' : 'ACTIVE');
      row('Frozen At',    fmtDt(record.evidence_frozen_at));
      row('Route Image',  record.route_image_url ? 'Generated ✓' : 'Not generated');

      // ── GPS Milestones ───────────────────────────────────────────────────
      section(`GPS Milestones (${milestones.length})`);
      if (milestones.length === 0) {
        doc.fontSize(9).fillColor(grey).text('No GPS milestones recorded for this trip.');
      } else {
        const milestoneLabel: Record<string, string> = {
          on_the_way: 'On The Way (departed)',
          arrived:    'Arrived at Pickup',
          pob:        'Passenger On Board (route start)',
          job_done:   'Job Done (route end)',
          trace:      'Route Trace Point',
        };
        for (const m of milestones) {
          const label = milestoneLabel[m.milestone_type] ?? m.milestone_type;
          row(`${label}`, `${fmtCoord(m.latitude, m.longitude)}  ·  ${fmtDt(m.recorded_at)}`);
        }
      }

      // ── Route Image ──────────────────────────────────────────────────────
      if (record.route_image_url) {
        section('Route Map Reference');
        doc.fontSize(8).font('Helvetica').fillColor(grey)
           .text('Static route map URL (view in browser):', { width: 500 });
        doc.fontSize(8).fillColor(accent)
           .text(record.route_image_url, { width: 500, link: record.route_image_url });
        doc.moveDown(0.2);
        doc.fontSize(8).fillColor(grey)
           .text('Markers: S=On The Way, A=Arrived, P=Passenger On Board, E=Job Done');
      }

      // ── SMS Transcript ───────────────────────────────────────────────────
      section(`SMS Conversation Transcript (${transcript.length} messages)`);
      if (transcript.length === 0) {
        doc.fontSize(9).fillColor(grey).text('No SMS messages recorded for this trip.');
      } else {
        for (const msg of transcript) {
          const dirLabel = msg.direction === 'outbound' ? '→ Driver→Passenger' : '← Passenger→Driver';
          const color    = msg.direction === 'outbound' ? accent : dark;
          doc.fontSize(8).font('Helvetica-Bold').fillColor(color)
             .text(`[${fmtDt(msg.sent_at)}]  ${dirLabel}`, { continued: false });
          doc.fontSize(9).font('Helvetica').fillColor(dark).text(msg.body, { indent: 20, width: 480 });
          doc.moveDown(0.3);
        }
      }

      // ── Operation Log ────────────────────────────────────────────────────
      section(`Operation Timeline (${opLog.length} events)`);
      if (opLog.length === 0) {
        doc.fontSize(9).fillColor(grey).text('No operation log entries.');
      } else {
        for (const entry of opLog) {
          doc.fontSize(8).font('Helvetica').fillColor(mid)
             .text(`${fmtDt(entry.occurred_at)}  [${entry.event_type}]  actor: ${entry.actor ?? 'system'}`,
               { width: 500 });
        }
      }

      // ── Footer ───────────────────────────────────────────────────────────
      doc.moveDown(1);
      line();
      doc.moveDown(0.4);
      doc.fontSize(8).fillColor(grey)
         .text(
           `Booking ID: ${bookingId}  ·  Tenant: ${tenantId}  ·  Report generated: ${fmtDt(new Date().toISOString())}`,
           { align: 'center' },
         );

      doc.end();
    });
  }
}
