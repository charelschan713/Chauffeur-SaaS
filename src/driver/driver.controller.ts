import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtGuard } from '../common/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DriverService } from './driver.service';
import { TenantRoleGuard, TenantRoles } from '../common/guards/tenant-role.guard';
import * as bcrypt from 'bcrypt';

class UpdateDriverStatusDto {
  availability_status!: string;
}

@UseGuards(JwtGuard)
@Controller('drivers')
export class DriverController {
  constructor(
    private readonly drivers: DriverService,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  @Get()
  async listDrivers(
    @CurrentUser('tenant_id') tenantId: string,
    @Query('search') search?: string,
    @Query('availability_status') availabilityStatus?: string,
  ) {
    return this.drivers.listDrivers(tenantId, {
      search,
      availabilityStatus,
    });
  }

  @Get('available')
  async listAvailable(@CurrentUser('tenant_id') tenantId: string) {
    return this.drivers.listDrivers(tenantId, {
      availabilityStatus: 'AVAILABLE',
    });
  }

  @Post()
  async createDriver(
    @CurrentUser('tenant_id') tenantId: string,
    @Body() body: any,
  ) {
    return this.drivers.createDriver(tenantId, body);
  }

  @Patch(':id')
  async updateDriver(
    @CurrentUser('tenant_id') tenantId: string,
    @Param('id') driverId: string,
    @Body() body: any,
  ) {
    return this.drivers.updateDriver(tenantId, driverId, body);
  }

  @Patch(':id/deactivate')
  async deactivate(
    @CurrentUser('tenant_id') tenantId: string,
    @Param('id') driverId: string,
  ) {
    return this.drivers.setMembershipStatus(tenantId, driverId, 'inactive');
  }

  @Patch(':id/suspend')
  async suspend(
    @CurrentUser('tenant_id') tenantId: string,
    @Param('id') driverId: string,
  ) {
    return this.drivers.setMembershipStatus(tenantId, driverId, 'suspended');
  }

  @Post(':id/reset-password')
  @UseGuards(TenantRoleGuard)
  @TenantRoles('tenant_admin')
  async resetDriverPassword(
    @CurrentUser('tenant_id') tenantId: string,
    @CurrentUser('sub') actorId: string,
    @Param('id') driverId: string,
    @Body() body: { newPassword: string },
  ) {
    if (!body.newPassword || body.newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const rows = await this.db.query(
      `SELECT u.id, u.is_platform_admin, m.role
       FROM public.users u
       JOIN public.memberships m ON m.user_id = u.id
       WHERE u.id = $1 AND m.tenant_id = $2
       LIMIT 1`,
      [driverId, tenantId],
    );
    const user = rows[0];
    if (!user) throw new BadRequestException('User not found');
    if (user.is_platform_admin) throw new ForbiddenException('Unsupported user type');
    if (user.role !== 'driver') throw new ForbiddenException('Unsupported user type');

    const hash = await bcrypt.hash(body.newPassword, 12);
    await this.db.query(
      `UPDATE public.users SET password_hash = $1, updated_at = now() WHERE id = $2`,
      [hash, driverId],
    );

    await this.db.query(
      `INSERT INTO public.admin_password_reset_logs
         (tenant_id, actor_user_id, target_user_id, target_user_type, action_type, reset_mode, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [tenantId, actorId, driverId, 'driver', 'password_reset', 'manual', JSON.stringify({})],
    ).catch(() => {});

    return { success: true };
  }

  /** Release (unbind) a driver from this tenant */
  @Patch(':id/release')
  async release(
    @CurrentUser('tenant_id') tenantId: string,
    @Param('id') driverId: string,
    @Body('reason') reason?: string,
  ) {
    return this.drivers.releaseDriver(tenantId, driverId, reason);
  }

  @Patch(':id/reactivate')
  async reactivate(
    @CurrentUser('tenant_id') tenantId: string,
    @Param('id') driverId: string,
  ) {
    return this.drivers.setMembershipStatus(tenantId, driverId, 'active' as any);
  }

  @Patch(':id/status')
  async updateStatus(
    @CurrentUser('tenant_id') tenantId: string,
    @Param('id') driverId: string,
    @Body('availability_status') status: string,
  ) {
    if (!status) throw new BadRequestException('status is required');
    return this.drivers.updateStatus(tenantId, driverId, status);
  }

  // ── Driver Profile (extended) ────────────────────────────────────────────

  @Get(':id/profile')
  async getProfile(
    @CurrentUser('tenant_id') tenantId: string,
    @Param('id') driverId: string,
  ) {
    // driverId here is the membership driver_id (= user_id)
    const rows = await this.db.query(
      `SELECT
          u.id, u.email, u.full_name,
          -- split full_name into first/last for UI compatibility
          split_part(u.full_name, ' ', 1) AS first_name,
          substr(u.full_name, strpos(u.full_name, ' ') + 1) AS last_name,
          u.phone_country_code, u.phone_number,
          u.avatar_url, u.abn, u.notes,
          u.driver_license_number, u.driver_license_state,
          u.driver_license_expiry, u.driver_license_class,
          u.vehicle_hire_license_number, u.vehicle_hire_license_expiry,
          u.emergency_contact_name, u.emergency_contact_phone,
          u.emergency_contact_relationship,
          u.bank_name, u.bank_account_name, u.bank_bsb, u.bank_account_number,
          m.status AS membership_status, m.role,
          m.created_at AS joined_at
        FROM public.users u
        JOIN public.memberships m ON m.user_id = u.id
       WHERE u.id = $1 AND m.tenant_id = $2 AND m.role::text IN ('driver', 'DRIVER')`,
      [driverId, tenantId],
    );
    return rows[0] ?? null;
  }

  @Patch(':id/profile')
  async updateProfile(
    @CurrentUser('tenant_id') tenantId: string,
    @Param('id') driverId: string,
    @Body() body: any,
  ) {
    // Verify driver belongs to tenant
    const check = await this.db.query(
      `SELECT 1 FROM public.memberships WHERE user_id=$1 AND tenant_id=$2 AND role::text IN ('driver', 'DRIVER')`,
      [driverId, tenantId],
    );
    if (!check.length) throw new BadRequestException('Driver not found');

    await this.db.query(
      `UPDATE public.users SET
          first_name                   = COALESCE($1,  first_name),
          last_name                    = COALESCE($2,  last_name),
          phone_country_code           = COALESCE($3,  phone_country_code),
          phone_number                 = COALESCE($4,  phone_number),
          dob                          = COALESCE($5,  dob),
          address_line1                = COALESCE($6,  address_line1),
          address_line2                = COALESCE($7,  address_line2),
          city                         = COALESCE($8,  city),
          state                        = COALESCE($9,  state),
          postcode                     = COALESCE($10, postcode),
          avatar_url                   = COALESCE($11, avatar_url),
          abn                          = COALESCE($12, abn),
          driver_license_number        = COALESCE($13, driver_license_number),
          driver_license_state         = COALESCE($14, driver_license_state),
          driver_license_expiry        = COALESCE($15, driver_license_expiry),
          driver_license_class         = COALESCE($16, driver_license_class),
          vehicle_hire_license_number  = COALESCE($17, vehicle_hire_license_number),
          vehicle_hire_license_expiry  = COALESCE($18, vehicle_hire_license_expiry),
          emergency_contact_name       = COALESCE($19, emergency_contact_name),
          emergency_contact_phone      = COALESCE($20, emergency_contact_phone),
          emergency_contact_relationship = COALESCE($21, emergency_contact_relationship),
          bank_name                    = COALESCE($22, bank_name),
          bank_account_name            = COALESCE($23, bank_account_name),
          bank_bsb                     = COALESCE($24, bank_bsb),
          bank_account_number          = COALESCE($25, bank_account_number),
          notes                        = COALESCE($26, notes),
          updated_at                   = now()
       WHERE id = $27`,
      [
        body.first_name ?? null, body.last_name ?? null,
        body.phone_country_code ?? null, body.phone_number ?? null,
        body.dob || null,
        body.address_line1 ?? null, body.address_line2 ?? null,
        body.city ?? null, body.state ?? null, body.postcode ?? null,
        body.avatar_url ?? null, body.abn ?? null,
        body.driver_license_number ?? null, body.driver_license_state ?? null,
        body.driver_license_expiry || null, body.driver_license_class ?? null,
        body.vehicle_hire_license_number ?? null, body.vehicle_hire_license_expiry || null,
        body.emergency_contact_name ?? null, body.emergency_contact_phone ?? null,
        body.emergency_contact_relationship ?? null,
        body.bank_name ?? null, body.bank_account_name ?? null,
        body.bank_bsb ?? null, body.bank_account_number ?? null,
        body.notes ?? null,
        driverId,
      ],
    );
    return { success: true };
  }
}
