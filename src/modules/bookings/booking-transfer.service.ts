import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';
import { ComplianceService } from '../compliance/compliance.service';

@Injectable()
export class BookingTransferService {
  constructor(private readonly complianceService: ComplianceService) {}

  // 发起转单
  async initiateTransfer(
    booking_id: string,
    from_tenant_id: string,
    dto: {
      to_tenant_id: string;
      override_platform_vehicle_ids?: string[];
      transfer_note?: string;
    },
  ) {
    // 验证订单属于 from_tenant
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        vehicle_type:tenant_vehicle_types(
          requirements:vehicle_type_requirements(
            platform_vehicle_id
          )
        )
      `)
      .eq('id', booking_id)
      .eq('tenant_id', from_tenant_id)
      .limit(1)
      .then((res) => ({ data: res.data?.[0] }));

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // 决定车型要求：override 优先，否则用 vehicle type 默认
    const required_ids = dto.override_platform_vehicle_ids?.length
      ? dto.override_platform_vehicle_ids
      : booking.vehicle_type?.requirements?.map(
          (r: any) => r.platform_vehicle_id,
        ) ?? [];

    const check = await this.complianceService.checkComplianceForTransfer(
      dto.to_tenant_id,
    );
    if (!check.eligible) {
      throw new BadRequestException(
        `Target tenant not eligible: ${check.issues.join(', ')}`,
      );
    }

    // 检查目标租户是否有符合的车辆
    if (required_ids.length > 0) {
      const { data: matchingVehicles } = await supabaseAdmin
        .from('tenant_vehicles')
        .select('id')
        .eq('tenant_id', dto.to_tenant_id)
        .eq('is_active', true)
        .in('platform_vehicle_id', required_ids);

      if (!matchingVehicles?.length) {
        throw new BadRequestException(
          'Target tenant has no vehicles matching requirements',
        );
      }
    }

    // 创建转单记录
    const { data, error } = await supabaseAdmin
      .from('booking_transfers')
      .insert({
        booking_id,
        from_tenant_id,
        to_tenant_id: dto.to_tenant_id,
        override_platform_vehicle_ids:
          dto.override_platform_vehicle_ids ?? null,
        transfer_note: dto.transfer_note ?? null,
        status: 'PENDING',
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    // 更新 booking 状态
    await supabaseAdmin
      .from('bookings')
      .update({ booking_status: 'TRANSFER_PENDING' })
      .eq('id', booking_id);

    return data;
  }

  // 获取收到的转单请求
  async getIncomingTransfers(tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('booking_transfers')
      .select(`
        *,
        booking:bookings(
          *,
          vehicle_type:tenant_vehicle_types(type_name)
        ),
        from_tenant:tenants!booking_transfers_from_tenant_id_fkey(name, slug),
        assigned_vehicle:tenant_vehicles(
          make, model, registration_plate
        )
      `)
      .eq('to_tenant_id', tenant_id)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  // 获取发出的转单请求
  async getOutgoingTransfers(tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('booking_transfers')
      .select(`
        *,
        booking:bookings(
          booking_number,
          pickup_address,
          dropoff_address,
          pickup_datetime,
          estimated_fare
        ),
        to_tenant:tenants!booking_transfers_to_tenant_id_fkey(name, slug)
      `)
      .eq('from_tenant_id', tenant_id)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return data ?? [];
  }

  // 接受转单
  async acceptTransfer(
    transfer_id: string,
    tenant_id: string,
    dto: {
      assigned_vehicle_id: string;
      assigned_driver_id: string;
      response_note?: string;
    },
  ) {
    const { data: transfer } = await supabaseAdmin
      .from('booking_transfers')
      .select('*')
      .eq('id', transfer_id)
      .eq('to_tenant_id', tenant_id)
      .eq('status', 'PENDING')
      .limit(1)
      .then((res) => ({ data: res.data?.[0] }));

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    const check = await this.complianceService.checkComplianceForTransfer(
      tenant_id,
    );
    if (!check.eligible) {
      throw new BadRequestException(
        `Target tenant not eligible: ${check.issues.join(', ')}`,
      );
    }

    // 验证车辆符合要求
    const required_ids = transfer.override_platform_vehicle_ids?.length
      ? transfer.override_platform_vehicle_ids
      : await this.getDefaultRequirements(transfer.booking_id);

    if (required_ids.length > 0) {
      const { data: vehicle } = await supabaseAdmin
        .from('tenant_vehicles')
        .select('platform_vehicle_id')
        .eq('id', dto.assigned_vehicle_id)
        .eq('tenant_id', tenant_id)
        .limit(1)
        .then((res) => ({ data: res.data?.[0] }));

      if (
        !vehicle ||
        !required_ids.includes(vehicle.platform_vehicle_id)
      ) {
        throw new BadRequestException(
          'Selected vehicle does not meet requirements',
        );
      }
    }

    // 更新转单状态
    await supabaseAdmin
      .from('booking_transfers')
      .update({
        status: 'ACCEPTED',
        assigned_vehicle_id: dto.assigned_vehicle_id,
        assigned_driver_id: dto.assigned_driver_id,
        response_note: dto.response_note ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transfer_id);

    // 更新订单
    await supabaseAdmin
      .from('bookings')
      .update({
        booking_status: 'CONFIRMED',
        driver_id: dto.assigned_driver_id,
      })
      .eq('id', transfer.booking_id);

    return { message: 'Transfer accepted' };
  }

  // 拒绝转单
  async declineTransfer(
    transfer_id: string,
    tenant_id: string,
    response_note?: string,
  ) {
    const { error } = await supabaseAdmin
      .from('booking_transfers')
      .update({
        status: 'DECLINED',
        response_note: response_note ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transfer_id)
      .eq('to_tenant_id', tenant_id)
      .eq('status', 'PENDING');

    if (error) throw new BadRequestException(error.message);
    return { message: 'Transfer declined' };
  }

  // 获取目标租户符合要求的车辆
  async getMatchingVehicles(
    booking_id: string,
    target_tenant_id: string,
    override_ids?: string[],
  ) {
    const required_ids = override_ids?.length
      ? override_ids
      : await this.getDefaultRequirements(booking_id);

    if (!required_ids.length) {
      const { data } = await supabaseAdmin
        .from('tenant_vehicles')
        .select('*')
        .eq('tenant_id', target_tenant_id)
        .eq('is_active', true);
      return data ?? [];
    }

    const { data } = await supabaseAdmin
      .from('tenant_vehicles')
      .select('*, platform_vehicle:platform_vehicles(make, model)')
      .eq('tenant_id', target_tenant_id)
      .eq('is_active', true)
      .in('platform_vehicle_id', required_ids);

    return data ?? [];
  }

  // 获取可接单的租户列表
  async getEligibleTenants(
    booking_id: string,
    from_tenant_id: string,
    override_ids?: string[],
  ) {
    const required_ids = override_ids?.length
      ? override_ids
      : await this.getDefaultRequirements(booking_id);

    if (!required_ids.length) {
      const { data } = await supabaseAdmin
        .from('tenants')
        .select('id, name, slug')
        .eq('status', 'ACTIVE')
        .neq('id', from_tenant_id);
      return data ?? [];
    }

    // 找有符合车辆的租户
    const { data: vehicles } = await supabaseAdmin
      .from('tenant_vehicles')
      .select('tenant_id')
      .eq('is_active', true)
      .in('platform_vehicle_id', required_ids)
      .neq('tenant_id', from_tenant_id);

    const eligible_tenant_ids = [
      ...new Set(vehicles?.map((v: any) => v.tenant_id) ?? []),
    ];

    if (!eligible_tenant_ids.length) return [];

    const { data: tenants } = await supabaseAdmin
      .from('tenants')
      .select('id, name, slug')
      .in('id', eligible_tenant_ids)
      .eq('status', 'ACTIVE');

    return tenants ?? [];
  }

  private async getDefaultRequirements(
    booking_id: string,
  ): Promise<string[]> {
    const { data } = await supabaseAdmin
      .from('bookings')
      .select(`
        vehicle_type:tenant_vehicle_types(
          requirements:vehicle_type_requirements(
            platform_vehicle_id
          )
        )
      `)
      .eq('id', booking_id)
      .limit(1)
      .then((res) => ({ data: res.data?.[0] }));

    const requirements = (data?.vehicle_type as any)?.requirements ?? [];

    return requirements.map((r: any) => r.platform_vehicle_id) ?? [];
  }
}
