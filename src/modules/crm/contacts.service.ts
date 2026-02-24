import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';

@Injectable()
export class ContactsService {
  async findAll(tenant_id: string, query: any) {
    let q = supabaseAdmin
      .from('contacts')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false });

    if (query.search) {
      q = q.or(
        `first_name.ilike.%${query.search}%,` +
          `last_name.ilike.%${query.search}%,` +
          `phone.ilike.%${query.search}%,` +
          `email.ilike.%${query.search}%,` +
          `company_name.ilike.%${query.search}%`,
      );
    }

    if (query.customer_type) {
      q = q.eq('customer_type', query.customer_type);
    }

    if (query.payment_type) {
      q = q.eq('payment_type', query.payment_type);
    }

    const limit = parseInt(query.limit ?? '50', 10);
    q = q.limit(limit);

    const { data, error } = await q;
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async findById(id: string, tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .select(`
        *,
        bookings:bookings(
          id,
          booking_number,
          status,
          pickup_datetime,
          total_price,
          pickup_address,
          dropoff_address
        )
      `)
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single();

    if (error || !data) throw new NotFoundException('Contact not found');
    return data;
  }

  async create(tenant_id: string, dto: any) {
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .insert({ ...dto, tenant_id })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async update(id: string, tenant_id: string, dto: any) {
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (error) throw new NotFoundException('Contact not found');
    return data;
  }

  async remove(id: string, tenant_id: string) {
    const { error } = await supabaseAdmin
      .from('contacts')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenant_id);

    if (error) throw new NotFoundException('Contact not found');
    return { message: 'Contact deleted', id };
  }

  async updateStats(contact_id: string, amount: number) {
    const { data: contact } = await supabaseAdmin
      .from('contacts')
      .select('total_bookings, total_spent')
      .eq('id', contact_id)
      .single();

    if (!contact) return;

    await supabaseAdmin
      .from('contacts')
      .update({
        total_bookings: (contact.total_bookings ?? 0) + 1,
        total_spent: (contact.total_spent ?? 0) + amount,
        last_booking_at: new Date().toISOString(),
      })
      .eq('id', contact_id);
  }

  async getDiscount(contact_id: string, service_type: string): Promise<number> {
    const { data } = await supabaseAdmin
      .from('contacts')
      .select('discount_p2p, discount_charter, discount_airport')
      .eq('id', contact_id)
      .single();

    if (!data) return 0;

    if (service_type === 'POINT_TO_POINT') return data.discount_p2p ?? 0;
    if (service_type === 'HOURLY_CHARTER') return data.discount_charter ?? 0;
    if (service_type === 'AIRPORT_PICKUP' || service_type === 'AIRPORT_DROPOFF') {
      return data.discount_airport ?? 0;
    }

    return 0;
  }

  // 获取联系人的乘客列表
  async getPassengers(contact_id: string, tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('contact_passengers')
      .select(`
        id,
        is_default,
        relationship,
        passenger:passengers(
          id, first_name, last_name,
          phone, email,
          preferred_temperature,
          preferred_music,
          preferred_language,
          allergies,
          special_requirements,
          notes
        )
      `)
      .eq('contact_id', contact_id)
      .eq('tenant_id', tenant_id)
      .order('is_default', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  // 关联乘客到联系人
  async linkPassenger(
    contact_id: string,
    passenger_id: string,
    tenant_id: string,
    is_default: boolean = false,
    relationship?: string,
  ) {
    if (is_default) {
      await supabaseAdmin
        .from('contact_passengers')
        .update({ is_default: false })
        .eq('contact_id', contact_id)
        .eq('tenant_id', tenant_id);
    }

    const { data, error } = await supabaseAdmin
      .from('contact_passengers')
      .upsert({
        contact_id,
        passenger_id,
        tenant_id,
        is_default,
        relationship,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // 取消关联
  async unlinkPassenger(contact_id: string, passenger_id: string, tenant_id: string) {
    const { error } = await supabaseAdmin
      .from('contact_passengers')
      .delete()
      .eq('contact_id', contact_id)
      .eq('passenger_id', passenger_id)
      .eq('tenant_id', tenant_id);

    if (error) throw new BadRequestException(error.message);
    return { message: 'Unlinked successfully' };
  }
}

