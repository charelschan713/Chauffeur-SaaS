/**
 * Admin-facing Project Controller
 * All endpoints require ADMIN JWT. Strict tenant isolation.
 */
import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectService } from './project.service';

@Controller('projects')
@UseGuards(JwtGuard)
export class ProjectController {
  constructor(private readonly svc: ProjectService) {}

  @Post()
  create(
    @CurrentUser('tenant_id') tenantId: string,
    @CurrentUser('sub') adminId: string,
    @Body() body: any,
  ) {
    return this.svc.createProject(tenantId, adminId, body);
  }

  @Get()
  list(
    @CurrentUser('tenant_id') tenantId: string,
    @Query() query: any,
  ) {
    return this.svc.listProjects(tenantId, query);
  }

  @Get(':id')
  detail(
    @CurrentUser('tenant_id') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.svc.getProjectDetail(tenantId, id, true);
  }

  @Patch(':id')
  update(
    @CurrentUser('tenant_id') tenantId: string,
    @CurrentUser('sub') adminId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.svc.updateProject(tenantId, id, adminId, body);
  }

  @Post(':id/bookings')
  addBookings(
    @CurrentUser('tenant_id') tenantId: string,
    @CurrentUser('sub') adminId: string,
    @Param('id') id: string,
    @Body() body: { booking_ids: string[] },
  ) {
    return this.svc.addBookings(tenantId, id, adminId, body.booking_ids);
  }

  @Delete(':id/bookings/:bookingId')
  removeBooking(
    @CurrentUser('tenant_id') tenantId: string,
    @Param('id') id: string,
    @Param('bookingId') bookingId: string,
  ) {
    return this.svc.removeBooking(tenantId, id, bookingId);
  }

  @Get(':id/timeline')
  timeline(
    @CurrentUser('tenant_id') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.svc.getProjectTimeline(tenantId, id, true);
  }
}
