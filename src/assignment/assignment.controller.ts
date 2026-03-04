import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { AssignmentService } from './assignment.service';

@Controller('assignments')
@UseGuards(JwtGuard)
export class AssignmentController {
  constructor(private readonly assignmentService: AssignmentService) {}

  @Post('/bookings/:bookingId/assign')
  async assign(@Param('bookingId') bookingId: string, @Body() body: any, @Req() req: any) {
    return this.assignmentService.manualAssign(
      req.user.tenant_id,
      bookingId,
      req.user.sub,
      body,
    );
  }

  @Post(':id/accept')
  async accept(@Param('id') id: string, @Req() req: any) {
    return this.assignmentService.accept(req.user.tenant_id, id, req.user.sub);
  }

  @Post(':id/reject')
  async reject(@Param('id') id: string, @Req() req: any) {
    return this.assignmentService.reject(req.user.tenant_id, id, req.user.sub);
  }

  @Patch(':id/driver-pay')
  async updateDriverPay(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.assignmentService.updateDriverPay(req.user.tenant_id, id, body);
  }

  // ─── Partner Transfer ──────────────────────────────────────────────────────

  /** Get approved connections for partner selector */
  @Get('connections/approved')
  async approvedConnections(@Req() req: any) {
    return this.assignmentService.getApprovedConnections(req.user.tenant_id);
  }

  /** Assign booking to partner */
  @Post('/bookings/:bookingId/assign-partner')
  async assignPartner(
    @Param('bookingId') bookingId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.assignmentService.assignToPartner(
      req.user.tenant_id,
      bookingId,
      req.user.sub,
      body,
    );
  }

  /** Partner accepts transfer */
  @Post(':id/partner-accept')
  async partnerAccept(@Param('id') id: string, @Req() req: any) {
    return this.assignmentService.partnerAccept(req.user.tenant_id, id, req.user.sub);
  }

  /** Partner rejects transfer */
  @Post(':id/partner-reject')
  async partnerReject(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.assignmentService.partnerReject(req.user.tenant_id, id, body?.reason);
  }

  /** Requester cancels pending transfer */
  @Post(':id/cancel-transfer')
  async cancelTransfer(@Param('id') id: string, @Req() req: any) {
    return this.assignmentService.cancelPartnerTransfer(req.user.tenant_id, id);
  }
}
