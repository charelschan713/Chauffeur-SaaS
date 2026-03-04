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
import { JwtGuard } from '../common/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NetworkService } from './network.service';

// ─── Tenant Network ────────────────────────────────────────────────────────

@UseGuards(JwtGuard)
@Controller('network')
export class NetworkController {
  constructor(private readonly net: NetworkService) {}

  /** List my tenant's connections */
  @Get('connections')
  async list(@CurrentUser('tenant_id') tenantId: string) {
    return this.net.listConnections(tenantId);
  }

  /** Request connection with another tenant */
  @Post('connections/request')
  async request(
    @CurrentUser('tenant_id') tenantId: string,
    @Body('acceptor_tenant_id') acceptorId: string,
    @Body('note') note?: string,
  ) {
    return this.net.requestConnection(tenantId, acceptorId, note);
  }

  /** Accept incoming connection */
  @Patch('connections/:id/accept')
  async accept(
    @CurrentUser('tenant_id') tenantId: string,
    @Param('id') id: string,
    @Body('note') note?: string,
  ) {
    return this.net.acceptConnection(tenantId, id, note);
  }

  /** Reject connection */
  @Patch('connections/:id/reject')
  async reject(
    @CurrentUser('tenant_id') tenantId: string,
    @Param('id') id: string,
    @Body('note') note?: string,
  ) {
    return this.net.rejectConnection(tenantId, id, note);
  }

  /** Disconnect / suspend active connection */
  @Patch('connections/:id/disconnect')
  async disconnect(
    @CurrentUser('tenant_id') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.net.suspendConnection(tenantId, id);
  }
}

// ─── Platform Admin: Network oversight ────────────────────────────────────

@UseGuards(JwtGuard)
@Controller('platform/network')
export class PlatformNetworkController {
  constructor(private readonly net: NetworkService) {}

  /** Pending external connections needing platform approval */
  @Get('connections/pending')
  async pendingConnections() {
    return this.net.platformListPendingConnections();
  }

  /** Approve external connection */
  @Patch('connections/:id/approve')
  async approveConnection(
    @CurrentUser('sub') adminId: string,
    @Param('id') id: string,
    @Body('notes') notes?: string,
  ) {
    return this.net.platformApproveConnection(adminId, id, notes);
  }

  /** Reject external connection */
  @Patch('connections/:id/reject')
  async rejectConnection(
    @CurrentUser('sub') adminId: string,
    @Param('id') id: string,
    @Body('notes') notes?: string,
  ) {
    return this.net.platformRejectConnection(adminId, id, notes);
  }

  /** List driver external order applications */
  @Get('driver-approvals')
  async driverApprovals(@Query('status') status?: string) {
    return this.net.platformListDriverApprovals(status);
  }

  /** Approve a driver for external orders */
  @Patch('driver-approvals/:driverId/approve')
  async approveDriver(
    @CurrentUser('sub') adminId: string,
    @Param('driverId') driverId: string,
    @Body('notes') notes?: string,
  ) {
    return this.net.platformApproveDriverExternal(adminId, driverId, notes);
  }

  /** Reject a driver's external order application */
  @Patch('driver-approvals/:driverId/reject')
  async rejectDriver(
    @CurrentUser('sub') adminId: string,
    @Param('driverId') driverId: string,
    @Body('notes') notes?: string,
  ) {
    return this.net.platformRejectDriverExternal(adminId, driverId, notes);
  }
}
