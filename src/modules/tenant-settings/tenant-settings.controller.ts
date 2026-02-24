import { Body, Controller, Get, Patch, Query, Request, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantSettingsService } from './tenant-settings.service';

@Controller('tenant-settings')
@UseGuards(JwtGuard, RolesGuard)
export class TenantSettingsController {
  constructor(private readonly service: TenantSettingsService) {}

  @Get('theme')
  @Roles('TENANT_ADMIN', 'TENANT_STAFF', 'SUPER_ADMIN')
  getTheme(@Request() req: any, @Query('tenant_id') tenant_id?: string) {
    const role = req.user?.role;
    const id = role === 'SUPER_ADMIN' ? (tenant_id ?? req.user?.profile?.tenant_id) : req.user?.profile?.tenant_id;
    return this.service.getTheme(id);
  }

  @Patch('theme')
  @Roles('TENANT_ADMIN', 'SUPER_ADMIN')
  updateTheme(@Request() req: any, @Body() dto: any) {
    const role = req.user?.role;
    const id = role === 'SUPER_ADMIN' ? (dto.tenant_id ?? req.user?.profile?.tenant_id) : req.user?.profile?.tenant_id;
    return this.service.updateTheme(id, dto);
  }
}
