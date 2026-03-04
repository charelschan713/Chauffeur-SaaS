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
      serviceTypeId: body.serviceTypeId ?? null,
      tripType: body.trip_type ?? body.tripType ?? 'ONE_WAY',
      distanceKm: body.distanceKm ?? 0,
      durationMinutes: body.durationMinutes ?? 0,
      returnDistanceKm: body.returnDistanceKm ?? null,
      returnDurationMinutes: body.returnDurationMinutes ?? null,
      bookedHours: body.bookedHours ?? null,
      pickupZoneName: body.pickupZoneName,
      dropoffZoneName: body.dropoffZoneName,
      waypointsCount: body.waypointsCount ?? 0,
      babyseatCount: body.babyseatCount ?? 0,
      requestedAtUtc: new Date(),
      currency: body.currency ?? 'AUD',
      customerId: body.customerId ?? null,
    });
  }

  @Get('car-types')
  async listCarTypes(@Req() req: any) {
    return this.pricingService.listServiceClasses(req.user.tenant_id);
  }

  @Post('car-types')
  async createCarType(@Body() body: any, @Req() req: any) {
    return this.pricingService.createServiceClass(req.user.tenant_id, body);
  }

  @Get('car-types/:id')
  async getCarType(@Param('id') id: string, @Req() req: any) {
    return this.pricingService.getServiceClass(req.user.tenant_id, id);
  }

  @Patch('car-types/:id')
  async updateCarType(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.pricingService.updateServiceClass(req.user.tenant_id, id, body);
  }

  @Delete('car-types/:id')
  async deleteCarType(@Param('id') id: string, @Req() req: any) {
    return this.pricingService.deactivateServiceClass(req.user.tenant_id, id);
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

  @Get('service-classes/:id/platform-vehicles')
  async listServiceClassPlatformVehicles(@Param('id') id: string, @Req() req: any) {
    return this.pricingService.listServiceClassPlatformVehicles(req.user.tenant_id, id);
  }

  @Post('service-classes/platform-vehicles')
  async linkServiceClassPlatformVehicles(@Body() body: any, @Req() req: any) {
    return this.pricingService.linkServiceClassPlatformVehicles(
      req.user.tenant_id,
      body.service_class_id,
      body.platform_vehicle_ids ?? [],
    );
  }

  @Delete('service-classes/:id/platform-vehicles/:pvId')
  async unlinkServiceClassPlatformVehicle(
    @Param('id') id: string,
    @Param('pvId') pvId: string,
    @Req() req: any,
  ) {
    return this.pricingService.unlinkServiceClassPlatformVehicle(req.user.tenant_id, id, pvId);
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
