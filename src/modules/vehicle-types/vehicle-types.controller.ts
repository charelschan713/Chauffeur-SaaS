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
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { VehicleTypesService } from './vehicle-types.service';

@ApiTags('Vehicle Types')
@ApiBearerAuth('JWT-auth')
@Controller('vehicle-types')
export class VehicleTypesController {
  constructor(private readonly service: VehicleTypesService) {}

  @Get()
  @UseGuards(JwtGuard)
  findAll(@Request() req: any) {
    return this.service.findByTenant(req.user.profile.tenant_id);
  }

  @Get(':id')
  @UseGuards(JwtGuard)
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.service.findById(id, req.user.profile.tenant_id);
  }

  @Post()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  create(@Body() dto: any, @Request() req: any) {
    return this.service.create(req.user.profile.tenant_id, dto);
  }

  @Patch(':id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  update(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    return this.service.update(id, req.user.profile.tenant_id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.service.remove(id, req.user.profile.tenant_id);
  }
}
