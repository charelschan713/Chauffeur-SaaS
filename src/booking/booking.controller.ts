import { Body, Controller, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { BookingService } from './booking.service';
import { JwtGuard } from '../common/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('bookings')
@UseGuards(JwtGuard)
export class BookingController {
  constructor(private readonly service: BookingService) {}

  @Post()
  createBooking(
    @CurrentUser('tenant_id') tenantId: string,
    @Body() dto: any,
  ) {
    return this.service.createBooking(tenantId, dto);
  }

  @Patch(':id/transition')
  transition(
    @Param('id') bookingId: string,
    @Body() dto: any,
    @CurrentUser('sub') userId: string,
  ) {
    return this.service.transition(
      bookingId,
      dto.newStatus,
      userId,
      dto.reason,
    );
  }
}
