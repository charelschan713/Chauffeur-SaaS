import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PublicTenantService } from './public-tenant.service';
import { PublicMapsService } from './public-maps.service';
import { PublicPricingService } from './public-pricing.service';

@Controller('public')
export class PublicController {
  constructor(
    private readonly tenantSvc: PublicTenantService,
    private readonly mapsSvc: PublicMapsService,
    private readonly pricingSvc: PublicPricingService,
    private readonly jwtSvc: JwtService,
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

  /** Server-side route calculation (never exposes Google Maps API key) */
  @Get('maps/route')
  async route(
    @Query('tenant_slug') slug: string,
    @Query('origin') origin: string,
    @Query('destination') destination: string,
    @Query('pickup_at') pickupAt?: string,
    @Query('waypoints') waypoints?: string | string[],
  ) {
    // waypoints can be repeated query params: ?waypoints=A&waypoints=B
    const waypointList = Array.isArray(waypoints)
      ? waypoints
      : waypoints
      ? [waypoints]
      : [];
    return this.mapsSvc.getRoute(slug, origin, destination, pickupAt ?? null, waypointList);
  }

  @Get('cities')
  async cities(@Query('tenant_slug') slug: string) {
    return this.tenantSvc.getCities(slug);
  }

  @Get('maps/autocomplete')
  async autocomplete(
    @Query('tenant_slug') slug: string,
    @Query('input') input: string,
    @Query('sessiontoken') sessionToken: string,
    @Query('lat') lat: string,
    @Query('lng') lng: string,
  ) {
    return this.mapsSvc.autocomplete(
      slug, input, sessionToken,
      lat ? parseFloat(lat) : undefined,
      lng ? parseFloat(lng) : undefined,
    );
  }

  /** Quote all car types for given trip — returns quote_id for handoff */
  @Post('pricing/quote')
  async quote(@Query('tenant_slug') slug: string, @Body() body: any, @Req() req: any) {
    // Optionally extract customer ID from Bearer token (logged-in customers get loyalty discount)
    let customerId: string | null = null;
    try {
      const auth = req.headers?.authorization ?? '';
      if (auth.startsWith('Bearer ')) {
        const payload: any = this.jwtSvc.verify(auth.slice(7),
          { secret: process.env.JWT_ACCESS_SECRET });
        if (payload?.sub) customerId = payload.sub;
      }
    } catch { /* unauthenticated — skip */ }
    return this.pricingSvc.quote(slug, { ...body, customerId });
  }

  /** Retrieve a quote session by ID (for SaaS booking page handoff) */
  @Get('pricing/quote/:quoteId')
  async getQuote(@Param('quoteId') quoteId: string) {
    const session = await this.pricingSvc.getQuoteSession(quoteId);
    if (!session) {
      throw new NotFoundException('Quote session not found or expired');
    }
    return session;
  }

  /** Mark quote as converted (called after booking confirmed) */
  @Patch('pricing/quote/:quoteId')
  async convertQuote(@Param('quoteId') quoteId: string) {
    await this.pricingSvc.markConverted(quoteId);
    return { success: true };
  }

  /** Returns the first active auto-apply discount for the widget banner */
  @Get('discounts/auto')
  async getAutoDiscount(@Query('tenant_slug') tenantSlug: string) {
    return this.tenantSvc.getAutoDiscount(tenantSlug);
  }
}
