import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { GoogleMapsService } from './google-maps.service';

@Controller('maps')
@UseGuards(JwtGuard)
export class MapsController {
  constructor(private readonly mapsService: GoogleMapsService) {}

  @Get('route')
  async getRoute(
    @Query('origin') origin: string,
    @Query('destination') destination: string,
    @Req() req: any,
  ) {
    return this.mapsService.getRoute(req.user.tenant_id, origin, destination);
  }

  @Get('route/toll')
  async getRouteWithToll(
    @Query('origin') origin: string,
    @Query('destination') destination: string,
    @Query('currency') currency: string,
    @Req() req: any,
  ) {
    return this.mapsService.getRouteWithToll(
      req.user.tenant_id,
      origin,
      destination,
      currency ?? 'AUD',
    );
  }
}
