import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { DriverInviteService } from './driver-invite.service';

// ─── Tenant Admin: manage invitations ────────────────────────────────────────

@UseGuards(JwtGuard)
@Controller('drivers/invitations')
export class DriverInviteController {
  constructor(private readonly svc: DriverInviteService) {}

  /** Send a driver invitation */
  @Post()
  async invite(@Body() body: any, @Req() req: any) {
    return this.svc.inviteDriver(req.user.tenant_id, req.user.sub, {
      display_name: body.display_name,
      email: body.email,
      phone_country_code: body.phone_country_code,
      phone_number: body.phone_number,
      invite_type: body.invite_type ?? 'INTERNAL',
    });
  }

  /** List all invitations for tenant */
  @Get()
  async list(@Req() req: any) {
    return this.svc.listInvitations(req.user.tenant_id);
  }

  /** Cancel a pending invitation */
  @Delete(':id')
  async cancel(@Param('id') id: string, @Req() req: any) {
    return this.svc.cancelInvitation(req.user.tenant_id, id);
  }
}

// ─── Public: Onboarding flow (no auth) ───────────────────────────────────────

@Controller('onboarding')
export class DriverOnboardingController {
  constructor(private readonly svc: DriverInviteService) {}

  /** Resolve invitation token — returns safe fields for pre-filling the form */
  @Get('invite/:token')
  async resolveToken(@Param('token') token: string) {
    return this.svc.resolveToken(token);
  }

  /** Submit onboarding form */
  @Post('submit/:token')
  async submit(@Param('token') token: string, @Body() body: any) {
    return this.svc.submitOnboarding(token, body);
  }
}
