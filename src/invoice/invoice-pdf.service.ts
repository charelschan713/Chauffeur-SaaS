import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';

export interface InvoicePdfData {
  invoice_number:   string;
  issue_date:       string | Date | null;
  due_date:         string | Date | null;
  booking_reference?: string | null;
  company_name:     string;
  company_email?:   string | null;
  company_phone?:   string | null;
  recipient_name:   string;
  recipient_email?: string | null;
  currency:         string;
  subtotal_minor:   number;
  tax_minor:        number;
  discount_minor:   number;
  total_minor:      number;
  line_items:       Array<{
    description: string;
    quantity?:   number;
    unit_price_minor?: number;
    total_minor: number;
  }> | null;
  notes?: string | null;
}

function fmtMoney(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

function fmtDate(d: string | Date | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * InvoicePdfService
 * Generates a professional PDF invoice as a Buffer using pdfkit (pure Node.js).
 * Used by:
 *   1. NotificationService.onInvoiceSent() — attaches PDF to customer email
 *   2. CustomerPortalService.getInvoicePdf() — customer download endpoint
 */
@Injectable()
export class InvoicePdfService {
  private readonly logger = new Logger(InvoicePdfService.name);

  async generate(data: InvoicePdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const GOLD   = '#C8A870';
        const DARK   = '#1A1A2E';
        const GREY   = '#6b7280';
        const W      = 495; // usable width
        const LEFT   = 50;

        // ── Header bar ──────────────────────────────────────────────────────
        doc.rect(0, 0, 595, 80).fill(DARK);
        doc.fillColor('#FFFFFF').fontSize(22).font('Helvetica-Bold')
           .text(data.company_name, LEFT, 24, { width: 300 });
        doc.fillColor(GOLD).fontSize(11).font('Helvetica')
           .text('TAX INVOICE', LEFT, 52, { width: 300 });
        doc.fillColor(GOLD).fontSize(18).font('Helvetica-Bold')
           .text(data.invoice_number, 400, 24, { width: 150, align: 'right' });
        doc.fillColor('#cccccc').fontSize(9).font('Helvetica')
           .text(`Issued: ${fmtDate(data.issue_date)}`, 400, 52, { width: 150, align: 'right' });

        doc.moveDown(3.5);

        // ── Billing info ─────────────────────────────────────────────────────
        const y1 = doc.y;
        doc.fillColor(GREY).fontSize(8).font('Helvetica-Bold').text('FROM', LEFT, y1);
        doc.fillColor(DARK).fontSize(10).font('Helvetica-Bold').text(data.company_name, LEFT, y1 + 13);
        if (data.company_email)
          doc.fillColor(GREY).fontSize(9).font('Helvetica').text(data.company_email, LEFT, doc.y + 2);
        if (data.company_phone)
          doc.fillColor(GREY).fontSize(9).font('Helvetica').text(data.company_phone, LEFT, doc.y + 2);

        const col2 = LEFT + 260;
        doc.fillColor(GREY).fontSize(8).font('Helvetica-Bold').text('BILL TO', col2, y1);
        doc.fillColor(DARK).fontSize(10).font('Helvetica-Bold').text(data.recipient_name, col2, y1 + 13);
        if (data.recipient_email)
          doc.fillColor(GREY).fontSize(9).font('Helvetica').text(data.recipient_email, col2, doc.y + 2);

        if (data.booking_reference) {
          const col3 = LEFT + 400;
          doc.fillColor(GREY).fontSize(8).font('Helvetica-Bold').text('BOOKING', col3, y1);
          doc.fillColor(DARK).fontSize(10).font('Helvetica').text(data.booking_reference, col3, y1 + 13);
          if (data.due_date) {
            doc.fillColor(GREY).fontSize(8).font('Helvetica-Bold').text('DUE DATE', col3, doc.y + 8);
            doc.fillColor(DARK).fontSize(9).font('Helvetica').text(fmtDate(data.due_date), col3, doc.y + 3);
          }
        }

        doc.moveDown(3);

        // ── Line items table header ──────────────────────────────────────────
        const tableY = doc.y;
        doc.rect(LEFT, tableY, W, 22).fill(DARK);
        doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold')
           .text('DESCRIPTION',        LEFT + 8,  tableY + 7, { width: 260 })
           .text('QTY',                LEFT + 276, tableY + 7, { width: 50, align: 'right' })
           .text('UNIT PRICE',         LEFT + 334, tableY + 7, { width: 80, align: 'right' })
           .text('AMOUNT',             LEFT + 420, tableY + 7, { width: 67, align: 'right' });

        const lineItems = Array.isArray(data.line_items) && data.line_items.length > 0
          ? data.line_items
          : [{ description: 'Chauffeur Service', total_minor: data.subtotal_minor }];

        let rowY = tableY + 24;
        lineItems.forEach((item, i) => {
          const bg = i % 2 === 1 ? '#F9FAFB' : '#FFFFFF';
          doc.rect(LEFT, rowY, W, 20).fill(bg);
          doc.fillColor(DARK).fontSize(9).font('Helvetica')
             .text(item.description || '—',                 LEFT + 8,   rowY + 6, { width: 260 })
             .text(String(item.quantity ?? 1),               LEFT + 276, rowY + 6, { width: 50,  align: 'right' })
             .text(fmtMoney(item.unit_price_minor ?? item.total_minor, data.currency),
                                                              LEFT + 334, rowY + 6, { width: 80,  align: 'right' })
             .text(fmtMoney(item.total_minor, data.currency), LEFT + 420, rowY + 6, { width: 67,  align: 'right' });
          rowY += 20;
        });

        // ── Totals ───────────────────────────────────────────────────────────
        rowY += 8;
        const totals: Array<[string, number, boolean]> = [
          ['Subtotal',  data.subtotal_minor,  false],
          ['Tax (GST)', data.tax_minor,        false],
          ['Discount',  -(data.discount_minor), false],
          ['TOTAL DUE', data.total_minor,      true],
        ];
        totals.forEach(([label, amount, bold]) => {
          if (!bold && amount === 0) return;
          const lx = LEFT + 330;
          const ax = LEFT + 420;
          doc.fillColor(bold ? DARK : GREY)
             .fontSize(bold ? 11 : 9)
             .font(bold ? 'Helvetica-Bold' : 'Helvetica')
             .text(label, lx, rowY, { width: 82, align: 'right' });
          if (bold) doc.fillColor(GOLD);
          doc.text(fmtMoney(Math.abs(amount), data.currency), ax, rowY, { width: 67, align: 'right' });
          rowY += bold ? 18 : 14;
        });

        // ── Divider + notes ──────────────────────────────────────────────────
        doc.moveTo(LEFT, rowY + 8).lineTo(LEFT + W, rowY + 8).strokeColor('#E5E7EB').stroke();
        rowY += 20;
        if (data.notes) {
          doc.fillColor(GREY).fontSize(8).font('Helvetica-Bold').text('NOTES', LEFT, rowY);
          doc.fillColor(DARK).fontSize(9).font('Helvetica').text(data.notes, LEFT, rowY + 12, { width: W });
        }

        // ── Footer ───────────────────────────────────────────────────────────
        doc.rect(0, 790, 595, 52).fill(DARK);
        doc.fillColor(GOLD).fontSize(8).font('Helvetica')
           .text('Thank you for choosing our service.', LEFT, 800, { width: W, align: 'center' });
        doc.fillColor('#888888').fontSize(7)
           .text(`${data.company_name} · Generated ${fmtDate(new Date())}`, LEFT, 813, { width: W, align: 'center' });

        doc.end();
      } catch (err) {
        this.logger.error('PDF generation failed', err);
        reject(err);
      }
    });
  }
}
