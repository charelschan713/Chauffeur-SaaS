import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ReviewsService } from './reviews.service';

@UseGuards(JwtGuard)
@Controller('admin/reviews')
export class ReviewsController {
  constructor(private readonly svc: ReviewsService) {}

  @Get('drivers')
  listDrivers(@Query('status') status?: string) {
    return this.svc.listDriverReviews(status);
  }

  @Patch('drivers/:id/approve')
  approveDriver(
    @CurrentUser('sub') adminId: string,
    @Param('id') id: string,
    @Body('notes') notes?: string,
  ) {
    return this.svc.approveDriver(adminId, id, notes);
  }

  @Patch('drivers/:id/reject')
  rejectDriver(
    @CurrentUser('sub') adminId: string,
    @Param('id') id: string,
    @Body('notes') notes?: string,
  ) {
    return this.svc.rejectDriver(adminId, id, notes);
  }

  @Get('vehicles')
  listVehicles(@Query('status') status?: string) {
    return this.svc.listVehicleReviews(status);
  }

  @Patch('vehicles/:id/approve')
  approveVehicle(
    @CurrentUser('sub') adminId: string,
    @Param('id') id: string,
    @Body('notes') notes?: string,
  ) {
    return this.svc.approveVehicle(adminId, id, notes);
  }

  @Patch('vehicles/:id/reject')
  rejectVehicle(
    @CurrentUser('sub') adminId: string,
    @Param('id') id: string,
    @Body('notes') notes?: string,
  ) {
    return this.svc.rejectVehicle(adminId, id, notes);
  }
}
