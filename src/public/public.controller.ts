import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PublicTenantService } from './public-tenant.service';
import { PublicMapsService } from './public-maps.service';
import { PublicPricingService } from './public-pricing.service';

@Controller('public')
export class PublicController {
  constructor(
    private readonly tenantSvc: PublicTenantService,
    private readonly mapsSvc: PublicMapsService,
    private readonly pricingSvc: PublicPricingService,
  ) {}

  /** Tenant branding + config */
  @Get('tenant-info')
  tenantInfo(@Query('tenant_slug') slug: string) {
    return this.tenantSvc.getTenantInfo(slug);
  }

  /** Service types for trip type selector */
  @Get('service-types')
  serviceTypes(@Query('tenant_slug') slug: string) {
    return this.tenantSvc.getServiceTypes(slug);
  }

  /** Car types (optional filter by service_type_id) */
  @Get('car-types')
  carTypes(
    @Query('tenant_slug') slug: string,
    @Query('service_type_id') serviceTypeId?: string,
  ) {
    return this.tenantSvc.getCarTypes(slug, serviceTypeId);
  }

  /** Server-side route calculation (never exposes API key) */
  @Get('maps/route')
  async route(
    @Query('tenant_slug') slug: string,
    @Query('origin') origin: string,
    @Query('destination') destination: string,
  ) {
    return this.mapsSvc.getRoute(slug, origin, destination);
  }

  /** Quote all car types for given trip */
  @Post('pricing/quote')
  async quote(
    @Query('tenant_slug') slug: string,
    @Body() body: any,
  ) {
    return this.pricingSvc.quote(slug, body);
  }
}
