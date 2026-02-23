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
import { ConnectionsService } from './connections.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('connections')
@UseGuards(JwtGuard, RolesGuard)
@Roles('TENANT_ADMIN', 'TENANT_STAFF')
export class ConnectionsController {
  constructor(private readonly connectionsService: ConnectionsService) {}

  // =====================
  // Connection路由
  // =====================

  @Get('search')
  searchTenants(@Query('keyword') keyword: string, @Request() req: any) {
    return this.connectionsService.searchTenants(
      req.user.profile.tenant_id,
      keyword ?? '',
    );
  }

  @Get()
  getConnections(@Request() req: any) {
    return this.connectionsService.getConnections(req.user.profile.tenant_id);
  }

  @Get('active')
  getActiveConnections(@Request() req: any) {
    return this.connectionsService.getActiveConnections(
      req.user.profile.tenant_id,
    );
  }

  @Post('request')
  @Roles('TENANT_ADMIN')
  requestConnection(
    @Body()
    dto: {
      receiver_tenant_id: string;
      requester_note?: string;
    },
    @Request() req: any,
  ) {
    return this.connectionsService.requestConnection(
      req.user.profile.tenant_id,
      dto,
    );
  }

  @Patch(':connection_id/accept')
  @Roles('TENANT_ADMIN')
  acceptConnection(
    @Param('connection_id') connection_id: string,
    @Request() req: any,
  ) {
    return this.connectionsService.acceptConnection(
      connection_id,
      req.user.profile.tenant_id,
    );
  }

  @Patch(':connection_id/reject')
  @Roles('TENANT_ADMIN')
  rejectConnection(
    @Param('connection_id') connection_id: string,
    @Request() req: any,
  ) {
    return this.connectionsService.rejectConnection(
      connection_id,
      req.user.profile.tenant_id,
    );
  }

  @Patch(':connection_id/terminate')
  @Roles('TENANT_ADMIN')
  terminateConnection(
    @Param('connection_id') connection_id: string,
    @Request() req: any,
  ) {
    return this.connectionsService.terminateConnection(
      connection_id,
      req.user.profile.tenant_id,
    );
  }

  // =====================
  // Transfer路由
  // =====================

  @Get('transfers')
  getTransfers(
    @Query('type') type: 'sent' | 'received' | 'all',
    @Request() req: any,
  ) {
    return this.connectionsService.getTransfers(
      req.user.profile.tenant_id,
      type ?? 'all',
    );
  }

  @Post('transfers')
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  createTransfer(
    @Body()
    dto: {
      booking_id: string;
      to_tenant_id: string;
      from_percentage: number;
      to_percentage: number;
      transfer_note?: string;
    },
    @Request() req: any,
  ) {
    return this.connectionsService.createTransfer(
      dto.booking_id,
      req.user.profile.tenant_id,
      req.user.id,
      {
        to_tenant_id: dto.to_tenant_id,
        from_percentage: dto.from_percentage,
        to_percentage: dto.to_percentage,
        transfer_note: dto.transfer_note,
      },
    );
  }

  @Patch('transfers/:transfer_id/accept')
  @Roles('TENANT_ADMIN')
  acceptTransfer(@Param('transfer_id') transfer_id: string, @Request() req: any) {
    return this.connectionsService.acceptTransfer(
      transfer_id,
      req.user.profile.tenant_id,
      req.user.id,
    );
  }

  @Patch('transfers/:transfer_id/reject')
  @Roles('TENANT_ADMIN')
  rejectTransfer(@Param('transfer_id') transfer_id: string, @Request() req: any) {
    return this.connectionsService.rejectTransfer(
      transfer_id,
      req.user.profile.tenant_id,
      req.user.id,
    );
  }

  @Get('transfers/:booking_id/revenue-split')
  getRevenueSplit(@Param('booking_id') booking_id: string, @Request() req: any) {
    return this.connectionsService.calculateRevenueSplit(
      booking_id,
      req.user.profile.tenant_id,
    );
  }
}
