import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtGuard } from '../common/guards/jwt.guard';
import { PricingResolver } from './pricing.resolver';
import { PricingService } from './pricing.service';

@Controller('pricing')
@UseGuards(JwtGuard)
export class PricingController {
  constructor(
    private readonly pricingResolver: PricingResolver,
    private readonly pricingService: PricingService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  @Post('estimate')
  async estimate(@Body() body: any, @Req() req: any) {
    const tenantId = req.user.tenant_id;

    // Resolve toll_enabled from service type if serviceTypeId provided
    let tollEnabled = body.tollEnabled ?? body.toll_enabled ?? false;
    if (!tollEnabled && body.serviceTypeId) {
      const stRows = await this.dataSource.query(
        `SELECT toll_enabled FROM public.tenant_service_types WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
        [body.serviceTypeId, tenantId],
      );
      tollEnabled = stRows[0]?.toll_enabled ?? false;
    }

    return this.pricingResolver.resolve({
      tenantId,
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
      returnWaypointsCount: body.returnWaypointsCount ?? 0,
      babyseatCount: body.babyseatCount ?? body.infant_seats ?? 0,
      infantSeats:  body.infant_seats  ?? body.babyseatCount ?? 0,
      toddlerSeats: body.toddler_seats ?? 0,
      boosterSeats: body.booster_seats ?? 0,
      pickupAddress:  body.pickupAddress  ?? null,
      dropoffAddress: body.dropoffAddress ?? null,
      tollEnabled,
      requestedAtUtc: new Date(),
      currency: body.currency ?? 'AUD',
      customerId: body.customerId ?? null,
    });
  }

  @Get('car-types')
  async listCarTypes(@Req() req: any) {
    try {
      return await this.pricingService.listServiceClasses(req.user.tenant_id);
    } catch (e: any) {
      throw new (await import('@nestjs/common').then(m => m.InternalServerErrorException))(e?.message ?? 'Failed to list car types');
    }
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

  @Delete('car-types/:id/hard')
  async hardDeleteCarType(@Param('id') id: string, @Req() req: any) {
    return this.pricingService.hardDeleteServiceClass(req.user.tenant_id, id);
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
