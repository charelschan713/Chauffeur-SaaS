import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BookingService } from './booking.service';
import { JwtGuard } from '../common/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('bookings')
@UseGuards(JwtGuard)
export class BookingController {
  constructor(private readonly service: BookingService) {}

  @Get()
  listBookings(
    @CurrentUser('tenant_id') tenantId: string,
    @Query() query: any,
  ) {
    return this.service.listBookings(tenantId, query);
  }

  @Get(':id')
  getBooking(
    @CurrentUser('tenant_id') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.getBookingDetail(tenantId, id);
  }

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

  @Patch(':id/cancel')
  cancel(
    @Param('id') bookingId: string,
    @CurrentUser('tenant_id') tenantId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.service.cancelBooking(tenantId, bookingId, userId);
  }
}
