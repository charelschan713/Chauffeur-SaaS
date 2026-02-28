import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { SwitchTenantDto } from './dto/switch-tenant.dto';
import { JwtGuard } from '../common/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @Res() res: Response) {
    const result = await this.auth.login(dto.email, dto.password);
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/auth',
    });
    return res.json({ accessToken: result.accessToken, expiresIn: result.expiresIn });
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res() res: Response) {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) throw new UnauthorizedException('No refresh token');
    const result = await this.auth.refresh(refreshToken);
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/auth',
    });
    return res.json({ accessToken: result.accessToken, expiresIn: result.expiresIn });
  }

  @UseGuards(JwtGuard)
  @Post('switch-tenant')
  async switchTenant(
    @CurrentUser('sub') userId: string,
    @Body() dto: SwitchTenantDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) throw new UnauthorizedException('No refresh token');
    const result = await this.auth.switchTenant(userId, dto.tenantId, refreshToken);
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/auth',
    });
    return res.json({ accessToken: result.accessToken, expiresIn: result.expiresIn });
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    const refreshToken = req.cookies?.refresh_token;
    if (refreshToken) {
      await this.auth.logout(refreshToken);
    }
    res.clearCookie('refresh_token', { path: '/auth' });
    return res.json({ success: true });
  }

  @UseGuards(JwtGuard)
  @Post('logout-all')
  async logoutAll(@CurrentUser('sub') userId: string, @Res() res: Response) {
    await this.auth.logoutAll(userId);
    res.clearCookie('refresh_token', { path: '/auth' });
    return res.json({ success: true });
  }
}
