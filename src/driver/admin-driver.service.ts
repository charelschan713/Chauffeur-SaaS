import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AdminDriverService {
  constructor(private readonly db: DataSource) {}

  // ── Driver pay review: admin confirms final driver payable ───────────────
  // This is the authoritative money-setting action for the driver settlement.
  // After this, the assignment becomes READY_FOR_DRIVER_INVOICE and the driver
  // can include it in a driver invoice.

  async reviewDriverPay(
    tenantId: string,
    bookingId: string,
    adminId: string,
    body: {
      assignment_id:              string;
      base_driver_pay_minor:      number;
      extra_waiting_pay_minor?:   number;
      extra_waypoint_pay_minor?:  number;
      toll_parking_reimburse_minor?: number;
      other_adjustment_minor?:    number;
      currency?:                  string;
      review_notes?:              string;
    },
  ) {
    // Verify assignment belongs to this tenant and booking
    const [assignment] = await this.db.query(
      `SELECT a.id, a.driver_id, a.driver_payout_status
         FROM public.assignments a
        WHERE a.id = $1 AND a.booking_id = $2 AND a.tenant_id = $3`,
      [body.assignment_id, bookingId, tenantId],
    );
    if (!assignment) throw new NotFoundException('Assignment not found for this booking');

    if (assignment.driver_payout_status === 'INVOICED' ||
        assignment.driver_payout_status === 'PAID_BY_ADMIN' ||
        assignment.driver_payout_status === 'RECEIVED_BY_DRIVER') {
      throw new BadRequestException(
        `Cannot review driver pay: assignment is already in state ${assignment.driver_payout_status}`,
      );
    }

    // Upsert driver_payable_reviews
    const [review] = await this.db.query(
      `INSERT INTO public.driver_payable_reviews
         (tenant_id, booking_id, assignment_id, driver_id,
          base_driver_pay_minor, extra_waiting_pay_minor, extra_waypoint_pay_minor,
          toll_parking_reimburse_minor, other_adjustment_minor,
          currency, review_notes, reviewed_at, reviewed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),$12)
       ON CONFLICT (assignment_id) DO UPDATE
         SET base_driver_pay_minor         = EXCLUDED.base_driver_pay_minor,
             extra_waiting_pay_minor       = EXCLUDED.extra_waiting_pay_minor,
             extra_waypoint_pay_minor      = EXCLUDED.extra_waypoint_pay_minor,
             toll_parking_reimburse_minor  = EXCLUDED.toll_parking_reimburse_minor,
             other_adjustment_minor        = EXCLUDED.other_adjustment_minor,
             currency                      = EXCLUDED.currency,
             review_notes                  = EXCLUDED.review_notes,
             reviewed_at                   = NOW(),
             reviewed_by                   = EXCLUDED.reviewed_by
       RETURNING id, total_driver_payable_minor`,
      [
        tenantId, bookingId, body.assignment_id, assignment.driver_id,
        body.base_driver_pay_minor || 0,
        body.extra_waiting_pay_minor ?? 0,
        body.extra_waypoint_pay_minor ?? 0,
        body.toll_parking_reimburse_minor ?? 0,
        body.other_adjustment_minor ?? 0,
        body.currency ?? 'AUD',
        body.review_notes ?? null,
        adminId,
      ],
    );

    // Advance settlement state
    await this.db.query(
      `UPDATE public.assignments
         SET driver_payout_status = 'READY_FOR_DRIVER_INVOICE', updated_at = NOW()
       WHERE id = $1`,
      [body.assignment_id],
    );

    return {
      review_id: review.id,
      total_driver_payable_minor: review.total_driver_payable_minor,
      settlement_status: 'READY_FOR_DRIVER_INVOICE',
    };
  }

  async getDriverPayReview(tenantId: string, bookingId: string) {
    const rows = await this.db.query(
      `SELECT dpr.*, a.driver_payout_status, u.full_name AS driver_name,
              reviewer.full_name AS reviewed_by_name
         FROM public.driver_payable_reviews dpr
         JOIN public.assignments a ON a.id = dpr.assignment_id
         LEFT JOIN public.users u ON u.id = dpr.driver_id
         LEFT JOIN public.users reviewer ON reviewer.id = dpr.reviewed_by
        WHERE dpr.booking_id = $1 AND dpr.tenant_id = $2
        ORDER BY dpr.reviewed_at DESC`,
      [bookingId, tenantId],
    );
    return rows;
  }

  // ── Admin: list driver invoices ──────────────────────────────────────────

  async listDriverInvoices(tenantId: string, filters: { driver_id?: string; status?: string }) {
    const conditions = [`i.tenant_id = $1`];
    const params: any[] = [tenantId];
    let idx = 2;

    if (filters.driver_id) { conditions.push(`i.driver_id = $${idx++}`); params.push(filters.driver_id); }
    if (filters.status) { conditions.push(`i.invoice_status = $${idx++}`); params.push(filters.status); }

    return this.db.query(
      `SELECT i.id, i.invoice_number, i.invoice_status, i.total_minor, i.currency,
              i.item_count, i.created_at, i.submitted_at, i.paid_by_admin_at,
              i.received_by_driver_at, i.dispute_reason,
              u.full_name AS driver_name, u.email AS driver_email
         FROM public.driver_invoices i
         LEFT JOIN public.users u ON u.id = i.driver_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY i.created_at DESC`,
      params,
    );
  }

  async getDriverInvoice(tenantId: string, invoiceId: string) {
    const [inv] = await this.db.query(
      `SELECT i.*, u.full_name AS driver_name, u.email AS driver_email
         FROM public.driver_invoices i
         LEFT JOIN public.users u ON u.id = i.driver_id
        WHERE i.id = $1 AND i.tenant_id = $2`,
      [invoiceId, tenantId],
    );
    if (!inv) throw new NotFoundException('Driver invoice not found');

    const items = await this.db.query(
      `SELECT dii.*,
              b.pickup_at_utc, b.pickup_address_text, b.dropoff_address_text,
              dpr.base_driver_pay_minor, dpr.extra_waiting_pay_minor,
              dpr.extra_waypoint_pay_minor, dpr.toll_parking_reimburse_minor,
              dpr.other_adjustment_minor
         FROM public.driver_invoice_items dii
         JOIN public.bookings b ON b.id = dii.booking_id
         LEFT JOIN public.driver_payable_reviews dpr ON dpr.id = dii.payable_review_id
        WHERE dii.driver_invoice_id = $1
        ORDER BY dii.service_date ASC`,
      [invoiceId],
    );

    return { ...inv, items };
  }

  // ── Admin: mark driver invoice paid ─────────────────────────────────────

  async markDriverInvoicePaid(
    tenantId: string,
    invoiceId: string,
    adminId: string,
    body: { notes?: string },
  ) {
    const [inv] = await this.db.query(
      `UPDATE public.driver_invoices
         SET invoice_status = 'PAID_BY_ADMIN',
             paid_by_admin_at = NOW(),
             paid_by_admin_by = $3,
             notes = COALESCE($4, notes),
             updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
         AND invoice_status = 'SUBMITTED'
       RETURNING id, invoice_number, invoice_status`,
      [invoiceId, tenantId, adminId, body.notes ?? null],
    );
    if (!inv) throw new BadRequestException('Invoice must be in SUBMITTED status to mark paid');

    // Mark assignment settlement states
    await this.db.query(
      `UPDATE public.assignments
         SET driver_payout_status = 'PAID_BY_ADMIN', updated_at = NOW()
       WHERE id IN (
         SELECT assignment_id FROM public.driver_invoice_items WHERE driver_invoice_id = $1
       )`,
      [invoiceId],
    );

    return { success: true, invoice_number: inv.invoice_number, status: inv.invoice_status };
  }

  // ── Admin: dispute invoice ────────────────────────────────────────────────

  async disputeDriverInvoice(
    tenantId: string,
    invoiceId: string,
    adminId: string,
    body: { dispute_reason: string },
  ) {
    const [inv] = await this.db.query(
      `UPDATE public.driver_invoices
         SET invoice_status = 'DISPUTED',
             dispute_reason = $3,
             updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
         AND invoice_status IN ('SUBMITTED', 'DRAFT')
       RETURNING id, invoice_number, invoice_status`,
      [invoiceId, tenantId, body.dispute_reason],
    );
    if (!inv) throw new BadRequestException('Invoice cannot be disputed in current state');

    // Mark assignments DISPUTED
    await this.db.query(
      `UPDATE public.assignments
         SET driver_payout_status = 'DISPUTED', updated_at = NOW()
       WHERE id IN (
         SELECT assignment_id FROM public.driver_invoice_items WHERE driver_invoice_id = $1
       )`,
      [invoiceId],
    );

    return { success: true, invoice_number: inv.invoice_number, status: inv.invoice_status };
  }
}
