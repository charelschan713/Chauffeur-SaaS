import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { JwtGuard } from '../common/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { EligibilityResolver } from './eligibility/eligibility.resolver';


class DeclineDto {
  reason?: string;
}

@UseGuards(JwtGuard)
@Controller('dispatch')
export class DispatchController {
  constructor(
    private readonly dispatch: DispatchService,
    private readonly eligibilityResolver: EligibilityResolver,
  ) {}

  @Post('offer')
  async offer(
    @Body('bookingId') bookingId: string,
    @Body('driverId') driverId: string,
    @Body('vehicleId') vehicleId: string,
    @CurrentUser('tenant_id') tenantId: string,
    @CurrentUser('sub') dispatcherId: string,
    @CurrentUser('role') role: string | null,
  ) {
    this.assertRole(role, ['tenant_admin', 'tenant_staff']);
    return this.dispatch.offerAssignment(
      tenantId,
      bookingId,
      driverId,
      vehicleId,
      dispatcherId,
    );
  }

  @Post('auto')
  async autoDispatch(
    @Body('bookingId') bookingId: string,
    @CurrentUser('tenant_id') tenantId: string,
    @CurrentUser('sub') dispatcherId: string,
    @CurrentUser('role') role: string | null,
  ) {
    this.assertRole(role, ['tenant_admin', 'tenant_staff']);
    return this.dispatch.autoDispatch(tenantId, bookingId, dispatcherId);
  }

  @Get('eligible-drivers/:bookingId')
  async eligibleDrivers(
    @Param('bookingId') bookingId: string,
    @CurrentUser('tenant_id') tenantId: string,
    @CurrentUser('role') role: string | null,
  ) {
    this.assertRole(role, ['tenant_admin', 'tenant_staff']);
    return this.eligibilityResolver.resolve(tenantId, bookingId);
  }

  @Post('accept/:assignmentId')
  async accept(
    @Param('assignmentId') assignmentId: string,
    @CurrentUser('tenant_id') tenantId: string,
    @CurrentUser('sub') driverId: string,
    @CurrentUser('role') role: string | null,
  ) {
    this.assertDriverRole(role);
    return this.dispatch.driverAccept(tenantId, assignmentId, driverId);
  }

  @Post('decline/:assignmentId')
  async decline(
    @Param('assignmentId') assignmentId: string,
    @Body() dto: DeclineDto,
    @CurrentUser('tenant_id') tenantId: string,
    @CurrentUser('sub') driverId: string,
    @CurrentUser('role') role: string | null,
  ) {
    this.assertDriverRole(role);
    return this.dispatch.driverDecline(tenantId, assignmentId, driverId, dto.reason);
  }

  @Post('start/:assignmentId')
  async start(
    @Param('assignmentId') assignmentId: string,
    @CurrentUser('tenant_id') tenantId: string,
    @CurrentUser('sub') driverId: string,
    @CurrentUser('role') role: string | null,
  ) {
    this.assertDriverRole(role);
    return this.dispatch.startTrip(tenantId, assignmentId, driverId);
  }

  @Post('complete/:assignmentId')
  async complete(
    @Param('assignmentId') assignmentId: string,
    @CurrentUser('tenant_id') tenantId: string,
    @CurrentUser('sub') driverId: string,
    @CurrentUser('role') role: string | null,
  ) {
    this.assertDriverRole(role);
    return this.dispatch.completeTrip(tenantId, assignmentId, driverId);
  }

  private assertRole(role: string | null, allowed: string[]) {
    if (!role || !allowed.includes(role)) {
      throw new ForbiddenException('Insufficient role');
    }
  }

  private assertDriverRole(role: string | null) {
    this.assertRole(role, ['driver']);
  }
}

