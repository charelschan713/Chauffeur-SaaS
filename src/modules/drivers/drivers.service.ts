import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';
import { CompleteDriverProfileDto } from './dto/complete-driver-profile.dto';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateDriverStatusDto } from './dto/update-driver-status.dto';

@Injectable()
export class DriversService {
  // 司机完善自己的资料（接受邀请后第一步）
  async completeProfile(
    user_id: string,
    tenant_id: string,
    dto: CompleteDriverProfileDto,
  ) {
    // 检查driver记录是否存在，不存在则创建
    const { data: existing } = await supabaseAdmin
      .from('drivers')
      .select('id')
      .eq('user_id', user_id)
      .single();

    if (existing) {
      // 更新
      const { data, error } = await supabaseAdmin
        .from('drivers')
        .update({
          license_number: dto.license_number,
          license_expiry: dto.license_expiry,
        })
        .eq('user_id', user_id)
        .select()
        .single();

      if (error) throw new BadRequestException(error.message);
      return data;
    } else {
      // 创建
      const { data, error } = await supabaseAdmin
        .from('drivers')
        .insert({
          user_id,
          tenant_id,
          license_number: dto.license_number,
          license_expiry: dto.license_expiry,
          status: 'PENDING',
        })
        .select()
        .single();

      if (error) throw new BadRequestException(error.message);

      // 更新profile phone
      if (dto.phone) {
        await supabaseAdmin.from('profiles').update({ phone: dto.phone }).eq('id', user_id);
      }

      return data;
    }
  }

  // 司机获取自己的资料
  async getMyProfile(user_id: string) {
    return this.getDriverByUserId(user_id);
  }

  async getDriverByUserId(user_id: string) {
    const { data, error } = await supabaseAdmin
      .from('drivers')
      .select('*, profiles(first_name, last_name, phone, avatar_url), vehicles(*)')
      .eq('user_id', user_id)
      .single();

    if (error || !data) throw new NotFoundException('Driver profile not found');
    return data;
  }

  async updateBanking(
    user_id: string,
    dto: {
      abn?: string;
      bank_bsb?: string;
      bank_account?: string;
      bank_name?: string;
      is_gst_registered?: boolean;
    },
  ) {
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (dto.abn !== undefined) updateData.abn = dto.abn;
    if (dto.bank_bsb !== undefined) updateData.bank_bsb = dto.bank_bsb;
    if (dto.bank_account !== undefined) updateData.bank_account = dto.bank_account;
    if (dto.bank_name !== undefined) updateData.bank_name = dto.bank_name;
    if (dto.is_gst_registered !== undefined) {
      updateData.is_gst_registered = dto.is_gst_registered;
    }

    const { data, error } = await supabaseAdmin
      .from('drivers')
      .update(updateData)
      .eq('user_id', user_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // 司机切换可接单状态
  async toggleAvailability(user_id: string, is_available: boolean) {
    const { data: driver } = await supabaseAdmin
      .from('drivers')
      .select('id, status')
      .eq('user_id', user_id)
      .single();

    if (!driver) throw new NotFoundException('Driver not found');
    if (driver.status !== 'ACTIVE') {
      throw new ForbiddenException('Only active drivers can change availability');
    }

    const { data, error } = await supabaseAdmin
      .from('drivers')
      .update({ is_available })
      .eq('user_id', user_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // TENANT_ADMIN：获取本租户所有司机
  async findAllByTenant(tenant_id: string, status?: string) {
    let query = supabaseAdmin
      .from('drivers')
      .select('*, profiles(first_name, last_name, phone, avatar_url), vehicles(*)')
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);

    const drivers = data ?? [];

    const { data: invitations } = await supabaseAdmin
      .from('driver_invitations')
      .select('id, email, phone, status, expires_at, created_at')
      .eq('tenant_id', tenant_id)
      .eq('status', 'PENDING');

    const pending = (invitations ?? []).filter(
      (inv: any) => new Date(inv.expires_at).getTime() > Date.now(),
    );

    const byEmail = new Map<string, any>();
    const byPhone = new Map<string, any>();
    for (const inv of pending) {
      if (inv.email) byEmail.set(String(inv.email).toLowerCase(), inv);
      if (inv.phone) byPhone.set(String(inv.phone), inv);
    }

    return drivers.map((driver: any) => {
      const email = String(driver.email ?? '').toLowerCase();
      const phone = String(driver.phone ?? '');
      const invitation = byEmail.get(email) ?? byPhone.get(phone) ?? null;

      const login_status = driver.user_id && driver.is_active
        ? 'LOGIN_READY'
        : invitation
          ? 'INVITED'
          : 'NO_LOGIN';

      return {
        ...driver,
        pending_invitation: invitation,
        login_status,
      };
    });
  }

  async create(tenant_id: string, dto: any) {
    const { data, error } = await supabaseAdmin
      .from('drivers')
      .insert({ tenant_id, ...dto })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async update(id: string, tenant_id: string, dto: any) {
    const { data, error } = await supabaseAdmin
      .from('drivers')
      .update(dto)
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async remove(id: string, tenant_id: string) {
    const { error } = await supabaseAdmin
      .from('drivers')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenant_id);

    if (error) throw new BadRequestException(error.message);
    return { success: true };
  }

  // TENANT_ADMIN：审核司机（PENDING → ACTIVE 或 SUSPENDED）
  async updateStatus(
    driver_id: string,
    tenant_id: string,
    dto: UpdateDriverStatusDto,
  ) {
    // 确认司机属于该租户
    const { data: driver } = await supabaseAdmin
      .from('drivers')
      .select('id')
      .eq('id', driver_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (!driver) throw new NotFoundException('Driver not found in your tenant');

    const { data, error } = await supabaseAdmin
      .from('drivers')
      .update({ status: dto.status })
      .eq('id', driver_id)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // TENANT_ADMIN：获取单个司机详情
  async findOne(driver_id: string, tenant_id: string) {
    const { data, error } = await supabaseAdmin
      .from('drivers')
      .select('*, profiles(first_name, last_name, phone, avatar_url), vehicles(*)')
      .eq('id', driver_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (error || !data) throw new NotFoundException('Driver not found');
    return data;
  }

  // ── 车辆管理 ──

  // 司机添加车辆
  async addVehicle(user_id: string, tenant_id: string, dto: CreateVehicleDto) {
    const { data: driver } = await supabaseAdmin
      .from('drivers')
      .select('id')
      .eq('user_id', user_id)
      .single();

    if (!driver) throw new NotFoundException('Complete your driver profile first');

    const { data, error } = await supabaseAdmin
      .from('vehicles')
      .insert({ ...dto, driver_id: driver.id, tenant_id })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // 司机获取自己的车辆列表
  async getMyVehicles(user_id: string) {
    const { data: driver } = await supabaseAdmin
      .from('drivers')
      .select('id')
      .eq('user_id', user_id)
      .single();

    if (!driver) throw new NotFoundException('Driver profile not found');

    const { data, error } = await supabaseAdmin
      .from('vehicles')
      .select('*')
      .eq('driver_id', driver.id)
      .eq('is_active', true);

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // 司机删除（停用）车辆
  async deactivateVehicle(vehicle_id: string, user_id: string) {
    const { data: driver } = await supabaseAdmin
      .from('drivers')
      .select('id')
      .eq('user_id', user_id)
      .single();

    if (!driver) throw new NotFoundException('Driver not found');

    const { error } = await supabaseAdmin
      .from('vehicles')
      .update({ is_active: false })
      .eq('id', vehicle_id)
      .eq('driver_id', driver.id);

    if (error) throw new BadRequestException(error.message);
    return { message: 'Vehicle deactivated' };
  }
}
