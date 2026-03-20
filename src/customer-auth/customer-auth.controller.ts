import { Body, Controller, Post } from '@nestjs/common';
import { CustomerAuthService } from './customer-auth.service';

@Controller('customer-auth')
export class CustomerAuthController {
  constructor(private readonly svc: CustomerAuthService) {}

  @Post('register')
  register(
    @Body()
    body: {
      tenantSlug: string;
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phone?: string;
    },
  ) {
    return this.svc.register(body);
  }

  @Post('login')
  login(@Body() body: { tenantSlug: string; email: string; password: string }) {
    return this.svc.login(body);
  }

  @Post('otp/send')
  sendOtp(@Body() body: { tenantSlug: string; phone: string }) {
    return this.svc.sendOtp(body);
  }

  @Post('otp/verify')
  verifyOtp(@Body() body: { tenantSlug: string; phone: string; phoneCode?: string; otp: string }) {
    return this.svc.verifyOtp(body);
  }

  @Post('email-otp/send')
  sendEmailOtp(@Body() body: { tenantSlug: string; email: string }) {
    return this.svc.sendEmailOtpUnauth(body);
  }

  @Post('email-otp/verify')
  verifyEmailOtp(@Body() body: { tenantSlug: string; email: string; otp: string }) {
    return this.svc.verifyEmailOtpUnauth(body);
  }

  @Post('forgot-password')
  forgotPassword(@Body() body: { tenantSlug: string; email: string }) {
    return this.svc.forgotPassword(body);
  }

  @Post('reset-password')
  resetPassword(@Body() body: { token: string; password: string }) {
    return this.svc.resetPassword(body);
  }
}
