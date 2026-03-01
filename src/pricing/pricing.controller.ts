import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { PricingResolver } from './pricing.resolver';

@Controller('pricing')
@UseGuards(JwtGuard)
export class PricingController {
  constructor(private readonly pricingResolver: PricingResolver) {}

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
}
