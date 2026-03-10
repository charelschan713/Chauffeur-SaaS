import {
  BadRequestException, Body, Controller, Delete, Get, NotFoundException,
  Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { DataSource } from 'typeorm';
import { TenantInvoiceService } from '../tenant/tenant-invoice.service';

// Adjustment statuses that block invoice send (extra charge still unresolved)
const INVOICE_BLOCKED_ADJ = new Set(['FAILED', 'NO_PAYMENT_METHOD', 'PENDING']);

@Controller('invoices')
@UseGuards(JwtGuard)
export class InvoiceController {
  constructor(
    private readonly db: DataSource,
    private readonly tenantInvoice: TenantInvoiceService,
  ) {}

  private async nextNumber(tenantId: string): Promise<string> {
    const rows = await this.db.query(
      `SELECT COUNT(*) FROM public.invoices WHERE tenant_id = $1`, [tenantId],
    );
    return `INV-${String(Number(rows[0].count) + 1).padStart(5, '0')}`;
  }

  @Get()
  async list(@Req() req: any,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('booking_id') bookingId?: string,
    @Query('limit') limit = '100',
    @Query('offset') offset = '0',
  ) {
    const conds: string[] = ['i.tenant_id = $1', 'i.deleted_at IS NULL'];
    const params: any[] = [req.user.tenant_id];
    if (status)    { conds.push(`i.status = $${params.length + 1}`); params.push(status); }
    if (type)      { conds.push(`i.invoice_type = $${params.length + 1}`); params.push(type); }
    if (bookingId) { conds.push(`i.booking_id = $${params.length + 1}`); params.push(bookingId); }
    const where = conds.join(' AND ');
    const [rows, count] = await Promise.all([
      this.db.query(
        `SELECT i.*,
                u.full_name as driver_full_name
           FROM public.invoices i
           LEFT JOIN public.users u ON u.id = i.submitted_by_driver_id
          WHERE ${where}
          ORDER BY i.created_at DESC
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, Number(limit), Number(offset)],
      ),
      this.db.query(`SELECT COUNT(*) FROM public.invoices i WHERE ${where}`, params),
    ]);
    return { data: rows, total: Number(count[0].count) };
  }

  @Get(':id')
  async get(@Param('id') id: string, @Req() req: any) {
    const [rows, jobs] = await Promise.all([
      this.db.query(
        `SELECT i.*, u.full_name as driver_full_name
           FROM public.invoices i
           LEFT JOIN public.users u ON u.id = i.submitted_by_driver_id
          WHERE i.id = $1 AND i.tenant_id = $2 AND i.deleted_at IS NULL`,
        [id, req.user.tenant_id],
      ),
      this.db.query(
        `SELECT ia.*, b.booking_reference, b.pickup_at_utc, b.pickup_address_text, b.dropoff_address_text
           FROM public.invoice_assignments ia
           LEFT JOIN public.bookings b ON b.id = ia.booking_id
          WHERE ia.invoice_id = $1`,
        [id],
      ),
    ]);
    if (!rows.length) throw new NotFoundException('Invoice not found');
    return { ...rows[0], jobs };
  }

  @Post()
  async create(@Body() body: any, @Req() req: any) {
    const invoiceNumber = body.invoice_number ?? await this.nextNumber(req.user.tenant_id);
    const rows = await this.db.query(
      `INSERT INTO public.invoices
         (tenant_id, invoice_number, invoice_type, status, booking_id,
          recipient_name, recipient_email, recipient_phone,
          subtotal_minor, tax_minor, discount_minor, total_minor, currency,
          issue_date, due_date, line_items, notes, internal_notes,
          submitted_by_driver_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING *`,
      [
        req.user.tenant_id, invoiceNumber,
        body.invoice_type ?? 'CUSTOMER',
        body.status ?? 'DRAFT',
        body.booking_id ?? null,
        body.recipient_name, body.recipient_email ?? null, body.recipient_phone ?? null,
        body.subtotal_minor ?? 0, body.tax_minor ?? 0,
        body.discount_minor ?? 0, body.total_minor ?? 0,
        body.currency ?? 'AUD',
        body.issue_date ?? new Date().toISOString().slice(0, 10),
        body.due_date ?? null,
        JSON.stringify(body.line_items ?? []),
        body.notes ?? null, body.internal_notes ?? null,
        body.submitted_by_driver_id ?? null,
      ],
    );
    const invoice = rows[0];
    // Link jobs for driver invoices
    if (body.jobs?.length) {
      for (const job of body.jobs) {
        await this.db.query(
          `INSERT INTO public.invoice_assignments (invoice_id, booking_id, assignment_id, description, amount_minor)
           VALUES ($1,$2,$3,$4,$5)`,
          [invoice.id, job.booking_id ?? null, job.assignment_id ?? null, job.description ?? null, job.amount_minor ?? 0],
        );
      }
    }
    return invoice;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    // Gate SENT transition via PATCH (same rules as POST :id/send)
    if (body.status === 'SENT') {
      await this.assertInvoiceGatingSafe(id, req.user.tenant_id);
    }
    const rows = await this.db.query(
      `UPDATE public.invoices SET
         status = COALESCE($3, status),
         recipient_name = COALESCE($4, recipient_name),
         recipient_email = COALESCE($5, recipient_email),
         subtotal_minor = COALESCE($6, subtotal_minor),
         tax_minor = COALESCE($7, tax_minor),
         discount_minor = COALESCE($8, discount_minor),
         total_minor = COALESCE($9, total_minor),
         due_date = COALESCE($10, due_date),
         paid_date = COALESCE($11, paid_date),
         paid_minor = COALESCE($12, paid_minor),
         line_items = COALESCE($13, line_items),
         notes = COALESCE($14, notes),
         internal_notes = COALESCE($15, internal_notes),
         updated_at = now()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, req.user.tenant_id,
       body.status ?? null, body.recipient_name ?? null, body.recipient_email ?? null,
       body.subtotal_minor ?? null, body.tax_minor ?? null, body.discount_minor ?? null,
       body.total_minor ?? null, body.due_date ?? null, body.paid_date ?? null,
       body.paid_minor ?? null,
       body.line_items ? JSON.stringify(body.line_items) : null,
       body.notes ?? null, body.internal_notes ?? null],
    );
    if (!rows.length) throw new NotFoundException('Invoice not found');
    // Replace jobs if provided
    if (body.jobs !== undefined) {
      await this.db.query(`DELETE FROM public.invoice_assignments WHERE invoice_id = $1`, [id]);
      for (const job of body.jobs) {
        await this.db.query(
          `INSERT INTO public.invoice_assignments (invoice_id, booking_id, assignment_id, description, amount_minor)
           VALUES ($1,$2,$3,$4,$5)`,
          [id, job.booking_id ?? null, job.assignment_id ?? null, job.description ?? null, job.amount_minor ?? 0],
        );
      }
    }
    return rows[0];
  }

  /** Shared helper: check invoice gating before any SENT transition */
  private async assertInvoiceGatingSafe(invoiceId: string, tenantId: string): Promise<void> {
    // Fetch the invoice + booking adjustment_status (only if booking_id set)
    const [inv] = await this.db.query(
      `SELECT i.invoice_type, i.booking_id, b.operational_status, b.adjustment_status
       FROM public.invoices i
       LEFT JOIN public.bookings b ON b.id = i.booking_id
       WHERE i.id=$1 AND i.tenant_id=$2 AND i.deleted_at IS NULL`,
      [invoiceId, tenantId],
    );
    if (!inv) throw new NotFoundException('Invoice not found');
    // Only CUSTOMER invoices linked to a booking have gating
    if (inv.invoice_type !== 'CUSTOMER' || !inv.booking_id) return;
    // Booking must be fulfilled
    if (!['FULFILLED','COMPLETED'].includes(inv.operational_status ?? '')) {
      throw new BadRequestException(
        `Cannot send final invoice: booking is not yet fulfilled (status: ${inv.operational_status ?? 'unknown'})`,
      );
    }
    // Extra charge must be resolved
    if (INVOICE_BLOCKED_ADJ.has(inv.adjustment_status)) {
      throw new BadRequestException(
        `Cannot send final invoice: extra charge is unresolved (adjustment_status: ${inv.adjustment_status}). ` +
        `Collect the extra amount first.`,
      );
    }

    // ── Tenant invoice readiness ──────────────────────────────────────────────
    // Only CUSTOMER invoices require tenant readiness (company profile + invoice config)
    const readiness = await this.tenantInvoice.checkReadiness(tenantId);
    if (!readiness.invoice_ready) {
      const missing = [
        ...readiness.company_profile.missing,
        ...readiness.invoice_profile.missing,
        ...readiness.payment_instruction.missing,
      ];
      throw new BadRequestException(
        `Tenant is not invoice-ready. Complete the following: ${missing.join('; ')}`,
      );
    }
    // ─────────────────────────────────────────────────────────────────────────
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string, @Req() req: any) {
    const rows = await this.db.query(
      `UPDATE public.invoices SET
         status = 'SENT', approved_at = now(), approved_by = $3, updated_at = now()
       WHERE id = $1 AND tenant_id = $2 AND invoice_type = 'DRIVER'
       RETURNING *`,
      [id, req.user.tenant_id, req.user.sub],
    );
    if (!rows.length) throw new NotFoundException('Invoice not found');
    return rows[0];
  }

  /** Send a CUSTOMER invoice — gated by booking fulfilment + extra-charge resolution */
  @Post(':id/send')
  async send(@Param('id') id: string, @Req() req: any) {
    await this.assertInvoiceGatingSafe(id, req.user.tenant_id);
    const rows = await this.db.query(
      `UPDATE public.invoices
         SET status='SENT', updated_at=now()
       WHERE id=$1 AND tenant_id=$2 AND invoice_type='CUSTOMER'
         AND status IN ('DRAFT','OVERDUE')
       RETURNING *`,
      [id, req.user.tenant_id],
    );
    if (!rows.length) throw new NotFoundException('Invoice not found or already sent');
    return rows[0];
  }

  @Post(':id/mark-paid')
  async markPaid(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const rows = await this.db.query(
      `UPDATE public.invoices SET
         status = 'PAID', paid_date = COALESCE($3, CURRENT_DATE),
         paid_minor = total_minor, updated_at = now()
       WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [id, req.user.tenant_id, body.paid_date ?? null],
    );
    if (!rows.length) throw new NotFoundException('Invoice not found');
    return rows[0];
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    await this.db.query(
      `UPDATE public.invoices SET deleted_at = now() WHERE id = $1 AND tenant_id = $2`,
      [id, req.user.tenant_id],
    );
    return { success: true };
  }

  // ── Completed jobs available to link to driver invoices ──────────────────

  @Get('driver-jobs/completed')
  async completedJobs(@Req() req: any, @Query('driver_id') driverId?: string) {
    const conds = [`b.tenant_id = $1`, `b.operational_status IN ('COMPLETED')`];
    const params: any[] = [req.user.tenant_id];
    if (driverId) { conds.push(`a.driver_id = $${params.length + 1}`); params.push(driverId); }
    return this.db.query(
      `SELECT a.id as assignment_id, b.id as booking_id,
              b.booking_reference, b.pickup_at_utc,
              b.pickup_address_text, b.dropoff_address_text,
              b.total_price_minor, b.currency,
              a.driver_pay_minor,
              u.full_name as driver_name,
              a.driver_id
         FROM public.assignments a
         JOIN public.bookings b ON b.id = a.booking_id
         LEFT JOIN public.users u ON u.id = a.driver_id
        WHERE ${conds.join(' AND ')}
          AND a.id NOT IN (
            SELECT ia.assignment_id FROM public.invoice_assignments ia
            WHERE ia.assignment_id IS NOT NULL
          )
        ORDER BY b.pickup_at_utc DESC
        LIMIT 200`,
      params,
    );
  }
}
