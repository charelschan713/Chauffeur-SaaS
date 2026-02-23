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
import { BookingsService } from './bookings.service';

@Controller('bookings')
@UseGuards(JwtGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // =====================
  // 乘客路由
  // =====================
  @Post()
  @UseGuards(RolesGuard)
  @Roles('PASSENGER')
  createBooking(@Body() dto: any, @Request() req: any) {
    return this.bookingsService.createBooking(
      req.user.id,
      req.user.profile.tenant_id,
      dto,
    );
  }

  @Get('my')
  @UseGuards(RolesGuard)
  @Roles('PASSENGER')
  getMyBookings(@Request() req: any) {
    return this.bookingsService.getPassengerBookings(req.user.id);
  }

  @Get('my/:booking_id')
  @UseGuards(RolesGuard)
  @Roles('PASSENGER')
  getMyBooking(
    @Param('booking_id') booking_id: string,
    @Request() req: any,
  ) {
    return this.bookingsService.getBooking(
      booking_id,
      req.user.profile.tenant_id,
    );
  }

  @Patch('my/:booking_id/modify')
  @UseGuards(RolesGuard)
  @Roles('PASSENGER')
  modifyMyBooking(
    @Param('booking_id') booking_id: string,
    @Body() dto: any,
    @Request() req: any,
  ) {
    return this.bookingsService.modifyBooking(
      booking_id,
      req.user.profile.tenant_id,
      req.user.id,
      'PASSENGER',
      dto,
    );
  }

  @Patch('my/:booking_id/cancel')
  @UseGuards(RolesGuard)
  @Roles('PASSENGER')
  cancelMyBooking(
    @Param('booking_id') booking_id: string,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    return this.bookingsService.cancelBooking(
      booking_id,
      req.user.profile.tenant_id,
      req.user.id,
      'PASSENGER',
      reason,
    );
  }

  // =====================
  // 司机路由
  // =====================
  @Get('driver')
  @UseGuards(RolesGuard)
  @Roles('DRIVER')
  getDriverBookings(@Request() req: any, @Query() query: any) {
    return this.bookingsService.getDriverBookings(req.user.id, query);
  }

  @Get('driver/:id')
  @UseGuards(RolesGuard)
  @Roles('DRIVER')
  getDriverBookingById(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.bookingsService.getDriverBookingById(id, req.user.id);
  }

  @Patch('driver/:id/accept')
  @UseGuards(RolesGuard)
  @Roles('DRIVER')
  driverAccept(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.bookingsService.driverUpdateStatus(
      id,
      req.user.id,
      'ACCEPTED',
    );
  }

  @Patch('driver/:id/decline')
  @UseGuards(RolesGuard)
  @Roles('DRIVER')
  driverDecline(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.bookingsService.declineJob(id, req.user.id);
  }

  @Patch('driver/:id/on-the-way')
  @UseGuards(RolesGuard)
  @Roles('DRIVER')
  driverOnTheWay(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.bookingsService.driverUpdateStatus(
      id,
      req.user.id,
      'ON_THE_WAY',
    );
  }

  @Patch('driver/:id/arrived')
  @UseGuards(RolesGuard)
  @Roles('DRIVER')
  driverArrived(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.bookingsService.driverUpdateStatus(
      id,
      req.user.id,
      'ARRIVED',
    );
  }

  @Patch('driver/:id/passenger-on-board')
  @UseGuards(RolesGuard)
  @Roles('DRIVER')
  driverPassengerOnBoard(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.bookingsService.driverUpdateStatus(
      id,
      req.user.id,
      'PASSENGER_ON_BOARD',
    );
  }

  @Patch('driver/:booking_id/no-show')
  @UseGuards(RolesGuard)
  @Roles('DRIVER')
  noShow(
    @Param('booking_id') booking_id: string,
    @Request() req: any,
  ) {
    return this.bookingsService.markNoShow(booking_id, req.user.id);
  }

  @Patch('driver/:booking_id/job-done')
  @UseGuards(RolesGuard)
  @Roles('DRIVER')
  jobDone(
    @Param('booking_id') booking_id: string,
    @Body() dto: any,
    @Request() req: any,
  ) {
    return this.bookingsService.jobDone(booking_id, req.user.id, dto);
  }

  // =====================
  // Admin路由
  // =====================
  @Get('stats/today')
  @UseGuards(RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  getTodayStats(@Request() req: any) {
    return this.bookingsService.getTodayStats(req.user.profile.tenant_id);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  getBookings(@Query() filters: any, @Request() req: any) {
    return this.bookingsService.getBookings(
      req.user.profile.tenant_id,
      filters,
    );
  }

  @Get(':booking_id')
  @UseGuards(RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  getBooking(
    @Param('booking_id') booking_id: string,
    @Request() req: any,
  ) {
    return this.bookingsService.getBooking(
      booking_id,
      req.user.profile.tenant_id,
    );
  }

  @Post('admin')
  @UseGuards(RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  createAdminBooking(@Body() dto: any, @Request() req: any) {
    return this.bookingsService.createBooking(
      dto.passenger_id ?? req.user.id,
      req.user.profile.tenant_id,
      dto,
    );
  }

  @Patch(':booking_id/confirm')
  @UseGuards(RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  confirmBooking(
    @Param('booking_id') booking_id: string,
    @Body() dto: any,
    @Request() req: any,
  ) {
    return this.bookingsService.confirmBooking(
      booking_id,
      req.user.profile.tenant_id,
      req.user.id,
      dto,
    );
  }

  @Patch(':booking_id/decline')
  @UseGuards(RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  declineBooking(
    @Param('booking_id') booking_id: string,
    @Body('note') note: string,
    @Request() req: any,
  ) {
    return this.bookingsService.declineBooking(
      booking_id,
      req.user.profile.tenant_id,
      req.user.id,
      note,
    );
  }

  @Patch(':booking_id/assign')
  @UseGuards(RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  assignDriver(
    @Param('booking_id') booking_id: string,
    @Body() dto: any,
    @Request() req: any,
  ) {
    return this.bookingsService.assignDriver(
      booking_id,
      req.user.profile.tenant_id,
      req.user.id,
      dto,
    );
  }

  @Patch(':booking_id/modify')
  @UseGuards(RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  modifyBooking(
    @Param('booking_id') booking_id: string,
    @Body() dto: any,
    @Request() req: any,
  ) {
    return this.bookingsService.modifyBooking(
      booking_id,
      req.user.profile.tenant_id,
      req.user.id,
      'TENANT_ADMIN',
      dto,
    );
  }

  @Patch(':booking_id/cancel')
  @UseGuards(RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  cancelBooking(
    @Param('booking_id') booking_id: string,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    return this.bookingsService.cancelBooking(
      booking_id,
      req.user.profile.tenant_id,
      req.user.id,
      'TENANT_ADMIN',
      reason,
    );
  }

  @Patch(':booking_id/fulfil')
  @UseGuards(RolesGuard)
  @Roles('TENANT_ADMIN')
  fulfil(
    @Param('booking_id') booking_id: string,
    @Body() dto: any,
    @Request() req: any,
  ) {
    return this.bookingsService.fulfil(
      booking_id,
      req.user.profile.tenant_id,
      req.user.id,
      dto,
    );
  }

  @Patch(':booking_id/no-show')
  @UseGuards(RolesGuard)
  @Roles('TENANT_ADMIN')
  handleNoShow(
    @Param('booking_id') booking_id: string,
    @Body() dto: any,
    @Request() req: any,
  ) {
    return this.bookingsService.handleNoShow(
      booking_id,
      req.user.profile.tenant_id,
      req.user.id,
      dto,
    );
  }
}
