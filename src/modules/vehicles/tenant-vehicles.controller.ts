import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TenantVehiclesService } from './tenant-vehicles.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Tenant Vehicles')
@ApiBearerAuth('JWT-auth')
@Controller('tenant-vehicles')
@UseGuards(JwtGuard)
export class TenantVehiclesController {
  constructor(private readonly service: TenantVehiclesService) {}

  @Get()
  findAll(@Request() req: any) {
    return this.service.findAll(req.user.profile.tenant_id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  create(@Body() dto: any, @Request() req: any) {
    return this.service.create(req.user.profile.tenant_id, dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  update(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    return this.service.update(id, req.user.profile.tenant_id, dto);
  }

  @Patch(':id/toggle')
  @UseGuards(RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  toggleActive(@Param('id') id: string, @Request() req: any) {
    return this.service.toggleActive(id, req.user.profile.tenant_id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('TENANT_ADMIN')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.service.remove(id, req.user.profile.tenant_id);
  }
}
