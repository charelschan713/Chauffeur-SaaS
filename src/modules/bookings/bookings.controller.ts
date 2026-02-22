import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingsService } from './bookings.service';

@Controller('bookings')
@UseGuards(JwtGuard, RolesGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // ── 乘客路由 ──

  @Post()
  @Roles('PASSENGER', 'CORPORATE_ADMIN')
  create(@Body() dto: CreateBookingDto, @Request() req: any) {
    return this.bookingsService.create(req.user.id, dto);
  }

  @Get('my')
  @Roles('PASSENGER', 'CORPORATE_ADMIN')
  findMy(@Request() req: any, @Query('status') status?: string) {
    return this.bookingsService.findByPassenger(req.user.id, status);
  }

  @Get('my/:booking_id')
  @Roles('PASSENGER', 'CORPORATE_ADMIN')
  findMyOne(@Param('booking_id') booking_id: string, @Request() req: any) {
    return this.bookingsService.findOneForPassenger(booking_id, req.user.id);
  }

  @Patch('my/:booking_id/cancel')
  @Roles('PASSENGER', 'CORPORATE_ADMIN')
  cancel(
    @Param('booking_id') booking_id: string,
    @Body() dto: CancelBookingDto,
    @Request() req: any,
  ) {
    return this.bookingsService.cancelByPassenger(booking_id, req.user.id, dto);
  }

  // ── 司机路由 ──

  @Get('driver')
  @Roles('DRIVER')
  findDriverBookings(@Request() req: any, @Query('status') status?: string) {
    return this.bookingsService.findByDriver(req.user.id, status);
  }

  @Patch('driver/:booking_id/start')
  @Roles('DRIVER')
  startTrip(@Param('booking_id') booking_id: string, @Request() req: any) {
    return this.bookingsService.startTrip(booking_id, req.user.id);
  }

  @Patch('driver/:booking_id/complete')
  @Roles('DRIVER')
  completeTrip(@Param('booking_id') booking_id: string, @Request() req: any) {
    return this.bookingsService.completeTrip(booking_id, req.user.id);
  }

  // ── 租户管理路由 ──

  @Get()
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  findAll(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('date') date?: string,
  ) {
    return this.bookingsService.findAllByTenant(
      req.user.profile.tenant_id,
      status,
      date,
    );
  }

  @Patch(':booking_id/assign')
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  assignDriver(
    @Param('booking_id') booking_id: string,
    @Body() dto: AssignDriverDto,
    @Request() req: any,
  ) {
    return this.bookingsService.assignDriver(
      booking_id,
      req.user.profile.tenant_id,
      dto,
    );
  }
}
