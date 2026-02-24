import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BookingTransferService } from './booking-transfer.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Booking Transfers')
@ApiBearerAuth('JWT-auth')
@Controller('booking-transfers')
@UseGuards(JwtGuard, RolesGuard)
@Roles('TENANT_ADMIN', 'TENANT_STAFF')
export class BookingTransferController {
  constructor(private readonly service: BookingTransferService) {}

  // 收到的转单 (must be before :param routes)
  @Get('incoming')
  getIncoming(@Request() req: any) {
    return this.service.getIncomingTransfers(req.user.profile.tenant_id);
  }

  // 发出的转单
  @Get('outgoing')
  getOutgoing(@Request() req: any) {
    return this.service.getOutgoingTransfers(req.user.profile.tenant_id);
  }

  // 发起转单
  @Post(':booking_id/initiate')
  initiate(
    @Param('booking_id') booking_id: string,
    @Body()
    dto: {
      to_tenant_id: string;
      override_platform_vehicle_ids?: string[];
      transfer_note?: string;
    },
    @Request() req: any,
  ) {
    return this.service.initiateTransfer(
      booking_id,
      req.user.profile.tenant_id,
      dto,
    );
  }

  // 获取符合要求的租户
  @Get(':booking_id/eligible-tenants')
  getEligibleTenants(
    @Param('booking_id') booking_id: string,
    @Query('override_ids') override_ids: string,
    @Request() req: any,
  ) {
    const ids = override_ids ? override_ids.split(',') : undefined;
    return this.service.getEligibleTenants(
      booking_id,
      req.user.profile.tenant_id,
      ids,
    );
  }

  // 获取目标租户的符合车辆
  @Get(':booking_id/matching-vehicles/:tenant_id')
  getMatchingVehicles(
    @Param('booking_id') booking_id: string,
    @Param('tenant_id') target_tenant_id: string,
    @Query('override_ids') override_ids: string,
  ) {
    const ids = override_ids ? override_ids.split(',') : undefined;
    return this.service.getMatchingVehicles(
      booking_id,
      target_tenant_id,
      ids,
    );
  }

  // 接受转单
  @Patch(':transfer_id/accept')
  accept(
    @Param('transfer_id') transfer_id: string,
    @Body()
    dto: {
      assigned_vehicle_id: string;
      assigned_driver_id: string;
      response_note?: string;
    },
    @Request() req: any,
  ) {
    return this.service.acceptTransfer(
      transfer_id,
      req.user.profile.tenant_id,
      dto,
    );
  }

  // 拒绝转单
  @Patch(':transfer_id/decline')
  decline(
    @Param('transfer_id') transfer_id: string,
    @Body() body: { response_note?: string },
    @Request() req: any,
  ) {
    return this.service.declineTransfer(
      transfer_id,
      req.user.profile.tenant_id,
      body.response_note,
    );
  }
}
