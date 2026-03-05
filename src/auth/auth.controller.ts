import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { SwitchTenantDto } from './dto/switch-tenant.dto';
import { JwtGuard } from '../common/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

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

  // ─── Profile ──────────────────────────────────────────────────────────────

  @Get('me')
  @UseGuards(JwtGuard)
  async getMe(@CurrentUser('sub') userId: string) {
    const rows = await this.db.query(
      `SELECT id, email, first_name, last_name, phone_country_code, phone_number, created_at
         FROM public.users WHERE id = $1`,
      [userId],
    );
    return rows[0] ?? null;
  }

  @Patch('profile')
  @UseGuards(JwtGuard)
  async updateProfile(@CurrentUser('sub') userId: string, @Body() body: any) {
    await this.db.query(
      `UPDATE public.users
         SET first_name = COALESCE($1, first_name),
             last_name  = COALESCE($2, last_name),
             phone_country_code = COALESCE($3, phone_country_code),
             phone_number       = COALESCE($4, phone_number),
             updated_at = now()
       WHERE id = $5`,
      [body.first_name ?? null, body.last_name ?? null, body.phone_country_code ?? null, body.phone_number ?? null, userId],
    );
    return { success: true };
  }

  @Patch('change-password')
  @UseGuards(JwtGuard)
  async changePassword(@CurrentUser('sub') userId: string, @Body() body: any) {
    const rows = await this.db.query(
      `SELECT password_hash FROM public.users WHERE id = $1`, [userId],
    );
    if (!rows.length) throw new UnauthorizedException();
    const valid = await bcrypt.compare(body.current_password, rows[0].password_hash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
    const hash = await bcrypt.hash(body.new_password, 12);
    await this.db.query(`UPDATE public.users SET password_hash = $1, updated_at = now() WHERE id = $2`, [hash, userId]);
    return { success: true };
  }

  // ─── Mobile-friendly endpoints (token in body, no cookies) ───────────────

  @Post('mobile/login')
  async mobileLogin(@Body() dto: LoginDto) {
    // Returns both tokens in response body for native app storage
    const result = await this.auth.login(dto.email, dto.password);
    return {
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      expires_in: result.expiresIn,
    };
  }

  @Post('mobile/refresh')
  async mobileRefresh(@Body('refresh_token') refreshToken: string) {
    if (!refreshToken) throw new UnauthorizedException('No refresh token');
    const result = await this.auth.refresh(refreshToken);
    return {
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      expires_in: result.expiresIn,
    };
  }
}
