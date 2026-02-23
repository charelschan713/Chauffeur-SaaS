import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Request, UseGuards
} from '@nestjs/common';
import { PricingService } from './pricing.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get('quote')
  getQuote(@Query() query: any, @Request() req: any) {
    return this.pricingService.getQuote(query.tenant_id, {
      service_city_id: query.service_city_id,
      service_type: query.service_type ?? 'POINT_TO_POINT',
      vehicle_type_id: query.vehicle_type_id,
      pickup_lat: parseFloat(query.pickup_lat),
      pickup_lng: parseFloat(query.pickup_lng),
      dropoff_lat: query.dropoff_lat ? parseFloat(query.dropoff_lat) : undefined,
      dropoff_lng: query.dropoff_lng ? parseFloat(query.dropoff_lng) : undefined,
      pickup_datetime: query.pickup_datetime,
      duration_hours: query.duration_hours
        ? parseFloat(query.duration_hours)
        : undefined,
      promo_code: query.promo_code,
    });
  }

  @Get('promo/:code/validate')
  validatePromo(
    @Param('code') code: string,
    @Query('tenant_id') tenant_id: string,
    @Query('fare') fare: string,
  ) {
    return this.pricingService.validatePromoCode(
      tenant_id, code, parseFloat(fare ?? '0')
    );
  }

  // =====================
  // 租户Admin路由
  // =====================
  @Get('rules')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  getPricingRules(@Request() req: any) {
    return this.pricingService.getPricingRules(req.user.profile.tenant_id);
  }

  @Post('rules')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  createPricingRule(@Body() dto: any, @Request() req: any) {
    return this.pricingService.createPricingRule(
      req.user.profile.tenant_id, dto
    );
  }

  @Patch('rules/:id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  updatePricingRule(
    @Param('id') id: string,
    @Body() dto: any,
    @Request() req: any,
  ) {
    return this.pricingService.updatePricingRule(
      id, req.user.profile.tenant_id, dto
    );
  }

  @Delete('rules/:id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  deletePricingRule(@Param('id') id: string, @Request() req: any) {
    return this.pricingService.deletePricingRule(
      id, req.user.profile.tenant_id
    );
  }

  // 取消政策
  @Get('cancellation-policies')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  getCancellationPolicies(@Request() req: any) {
    return this.pricingService.getCancellationPolicies(
      req.user.profile.tenant_id
    );
  }

  @Post('cancellation-policies')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  createCancellationPolicy(@Body() dto: any, @Request() req: any) {
    return this.pricingService.createCancellationPolicy(
      req.user.profile.tenant_id, dto
    );
  }

  @Patch('cancellation-policies/:id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  updateCancellationPolicy(
    @Param('id') id: string,
    @Body() dto: any,
    @Request() req: any,
  ) {
    return this.pricingService.updateCancellationPolicy(
      id, req.user.profile.tenant_id, dto
    );
  }

  @Delete('cancellation-policies/:id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  deleteCancellationPolicy(@Param('id') id: string, @Request() req: any) {
    return this.pricingService.deleteCancellationPolicy(
      id, req.user.profile.tenant_id
    );
  }

  // Promo Codes
  @Get('promo-codes')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  getPromoCodes(@Request() req: any) {
    return this.pricingService.getPromoCodes(req.user.profile.tenant_id);
  }

  @Post('promo-codes')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  createPromoCode(@Body() dto: any, @Request() req: any) {
    return this.pricingService.createPromoCode(
      req.user.profile.tenant_id, dto
    );
  }

  @Delete('promo-codes/:id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  deactivatePromoCode(@Param('id') id: string, @Request() req: any) {
    return this.pricingService.deactivatePromoCode(
      id, req.user.profile.tenant_id
    );
  }

  // 会员等级
  @Get('membership-tiers')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  getMembershipTiers(@Request() req: any) {
    return this.pricingService.getMembershipTiers(req.user.profile.tenant_id);
  }

  @Post('membership-tiers')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  createMembershipTier(@Body() dto: any, @Request() req: any) {
    return this.pricingService.createMembershipTier(
      req.user.profile.tenant_id, dto
    );
  }
}
