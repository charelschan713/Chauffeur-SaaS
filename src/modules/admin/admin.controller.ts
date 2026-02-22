import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminService } from './admin.service';
import { CreateSuperAdminDto } from './dto/create-super-admin.dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // 公开：初始化第一个SuperAdmin（上线后关闭）
  @Post('init')
  createSuperAdmin(@Body() dto: CreateSuperAdminDto) {
    return this.adminService.createSuperAdmin(dto);
  }

  // 健康检查（公开）
  @Get('health')
  health() {
    return this.adminService.healthCheck();
  }

  // 诊断Supabase配置（需要super_admin_secret）
  @Get('diag/supabase')
  diagSupabase(@Query('secret') secret: string) {
    return this.adminService.supabaseConfigDiag(secret);
  }

  // 以下全部需要 SUPER_ADMIN
  @Get('dashboard')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  getDashboard() {
    return this.adminService.getPlatformDashboard();
  }

  @Get('tenants')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  getTenants(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAllTenants(
      status,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get('tenants/:tenant_id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  getTenantDetail(@Param('tenant_id') tenant_id: string) {
    return this.adminService.getTenantDetail(tenant_id);
  }

  @Patch('tenants/:tenant_id/approve')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  approveTenant(@Param('tenant_id') tenant_id: string) {
    return this.adminService.approveTenant(tenant_id);
  }

  @Patch('tenants/:tenant_id/suspend')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  suspendTenant(
    @Param('tenant_id') tenant_id: string,
    @Body('reason') reason?: string,
  ) {
    return this.adminService.suspendTenant(tenant_id, reason);
  }

  @Get('users')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  getUsers(
    @Query('role') role?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAllUsers(
      role,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Patch('users/:user_id/toggle')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  toggleUser(
    @Param('user_id') user_id: string,
    @Body('is_active') is_active: boolean,
  ) {
    return this.adminService.toggleUserActive(user_id, is_active);
  }

  @Get('revenue')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  getRevenue(@Query('year') year?: string) {
    return this.adminService.getRevenueReport(
      year ? parseInt(year) : new Date().getFullYear(),
    );
  }
}
