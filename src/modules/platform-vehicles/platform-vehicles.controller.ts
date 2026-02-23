import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PlatformVehiclesService } from './platform-vehicles.service';

@ApiTags('Platform Vehicles')
@ApiBearerAuth('JWT-auth')
@Controller('platform-vehicles')
export class PlatformVehiclesController {
  constructor(private readonly service: PlatformVehiclesService) {}

  @Get()
  @UseGuards(JwtGuard)
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.service.findAll(includeInactive === 'true');
  }

  @Get('search')
  @UseGuards(JwtGuard)
  search(@Query('q') q: string) {
    return this.service.search(q ?? '');
  }

  @Post()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  create(
    @Body()
    dto: {
      make: string;
      model: string;
      images?: string[];
    },
    @Request() req: any,
  ) {
    return this.service.create(dto, req.user.id);
  }

  @Patch(':id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('request')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('DRIVER')
  requestNew(
    @Body()
    dto: {
      make: string;
      model: string;
    },
    @Request() req: any,
  ) {
    return this.service.requestNewVehicle(
      dto.make,
      dto.model,
      req.user.id,
      req.user.profile?.tenant_id,
    );
  }
}
