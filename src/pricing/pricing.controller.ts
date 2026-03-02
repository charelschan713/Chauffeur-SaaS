import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { PricingResolver } from './pricing.resolver';
import { PricingService } from './pricing.service';

@Controller('pricing')
@UseGuards(JwtGuard)
export class PricingController {
  constructor(
    private readonly pricingResolver: PricingResolver,
    private readonly pricingService: PricingService,
  ) {}

  @Post('estimate')
  async estimate(@Body() body: any, @Req() req: any) {
    return this.pricingResolver.resolve({
      tenantId: req.user.tenant_id,
      serviceClassId: body.serviceClassId,
      distanceKm: body.distanceKm ?? 0,
      durationMinutes: body.durationMinutes ?? 0,
      pickupZoneName: body.pickupZoneName,
      dropoffZoneName: body.dropoffZoneName,
      waypointsCount: body.waypointsCount ?? 0,
      babyseatCount: body.babyseatCount ?? 0,
      requestedAtUtc: new Date(),
      currency: body.currency ?? 'AUD',
    });
  }

  @Get('service-classes')
  async listServiceClasses(@Req() req: any) {
    return this.pricingService.listServiceClasses(req.user.tenant_id);
  }

  @Post('service-classes')
  async createServiceClass(@Body() body: any, @Req() req: any) {
    return this.pricingService.createServiceClass(req.user.tenant_id, body);
  }

  @Get('service-classes/:id')
  async getServiceClass(@Param('id') id: string, @Req() req: any) {
    return this.pricingService.getServiceClass(req.user.tenant_id, id);
  }

  @Patch('service-classes/:id')
  async updateServiceClass(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.pricingService.updateServiceClass(req.user.tenant_id, id, body);
  }

  @Delete('service-classes/:id')
  async deactivateServiceClass(@Param('id') id: string, @Req() req: any) {
    return this.pricingService.deactivateServiceClass(req.user.tenant_id, id);
  }

  @Get('items')
  async listItems(@Query('serviceClassId') serviceClassId: string, @Req() req: any) {
    return this.pricingService.listItems(req.user.tenant_id, serviceClassId);
  }

  @Post('items')
  async createItem(@Body() body: any, @Req() req: any) {
    return this.pricingService.createItem(req.user.tenant_id, body);
  }

  @Patch('items/:id')
  async updateItem(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.pricingService.updateItem(req.user.tenant_id, id, body);
  }

  @Delete('items/:id')
  async deactivateItem(@Param('id') id: string, @Req() req: any) {
    return this.pricingService.deactivateItem(req.user.tenant_id, id);
  }

  @Get('zones')
  async listZones(@Req() req: any) {
    return this.pricingService.listZones(req.user.tenant_id);
  }

  @Post('zones')
  async createZone(@Body() body: any, @Req() req: any) {
    return this.pricingService.createZone(req.user.tenant_id, body);
  }

  @Patch('zones/:id')
  async updateZone(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.pricingService.updateZone(req.user.tenant_id, id, body);
  }

  @Delete('zones/:id')
  async deactivateZone(@Param('id') id: string, @Req() req: any) {
    return this.pricingService.deactivateZone(req.user.tenant_id, id);
  }
}
