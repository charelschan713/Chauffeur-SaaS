import { Body, Controller, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
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
}
