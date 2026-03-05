import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { DataSource } from 'typeorm';

@Controller('invoices')
@UseGuards(JwtGuard)
export class InvoiceController {
  constructor(private readonly db: DataSource) {}

  // ── helpers ──────────────────────────────────────────────────────────────

  private async nextNumber(tenantId: string): Promise<string> {
    const rows = await this.db.query(
      `SELECT COUNT(*) FROM public.invoices WHERE tenant_id = $1`,
      [tenantId],
    );
    const n = Number(rows[0].count) + 1;
    return `INV-${String(n).padStart(5, '0')}`;
  }

  // ── list ─────────────────────────────────────────────────────────────────

  @Get()
  async list(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('booking_id') bookingId?: string,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
  ) {
    const conditions: string[] = ['tenant_id = $1', 'deleted_at IS NULL'];
    const params: any[] = [req.user.tenant_id];

    if (status) { conditions.push(`status = $${params.length + 1}`); params.push(status); }
    if (type) { conditions.push(`invoice_type = $${params.length + 1}`); params.push(type); }
    if (bookingId) { conditions.push(`booking_id = $${params.length + 1}`); params.push(bookingId); }

    const where = conditions.join(' AND ');
    const [rows, countRows] = await Promise.all([
      this.db.query(
        `SELECT * FROM public.invoices WHERE ${where}
         ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, Number(limit), Number(offset)],
      ),
      this.db.query(`SELECT COUNT(*) FROM public.invoices WHERE ${where}`, params),
    ]);
    return { data: rows, total: Number(countRows[0].count) };
  }

  // ── get one ──────────────────────────────────────────────────────────────

  @Get(':id')
  async get(@Param('id') id: string, @Req() req: any) {
    const rows = await this.db.query(
      `SELECT * FROM public.invoices WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [id, req.user.tenant_id],
    );
    if (!rows.length) throw new (await import('@nestjs/common').then(m => m.NotFoundException))('Invoice not found');
    return rows[0];
  }

  // ── create ───────────────────────────────────────────────────────────────

  @Post()
  async create(@Body() body: any, @Req() req: any) {
    const invoiceNumber = body.invoice_number ?? await this.nextNumber(req.user.tenant_id);
    const rows = await this.db.query(
      `INSERT INTO public.invoices
         (tenant_id, invoice_number, invoice_type, status, booking_id, assignment_id,
          recipient_name, recipient_email, recipient_phone,
          subtotal_minor, tax_minor, discount_minor, total_minor, currency,
          issue_date, due_date, line_items, notes, internal_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING *`,
      [
        req.user.tenant_id,
        invoiceNumber,
        body.invoice_type ?? 'CUSTOMER',
        body.status ?? 'DRAFT',
        body.booking_id ?? null,
        body.assignment_id ?? null,
        body.recipient_name,
        body.recipient_email ?? null,
        body.recipient_phone ?? null,
        body.subtotal_minor ?? 0,
        body.tax_minor ?? 0,
        body.discount_minor ?? 0,
        body.total_minor ?? 0,
        body.currency ?? 'AUD',
        body.issue_date ?? new Date().toISOString().slice(0, 10),
        body.due_date ?? null,
        JSON.stringify(body.line_items ?? []),
        body.notes ?? null,
        body.internal_notes ?? null,
      ],
    );
    return rows[0];
  }

  // ── update ───────────────────────────────────────────────────────────────

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
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
      [
        id, req.user.tenant_id,
        body.status ?? null,
        body.recipient_name ?? null,
        body.recipient_email ?? null,
        body.subtotal_minor ?? null,
        body.tax_minor ?? null,
        body.discount_minor ?? null,
        body.total_minor ?? null,
        body.due_date ?? null,
        body.paid_date ?? null,
        body.paid_minor ?? null,
        body.line_items ? JSON.stringify(body.line_items) : null,
        body.notes ?? null,
        body.internal_notes ?? null,
      ],
    );
    if (!rows.length) throw new (await import('@nestjs/common').then(m => m.NotFoundException))('Invoice not found');
    return rows[0];
  }

  // ── mark paid ─────────────────────────────────────────────────────────────

  @Post(':id/mark-paid')
  async markPaid(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const rows = await this.db.query(
      `UPDATE public.invoices SET
         status = 'PAID', paid_date = COALESCE($3, CURRENT_DATE), paid_minor = total_minor, updated_at = now()
       WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [id, req.user.tenant_id, body.paid_date ?? null],
    );
    if (!rows.length) throw new (await import('@nestjs/common').then(m => m.NotFoundException))('Invoice not found');
    return rows[0];
  }

  // ── soft delete ───────────────────────────────────────────────────────────

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    await this.db.query(
      `UPDATE public.invoices SET deleted_at = now() WHERE id = $1 AND tenant_id = $2`,
      [id, req.user.tenant_id],
    );
    return { success: true };
  }
}
