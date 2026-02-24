import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';
import axios from 'axios';

const GST_RATE = 0.1; // 10%

@Injectable()
export class InvoicesService {
  // =====================
  // ABN验证（澳洲政府API）
  // =====================
  async verifyABN(abn: string): Promise<{
    valid: boolean;
    abn_name?: string;
    is_gst_registered?: boolean;
    error?: string;
  }> {
    const cleanABN = abn.replace(/\s/g, '');

    if (cleanABN.length !== 11) {
      return { valid: false, error: 'ABN must be 11 digits' };
    }

    try {
      const guid = process.env.ABN_LOOKUP_GUID;
      if (!guid) {
        return {
          valid: true,
          abn_name: 'ABN Lookup not configured',
          is_gst_registered: false,
        };
      }

      const url =
        'https://abr.business.gov.au/abrxmlsearch/AbrXmlSearch.asmx/SearchByABNv202001';
      const res = await axios.get(url, {
        params: {
          searchString: cleanABN,
          includeHistoricalDetails: 'N',
          authenticationGuid: guid,
        },
      });

      const xml = res.data as string;

      if (xml.includes('<exception>')) {
        return { valid: false, error: 'Invalid ABN' };
      }

      const nameMatch =
        xml.match(/<organisationName>(.*?)<\/organisationName>/) ||
        xml.match(/<fullName>(.*?)<\/fullName>/);
      const abn_name = nameMatch ? nameMatch[1] : '';

      const gstMatch = xml.match(/<goodsAndServicesTax>(.*?)<\/goodsAndServicesTax>/);
      const is_gst_registered = gstMatch ? gstMatch[1].includes('Y') : false;

      return { valid: true, abn_name, is_gst_registered };
    } catch (err: any) {
      return { valid: false, error: err.message };
    }
  }

  // =====================
  // 更新司机ABN信息
  // =====================
  async updateDriverABN(
    driver_id: string,
    dto: {
      abn: string;
      bank_bsb?: string;
      bank_account?: string;
      bank_name?: string;
      invoice_prefix?: string;
    },
  ) {
    const verification = await this.verifyABN(dto.abn);

    const { data, error } = await supabaseAdmin
      .from('drivers')
      .update({
        abn: dto.abn.replace(/\s/g, ''),
        abn_name: verification.abn_name ?? null,
        abn_verified: verification.valid,
        is_gst_registered: verification.is_gst_registered ?? false,
        bank_bsb: dto.bank_bsb ?? null,
        bank_account: dto.bank_account ?? null,
        bank_name: dto.bank_name ?? null,
        invoice_prefix: dto.invoice_prefix ?? 'INV',
      })
      .eq('id', driver_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    return {
      ...data,
      abn_verification: verification,
    };
  }

  // =====================
  // 获取司机可开Invoice的booking列表
  // =====================
  async getInvoiceableBookings(driver_id: string) {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        id,
        booking_number,
        pickup_datetime,
        pickup_address,
        dropoff_address,
        driver_fare,
        driver_toll,
        driver_extras,
        driver_total,
        currency,
        booking_status,
        driver_status,
        tenant_service_cities(city_name, timezone)
      `)
      .eq('driver_id', driver_id)
      .eq('driver_status', 'JOB_DONE')
      .eq('booking_status', 'JOB_DONE')
      .not('id', 'in', `(SELECT booking_id FROM driver_invoice_items WHERE booking_id IS NOT NULL)`);

    if (error) throw new BadRequestException(error.message);

    return data ?? [];
  }

  // =====================
  // 创建Invoice（单张或合并）
  // =====================
  async createInvoice(driver_id: string, tenant_id: string, booking_ids: string[]) {
    if (!booking_ids || booking_ids.length === 0) {
      throw new BadRequestException('At least one booking required');
    }

    const { data: driver } = await supabaseAdmin
      .from('drivers')
      .select(`
        *,
        profiles(first_name, last_name, email, phone)
      `)
      .eq('id', driver_id)
      .single();

    if (!driver) throw new NotFoundException('Driver not found');
    if (!(driver as any).abn) {
      throw new BadRequestException('ABN required before generating invoice');
    }

    const { data: bookings, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        id,
        booking_number,
        pickup_datetime,
        pickup_address,
        dropoff_address,
        driver_fare,
        driver_toll,
        driver_extras,
        driver_total,
        currency,
        tenant_service_cities(city_name, timezone)
      `)
      .in('id', booking_ids)
      .eq('driver_id', driver_id)
      .eq('driver_status', 'JOB_DONE');

    if (error) throw new BadRequestException(error.message);
    if (!bookings || bookings.length === 0) {
      throw new NotFoundException('No valid bookings found');
    }

    const invoice_subtotal = bookings.reduce(
      (sum, b: any) => sum + Number(b.driver_total ?? 0),
      0,
    );

    const invoice_gst = (driver as any).is_gst_registered
      ? parseFloat((invoice_subtotal * GST_RATE).toFixed(2))
      : 0;

    const invoice_total = parseFloat((invoice_subtotal + invoice_gst).toFixed(2));

    const dates = bookings.map((b: any) => new Date(b.pickup_datetime));
    const invoice_period_from = new Date(
      Math.min(...dates.map((d) => d.getTime())),
    )
      .toISOString()
      .slice(0, 10);
    const invoice_period_to = new Date(
      Math.max(...dates.map((d) => d.getTime())),
    )
      .toISOString()
      .slice(0, 10);

    const { data: numberData, error: numberError } = await supabaseAdmin.rpc(
      'generate_invoice_number',
      {
        p_driver_id: driver_id,
        p_prefix: (driver as any).invoice_prefix ?? 'INV',
      },
    );
    if (numberError) throw new BadRequestException(numberError.message);

    const invoice_number = numberData as string;

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('driver_invoices')
      .insert({
        driver_id,
        tenant_id,
        invoice_number,
        invoice_status: 'DRAFT',
        invoice_period_from,
        invoice_period_to,
        invoice_subtotal: parseFloat(invoice_subtotal.toFixed(2)),
        invoice_gst,
        invoice_total,
        currency: (bookings[0] as any).currency ?? 'AUD',
      })
      .select()
      .single();

    if (invoiceError) {
      throw new BadRequestException(invoiceError.message);
    }

    const items = bookings.map((b: any) => ({
      invoice_id: (invoice as any).id,
      booking_id: b.id,
      description: `${b.booking_number} - ${b.pickup_address} → ${b.dropoff_address ?? 'Charter'}`,
      driver_fare: b.driver_fare ?? 0,
      driver_toll: b.driver_toll ?? 0,
      driver_extras: b.driver_extras ?? 0,
      driver_subtotal: b.driver_total ?? 0,
      service_date: new Date(b.pickup_datetime).toISOString().slice(0, 10),
    }));

    await supabaseAdmin.from('driver_invoice_items').insert(items);

    return {
      invoice,
      driver: {
        name: `${(driver as any).profiles?.first_name ?? ''} ${(driver as any).profiles?.last_name ?? ''}`.trim(),
        abn: (driver as any).abn,
        abn_name: (driver as any).abn_name,
        is_gst_registered: (driver as any).is_gst_registered,
        bank_bsb: (driver as any).bank_bsb,
        bank_account: (driver as any).bank_account,
        bank_name: (driver as any).bank_name,
      },
      items,
    };
  }

  // =====================
  // 获取司机Invoice列表
  // =====================
  async getDriverInvoices(driver_id: string) {
    const { data, error } = await supabaseAdmin
      .from('driver_invoices')
      .select(`
        *,
        driver_invoice_items(
          id,
          booking_id,
          description,
          driver_fare,
          driver_toll,
          driver_extras,
          driver_subtotal,
          service_date
        ),
        tenants(name)
      `)
      .eq('driver_id', driver_id)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // =====================
  // 获取租户收到的Invoice列表
  // =====================
  async getTenantInvoices(
    tenant_id: string,
    _filters: {
      invoice_status?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('id, booking_number, pickup_datetime, total_price, currency, booking_status')
      .eq('tenant_id', tenant_id)
      .eq('booking_status', 'FULFILLED')
      .order('pickup_datetime', { ascending: false });

    if (error) throw new BadRequestException(error.message);

    const byMonth = new Map<string, any>();
    for (const booking of data ?? []) {
      const d = new Date(booking.pickup_datetime as string);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth.has(key)) {
        byMonth.set(key, {
          month: key,
          invoice_status: 'READY',
          booking_count: 0,
          total_amount: 0,
          currency: booking.currency ?? 'AUD',
          bookings: [],
        });
      }
      const bucket = byMonth.get(key);
      bucket.booking_count += 1;
      bucket.total_amount = Number(bucket.total_amount) + Number(booking.total_price ?? 0);
      bucket.bookings.push(booking);
    }

    const invoices = Array.from(byMonth.values()).map((i) => ({
      ...i,
      total_amount: Number(i.total_amount.toFixed(2)),
    }));

    return {
      data: invoices,
      total: invoices.length,
      page: 1,
      limit: invoices.length,
    };
  }

  // =====================
  // 获取单张Invoice详情
  // =====================
  async getInvoice(invoice_id: string, driver_id?: string) {
    let query = supabaseAdmin
      .from('driver_invoices')
      .select(`
        *,
        driver_invoice_items(
          id,
          booking_id,
          description,
          driver_fare,
          driver_toll,
          driver_extras,
          driver_subtotal,
          service_date
        ),
        drivers(
          abn,
          abn_name,
          is_gst_registered,
          invoice_prefix,
          bank_bsb,
          bank_account,
          bank_name,
          profiles(first_name, last_name, phone, email)
        ),
        tenants(name)
      `)
      .eq('id', invoice_id);

    if (driver_id) {
      query = query.eq('driver_id', driver_id);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      throw new NotFoundException('Invoice not found');
    }

    return data;
  }

  // =====================
  // 租户标记Invoice已付款
  // =====================
  async markInvoicePaid(invoice_id: string, tenant_id: string, paid_by: string) {
    const { data, error } = await supabaseAdmin
      .from('driver_invoices')
      .update({
        invoice_status: 'PAID',
        paid_at: new Date().toISOString(),
        paid_by,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice_id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('Invoice not found');
    }

    return data;
  }

  // =====================
  // 司机提交Invoice（DRAFT→SENT）
  // =====================
  async submitInvoice(invoice_id: string, driver_id: string) {
    const { data, error } = await supabaseAdmin
      .from('driver_invoices')
      .update({
        invoice_status: 'SENT',
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice_id)
      .eq('driver_id', driver_id)
      .eq('invoice_status', 'DRAFT')
      .select()
      .single();

    if (error || !data) {
      throw new NotFoundException('Invoice not found or already submitted');
    }

    return data;
  }

  // =====================
  // 删除草稿Invoice
  // =====================
  async deleteInvoice(invoice_id: string, driver_id: string) {
    const { data: invoice } = await supabaseAdmin
      .from('driver_invoices')
      .select('invoice_status')
      .eq('id', invoice_id)
      .eq('driver_id', driver_id)
      .single();

    if (!invoice) throw new NotFoundException('Invoice not found');

    if ((invoice as any).invoice_status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT invoices can be deleted');
    }

    await supabaseAdmin.from('driver_invoice_items').delete().eq('invoice_id', invoice_id);
    await supabaseAdmin.from('driver_invoices').delete().eq('id', invoice_id);

    return { message: 'Invoice deleted' };
  }
}
