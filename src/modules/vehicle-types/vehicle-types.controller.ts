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
import { VehicleTypeExtrasService } from './vehicle-type-extras.service';

@ApiTags('Vehicle Types')
@ApiBearerAuth('JWT-auth')
@Controller('vehicle-types')
export class VehicleTypesController {
  constructor(
    private readonly service: VehicleTypesService,
    private readonly extrasService: VehicleTypeExtrasService,
  ) {}

  @Get()
  @UseGuards(JwtGuard)
  findAll(@Request() req: any) {
    return this.service.findByTenant(req.user.profile.tenant_id);
  }

  // GET /vehicle-types/:id/extras
  @Get(':id/extras')
  @UseGuards(JwtGuard)
  getExtras(@Param('id') id: string, @Request() req: any) {
    return this.extrasService.findByVehicleType(id, req.user.profile.tenant_id);
  }

  @Get(':id')
  @UseGuards(JwtGuard)
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.service.findById(id, req.user.profile.tenant_id);
  }

  // POST /vehicle-types/:id/extras
  @Post(':id/extras')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  createExtra(
    @Param('id') vehicle_type_id: string,
    @Body() dto: any,
    @Request() req: any,
  ) {
    return this.extrasService.create(req.user.profile.tenant_id, {
      ...dto,
      tenant_vehicle_type_id: vehicle_type_id,
    });
  }

  @Post()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  create(@Body() dto: any, @Request() req: any) {
    return this.service.create(req.user.profile.tenant_id, dto);
  }

  // PATCH /vehicle-types/extras/:extraId
  @Patch('extras/:extraId')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  updateExtra(@Param('extraId') id: string, @Body() dto: any, @Request() req: any) {
    return this.extrasService.update(id, req.user.profile.tenant_id, dto);
  }

  @Patch(':id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  update(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    return this.service.update(id, req.user.profile.tenant_id, dto);
  }

  // DELETE /vehicle-types/extras/:extraId
  @Delete('extras/:extraId')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  removeExtra(@Param('extraId') id: string, @Request() req: any) {
    return this.extrasService.remove(id, req.user.profile.tenant_id);
  }

  @Delete(':id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.service.remove(id, req.user.profile.tenant_id);
  }
}
