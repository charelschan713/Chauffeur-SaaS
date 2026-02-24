import { Injectable } from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';

@Injectable()
export class BookingTransferService {
  async canAcceptTransfer(
    booking_id: string,
    target_tenant_id: string,
  ): Promise<{
    can_accept: boolean;
    reason?: string;
    matching_vehicles?: any[];
  }> {
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select(`
        vehicle_type_id,
        vehicle_type:tenant_vehicle_types(
          requirements:vehicle_type_requirements(
            platform_vehicle_id
          )
        )
      `)
      .eq('id', booking_id)
      .limit(1)
      .then((res) => ({ data: res.data?.[0] }));

    if (!booking) {
      return { can_accept: false, reason: 'Booking not found' };
    }

    const required_platform_ids =
      booking.vehicle_type?.requirements?.map((r: any) => r.platform_vehicle_id) ?? [];

    if (required_platform_ids.length === 0) {
      return { can_accept: true };
    }

    const { data: matching_vehicles } = await supabaseAdmin
      .from('tenant_vehicles')
      .select('*')
      .eq('tenant_id', target_tenant_id)
      .eq('is_active', true)
      .in('platform_vehicle_id', required_platform_ids);

    if (!matching_vehicles?.length) {
      return {
        can_accept: false,
        reason: 'No matching vehicles in fleet',
      };
    }

    return { can_accept: true, matching_vehicles };
  }
}
