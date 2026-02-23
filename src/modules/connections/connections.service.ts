import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';

@Injectable()
export class ConnectionsService {
  // =====================
  // Connection管理
  // =====================

  async requestConnection(
    requester_tenant_id: string,
    dto: {
      receiver_tenant_id: string;
      requester_note?: string;
    },
  ) {
    if (requester_tenant_id === dto.receiver_tenant_id) {
      throw new BadRequestException('Cannot connect to yourself');
    }

    const { data: receiver } = await supabaseAdmin
      .from('tenants')
      .select('id, tenant_name, tenant_status')
      .eq('id', dto.receiver_tenant_id)
      .single();

    if (!receiver) {
      throw new NotFoundException('Tenant not found');
    }

    if ((receiver as any).tenant_status !== 'ACTIVE') {
      throw new BadRequestException('Target tenant is not active');
    }

    const { data: existing } = await supabaseAdmin
      .from('tenant_connections')
      .select('id, connection_status')
      .or(
        `and(requester_id.eq.${requester_tenant_id},receiver_id.eq.${dto.receiver_tenant_id}),` +
          `and(requester_id.eq.${dto.receiver_tenant_id},receiver_id.eq.${requester_tenant_id})`,
      )
      .single();

    if (existing) {
      if ((existing as any).connection_status === 'ACTIVE') {
        throw new BadRequestException('Connection already exists');
      }
      if ((existing as any).connection_status === 'PENDING') {
        throw new BadRequestException('Connection request already pending');
      }
      const { data, error } = await supabaseAdmin
        .from('tenant_connections')
        .update({
          connection_status: 'PENDING',
          requester_id: requester_tenant_id,
          receiver_id: dto.receiver_tenant_id,
          requester_note: dto.requester_note ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', (existing as any).id)
        .select()
        .single();

      if (error) throw new BadRequestException(error.message);
      return data;
    }

    const { data, error } = await supabaseAdmin
      .from('tenant_connections')
      .insert({
        requester_id: requester_tenant_id,
        receiver_id: dto.receiver_tenant_id,
        connection_status: 'PENDING',
        requester_note: dto.requester_note ?? null,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async acceptConnection(connection_id: string, receiver_tenant_id: string) {
    const { data: connection } = await supabaseAdmin
      .from('tenant_connections')
      .select('*')
      .eq('id', connection_id)
      .eq('receiver_id', receiver_tenant_id)
      .single();

    if (!connection) {
      throw new NotFoundException('Connection not found');
    }

    if ((connection as any).connection_status !== 'PENDING') {
      throw new BadRequestException('Connection is not in PENDING status');
    }

    const { data, error } = await supabaseAdmin
      .from('tenant_connections')
      .update({
        connection_status: 'ACTIVE',
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async rejectConnection(connection_id: string, receiver_tenant_id: string) {
    const { data: connection } = await supabaseAdmin
      .from('tenant_connections')
      .select('*')
      .eq('id', connection_id)
      .eq('receiver_id', receiver_tenant_id)
      .single();

    if (!connection) {
      throw new NotFoundException('Connection not found');
    }

    const { data, error } = await supabaseAdmin
      .from('tenant_connections')
      .update({
        connection_status: 'TERMINATED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async terminateConnection(connection_id: string, tenant_id: string) {
    const { data: connection } = await supabaseAdmin
      .from('tenant_connections')
      .select('*')
      .eq('id', connection_id)
      .or(`requester_id.eq.${tenant_id},receiver_id.eq.${tenant_id}`)
      .single();

    if (!connection) {
      throw new NotFoundException('Connection not found');
    }

    const { data, error } = await supabaseAdmin
      .from('tenant_connections')
      .update({
        connection_status: 'TERMINATED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async getConnections(tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('tenant_connections')
      .select(
        `
        *,
        requester:tenants!tenant_connections_requester_id_fkey(
          id, tenant_name, tenant_slug
        ),
        receiver:tenants!tenant_connections_receiver_id_fkey(
          id, tenant_name, tenant_slug
        )
      `,
      )
      .or(`requester_id.eq.${tenant_id},receiver_id.eq.${tenant_id}`)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);

    return (data ?? []).map((c: any) => ({
      ...c,
      partner: c.requester_id === tenant_id ? c.receiver : c.requester,
      is_requester: c.requester_id === tenant_id,
    }));
  }

  async getActiveConnections(tenant_id: string) {
    const connections = await this.getConnections(tenant_id);
    return connections.filter((c: any) => c.connection_status === 'ACTIVE');
  }

  async searchTenants(tenant_id: string, keyword: string) {
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('id, tenant_name, tenant_slug')
      .eq('tenant_status', 'ACTIVE')
      .neq('id', tenant_id)
      .ilike('tenant_name', `%${keyword}%`)
      .limit(10);

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  // =====================
  // Transfer管理
  // =====================

  async createTransfer(
    booking_id: string,
    from_tenant_id: string,
    created_by: string,
    dto: {
      to_tenant_id: string;
      from_percentage: number;
      to_percentage: number;
      transfer_note?: string;
    },
  ) {
    if (dto.from_percentage + dto.to_percentage !== 100) {
      throw new BadRequestException(
        'from_percentage + to_percentage must equal 100',
      );
    }

    const { data: connection } = await supabaseAdmin
      .from('tenant_connections')
      .select('id, connection_status')
      .or(
        `and(requester_id.eq.${from_tenant_id},receiver_id.eq.${dto.to_tenant_id}),` +
          `and(requester_id.eq.${dto.to_tenant_id},receiver_id.eq.${from_tenant_id})`,
      )
      .eq('connection_status', 'ACTIVE')
      .single();

    if (!connection) {
      throw new ForbiddenException('No active connection with this tenant');
    }

    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .eq('tenant_id', from_tenant_id)
      .single();

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if ((booking as any).is_transferred) {
      throw new BadRequestException('Booking has already been transferred');
    }

    if (!['PENDING', 'CONFIRMED'].includes((booking as any).booking_status)) {
      throw new BadRequestException(
        'Only PENDING or CONFIRMED bookings can be transferred',
      );
    }

    const { data: transfer, error } = await supabaseAdmin
      .from('booking_transfers')
      .insert({
        booking_id,
        from_tenant_id,
        to_tenant_id: dto.to_tenant_id,
        transfer_status: 'PENDING',
        from_percentage: dto.from_percentage,
        to_percentage: dto.to_percentage,
        transfer_note: dto.transfer_note ?? null,
        created_by,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    await supabaseAdmin
      .from('bookings')
      .update({
        is_transferred: true,
        original_tenant_id: from_tenant_id,
        transfer_id: (transfer as any).id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking_id);

    return transfer;
  }

  async acceptTransfer(
    transfer_id: string,
    to_tenant_id: string,
    responded_by: string,
  ) {
    const { data: transfer } = await supabaseAdmin
      .from('booking_transfers')
      .select('*')
      .eq('id', transfer_id)
      .eq('to_tenant_id', to_tenant_id)
      .eq('transfer_status', 'PENDING')
      .single();

    if (!transfer) {
      throw new NotFoundException('Transfer not found or already responded');
    }

    const { data, error } = await supabaseAdmin
      .from('booking_transfers')
      .update({
        transfer_status: 'ACCEPTED',
        responded_at: new Date().toISOString(),
        responded_by,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transfer_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    await supabaseAdmin
      .from('bookings')
      .update({
        tenant_id: to_tenant_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', (transfer as any).booking_id);

    return data;
  }

  async rejectTransfer(
    transfer_id: string,
    to_tenant_id: string,
    responded_by: string,
  ) {
    const { data: transfer } = await supabaseAdmin
      .from('booking_transfers')
      .select('*')
      .eq('id', transfer_id)
      .eq('to_tenant_id', to_tenant_id)
      .eq('transfer_status', 'PENDING')
      .single();

    if (!transfer) {
      throw new NotFoundException('Transfer not found or already responded');
    }

    const { data, error } = await supabaseAdmin
      .from('booking_transfers')
      .update({
        transfer_status: 'REJECTED',
        responded_at: new Date().toISOString(),
        responded_by,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transfer_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    await supabaseAdmin
      .from('bookings')
      .update({
        tenant_id: (transfer as any).from_tenant_id,
        is_transferred: false,
        original_tenant_id: null,
        transfer_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', (transfer as any).booking_id);

    return data;
  }

  async getTransfers(
    tenant_id: string,
    type: 'sent' | 'received' | 'all' = 'all',
  ) {
    let query = supabaseAdmin
      .from('booking_transfers')
      .select(
        `
        *,
        bookings(
          booking_number,
          pickup_datetime,
          pickup_address,
          dropoff_address,
          vehicle_class,
          total_price,
          currency,
          booking_status,
          tenant_service_cities(city_name, timezone)
        ),
        from_tenant:tenants!booking_transfers_from_tenant_id_fkey(
          tenant_name
        ),
        to_tenant:tenants!booking_transfers_to_tenant_id_fkey(
          tenant_name
        )
      `,
      )
      .order('created_at', { ascending: false });

    if (type === 'sent') {
      query = query.eq('from_tenant_id', tenant_id);
    } else if (type === 'received') {
      query = query.eq('to_tenant_id', tenant_id);
    } else {
      query = query.or(
        `from_tenant_id.eq.${tenant_id},to_tenant_id.eq.${tenant_id}`,
      );
    }

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  async calculateRevenueSplit(booking_id: string, tenant_id: string) {
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('*, booking_transfers(*)')
      .eq('id', booking_id)
      .single();

    if (!booking) throw new NotFoundException('Booking not found');

    const transfer = (booking as any).booking_transfers?.[0];
    if (!transfer) {
      return {
        is_transferred: false,
        total_price: (booking as any).total_price,
        your_share: (booking as any).total_price,
      };
    }

    const is_from_tenant = transfer.from_tenant_id === tenant_id;
    const percentage = is_from_tenant
      ? transfer.from_percentage
      : transfer.to_percentage;

    const your_share = parseFloat(
      (((booking as any).total_price * percentage) / 100).toFixed(2),
    );

    return {
      is_transferred: true,
      total_price: (booking as any).total_price,
      currency: (booking as any).currency,
      from_percentage: transfer.from_percentage,
      to_percentage: transfer.to_percentage,
      your_share,
      your_percentage: percentage,
    };
  }
}
