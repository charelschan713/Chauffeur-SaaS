import {
  Body,
  Controller,
  ForbiddenException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { JwtGuard } from '../common/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Request } from 'express';

class OfferAssignmentDto {
  bookingId!: string;
  driverId!: string;
  vehicleId!: string;
}

class DeclineDto {
  reason?: string;
}

@UseGuards(JwtGuard)
@Controller('dispatch')
export class DispatchController {
  constructor(private readonly dispatch: DispatchService) {}

  @Post('offer')
  async offer(
    @Body() dto: OfferAssignmentDto,
    @CurrentUser('tenant_id') tenantId: string,
    @CurrentUser('sub') dispatcherId: string,
    @Req() req: Request,
  ) {
    this.assertDispatcherRole(req);
    return this.dispatch.offerAssignment(
      tenantId,
      dto.bookingId,
      dto.driverId,
      dto.vehicleId,
      dispatcherId,
    );
  }

  @Post('accept/:assignmentId')
  async accept(
    @Param('assignmentId') assignmentId: string,
    @CurrentUser('tenant_id') tenantId: string,
    @CurrentUser('sub') driverId: string,
    @Req() req: Request,
  ) {
    this.assertDriverRole(req);
    return this.dispatch.driverAccept(tenantId, assignmentId, driverId);
  }

  @Post('decline/:assignmentId')
  async decline(
    @Param('assignmentId') assignmentId: string,
    @Body() dto: DeclineDto,
    @CurrentUser('tenant_id') tenantId: string,
    @CurrentUser('sub') driverId: string,
    @Req() req: Request,
  ) {
    this.assertDriverRole(req);
    return this.dispatch.driverDecline(tenantId, assignmentId, driverId, dto.reason);
  }

  @Post('start/:assignmentId')
  async start(
    @Param('assignmentId') assignmentId: string,
    @CurrentUser('tenant_id') tenantId: string,
    @CurrentUser('sub') driverId: string,
    @Req() req: Request,
  ) {
    this.assertDriverRole(req);
    return this.dispatch.startTrip(tenantId, assignmentId, driverId);
  }

  @Post('complete/:assignmentId')
  async complete(
    @Param('assignmentId') assignmentId: string,
    @CurrentUser('tenant_id') tenantId: string,
    @CurrentUser('sub') driverId: string,
    @Req() req: Request,
  ) {
    this.assertDriverRole(req);
    return this.dispatch.completeTrip(tenantId, assignmentId, driverId);
  }

  private assertDispatcherRole(req: Request) {
    const role = (req.user as any)?.role;
    if (role !== 'tenant_admin' && role !== 'tenant_staff') {
      throw new ForbiddenException('Dispatcher role required');
    }
  }

  private assertDriverRole(req: Request) {
    const role = (req.user as any)?.role;
    if (role !== 'driver') {
      throw new ForbiddenException('Driver role required');
    }
  }
}

