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
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ServiceTypesService } from './service-types.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Service Types')
@ApiBearerAuth('JWT-auth')
@Controller('service-types')
export class ServiceTypesController {
  constructor(private readonly service: ServiceTypesService) {}

  @Get()
  @UseGuards(JwtGuard)
  findAll(@Request() req: any) {
    return this.service.findAll(req.user.profile.tenant_id);
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
