import { Controller, Post, Body } from '@nestjs/common';
import { PublicBookingsService } from './public-bookings.service';

@Controller('public/bookings')
export class PublicBookingsController {
  constructor(private readonly service: PublicBookingsService) {}

  @Post()
  async createBooking(@Body() dto: any) {
    return this.service.createGuestBooking(dto);
  }

  @Post('setup-intent')
  async createSetupIntent(@Body() dto: any) {
    return this.service.createSetupIntent(dto);
  }

  @Post('charge')
  async chargeBooking(@Body() dto: any) {
    return this.service.chargeBooking(dto);
  }
}
