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
import { SaveApiKeysDto } from './dto/save-api-keys.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { ApiTokensService } from './api-tokens.service';
import { ServiceCitiesService } from './service-cities.service';
import { TenantKeysService } from './tenant-keys.service';
import { TenantsService } from './tenants.service';

@Controller('tenants')
@UseGuards(JwtGuard, RolesGuard)
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly tenantKeysService: TenantKeysService,
    private readonly apiTokensService: ApiTokensService,
    private readonly serviceCitiesService: ServiceCitiesService,
  ) {}

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

  // 更新集成配置（Stripe/Resend/Twilio）
  @Patch('me/integrations')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  updateIntegrations(
    @Body()
    dto: {
      resend_api_key?: string;
      resend_from_email?: string;
      twilio_account_sid?: string;
      twilio_auth_token?: string;
      twilio_from_number?: string;
      stripe_publishable_key?: string;
      stripe_secret_key?: string;
      stripe_webhook_secret?: string;
    },
    @Request() req: any,
  ) {
    return this.tenantsService.updateIntegrations(
      req.user.profile.tenant_id,
      dto,
    );
  }

  // TENANT_ADMIN: 仪表板统计
  @Get('me/dashboard')
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  getDashboard(@Request() req: any) {
    return this.tenantsService.getDashboard(req.user.profile.tenant_id);
  }

  // ── API Keys ──

  @Post('me/keys')
  @Roles('TENANT_ADMIN')
  saveKeys(@Body() dto: SaveApiKeysDto, @Request() req: any) {
    return this.tenantKeysService.saveKeys(
      req.user.profile.tenant_id,
      dto as Record<string, string>,
    );
  }

  @Get('me/keys/status')
  @Roles('TENANT_ADMIN')
  getKeysStatus(@Request() req: any) {
    return this.tenantKeysService.getKeysStatus(req.user.profile.tenant_id);
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

  // ── API Tokens ──

  @Post('me/tokens')
  @Roles('TENANT_ADMIN')
  createToken(@Body('name') name: string, @Request() req: any) {
    return this.apiTokensService.createToken(
      req.user.profile.tenant_id,
      name,
    );
  }

  @Get('me/tokens')
  @Roles('TENANT_ADMIN')
  listTokens(@Request() req: any) {
    return this.apiTokensService.listTokens(req.user.profile.tenant_id);
  }

  @Delete('me/tokens/:token_id')
  @Roles('TENANT_ADMIN')
  revokeToken(@Param('token_id') token_id: string, @Request() req: any) {
    return this.apiTokensService.revokeToken(
      token_id,
      req.user.profile.tenant_id,
    );
  }

  // 服务城市
  @Get('me/service-cities')
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  getServiceCities(@Request() req: any) {
    return this.serviceCitiesService.getServiceCities(req.user.profile.tenant_id);
  }

  @Post('me/service-cities')
  @Roles('TENANT_ADMIN')
  createServiceCity(@Body() dto: any, @Request() req: any) {
    return this.serviceCitiesService.createServiceCity(
      req.user.profile.tenant_id,
      dto,
    );
  }

  @Delete('me/service-cities/:city_id')
  @Roles('TENANT_ADMIN')
  deleteServiceCity(@Param('city_id') city_id: string, @Request() req: any) {
    return this.serviceCitiesService.deleteServiceCity(
      city_id,
      req.user.profile.tenant_id,
    );
  }

  @Get('timezones')
  getTimezones() {
    return this.serviceCitiesService.getValidTimezones();
  }

  // 公开：价格估算（乘客用）
  @Get(':tenant_id/estimate')
  estimatePrice(
    @Param('tenant_id') tenant_id: string,
    @Query('vehicle_type_id') vehicle_type_id: string,
    @Query('service_type') service_type: string,
    @Query('distance_km') distance_km?: string,
    @Query('duration_hours') duration_hours?: string,
    @Query('duration_minutes') duration_minutes?: string,
  ) {
    return this.tenantsService.estimatePrice(
      tenant_id,
      vehicle_type_id,
      service_type,
      distance_km ? parseFloat(distance_km) : undefined,
      duration_hours ? parseFloat(duration_hours) : undefined,
      duration_minutes ? parseFloat(duration_minutes) : undefined,
    );
  }
}
