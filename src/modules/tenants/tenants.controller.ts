import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreatePricingRuleDto } from './dto/create-pricing-rule.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantsService } from './tenants.service';

@Controller('tenants')
@UseGuards(JwtGuard, RolesGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  // SUPER_ADMIN: 所有租户列表
  @Get()
  @Roles('SUPER_ADMIN')
  findAll(@Query('status') status?: string) {
    return this.tenantsService.findAll(status);
  }

  // SUPER_ADMIN: 审核租户
  @Patch(':id/status')
  @Roles('SUPER_ADMIN')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: 'ACTIVE' | 'SUSPENDED',
  ) {
    return this.tenantsService.updateStatus(id, status);
  }

  // TENANT_ADMIN: 查看自己的租户
  @Get('me')
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  getMyTenant(@Request() req: any) {
    return this.tenantsService.findOne(req.user.profile.tenant_id);
  }

  // TENANT_ADMIN: 更新自己的租户信息
  @Patch('me')
  @Roles('TENANT_ADMIN')
  updateMyTenant(@Body() dto: UpdateTenantDto, @Request() req: any) {
    return this.tenantsService.update(
      req.user.profile.tenant_id,
      dto,
      req.user.profile.tenant_id,
    );
  }

  // TENANT_ADMIN: 仪表板统计
  @Get('me/dashboard')
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  getDashboard(@Request() req: any) {
    return this.tenantsService.getDashboard(req.user.profile.tenant_id);
  }

  // ── 定价规则 ──

  @Get('me/pricing')
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  getPricing(@Request() req: any) {
    return this.tenantsService.getPricingRules(req.user.profile.tenant_id);
  }

  @Post('me/pricing')
  @Roles('TENANT_ADMIN')
  createPricing(@Body() dto: CreatePricingRuleDto, @Request() req: any) {
    return this.tenantsService.createPricingRule(
      req.user.profile.tenant_id,
      dto,
    );
  }

  @Delete('me/pricing/:rule_id')
  @Roles('TENANT_ADMIN')
  deletePricing(@Param('rule_id') rule_id: string, @Request() req: any) {
    return this.tenantsService.deletePricingRule(
      rule_id,
      req.user.profile.tenant_id,
    );
  }

  // 公开：价格估算（乘客用）
  @Get(':tenant_id/estimate')
  estimatePrice(
    @Param('tenant_id') tenant_id: string,
    @Query('vehicle_class') vehicle_class: string,
    @Query('distance_km') distance_km: string,
    @Query('duration_minutes') duration_minutes: string,
  ) {
    return this.tenantsService.estimatePrice(
      tenant_id,
      vehicle_class,
      parseFloat(distance_km),
      parseFloat(duration_minutes),
    );
  }
}
