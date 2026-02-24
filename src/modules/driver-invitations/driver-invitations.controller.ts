import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DriverInvitationsService } from './driver-invitations.service';

@Controller('driver-invitations')
export class DriverInvitationsController {
  constructor(private readonly service: DriverInvitationsService) {}

  @Post('email')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  inviteByEmail(@Request() req: any, @Body('email') email: string) {
    return this.service.inviteByEmail(req.user.profile.tenant_id, req.user.id, email);
  }

  @Post('sms')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  inviteBySMS(@Request() req: any, @Body('phone') phone: string) {
    return this.service.inviteBySMS(req.user.profile.tenant_id, req.user.id, phone);
  }

  @Post('test-sms')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  testSMS(@Request() req: any, @Body('driver_id') driver_id: string) {
    return this.service.testSMS(req.user.profile.tenant_id, driver_id);
  }

  @Post('accept')
  accept(@Body() dto: any) {
    return this.service.acceptInvitation(dto.token, dto);
  }
}
