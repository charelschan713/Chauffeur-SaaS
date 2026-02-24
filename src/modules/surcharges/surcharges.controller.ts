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
import { SurchargesService } from './surcharges.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('surcharges')
@UseGuards(JwtGuard, RolesGuard)
@Roles('TENANT_ADMIN', 'TENANT_STAFF')
export class SurchargesController {
  constructor(private readonly service: SurchargesService) {}

  @Get('time')
  getTime(@Request() req: any) {
    return this.service.getTime(req.user.profile.tenant_id);
  }

  @Post('time')
  createTime(@Request() req: any, @Body() dto: any) {
    return this.service.createTime(req.user.profile.tenant_id, dto);
  }

  @Patch('time/:id')
  updateTime(@Request() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.service.updateTime(id, req.user.profile.tenant_id, dto);
  }

  @Delete('time/:id')
  deleteTime(@Request() req: any, @Param('id') id: string) {
    return this.service.deleteTime(id, req.user.profile.tenant_id);
  }

  @Get('holiday')
  getHoliday(@Request() req: any) {
    return this.service.getHoliday(req.user.profile.tenant_id);
  }

  @Post('holiday')
  createHoliday(@Request() req: any, @Body() dto: any) {
    return this.service.createHoliday(req.user.profile.tenant_id, dto);
  }

  @Patch('holiday/:id')
  updateHoliday(@Request() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.service.updateHoliday(id, req.user.profile.tenant_id, dto);
  }

  @Delete('holiday/:id')
  deleteHoliday(@Request() req: any, @Param('id') id: string) {
    return this.service.deleteHoliday(id, req.user.profile.tenant_id);
  }

  @Get('event')
  getEvent(@Request() req: any) {
    return this.service.getEvent(req.user.profile.tenant_id);
  }

  @Post('event')
  createEvent(@Request() req: any, @Body() dto: any) {
    return this.service.createEvent(req.user.profile.tenant_id, dto);
  }

  @Patch('event/:id')
  updateEvent(@Request() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.service.updateEvent(id, req.user.profile.tenant_id, dto);
  }

  @Delete('event/:id')
  deleteEvent(@Request() req: any, @Param('id') id: string) {
    return this.service.deleteEvent(id, req.user.profile.tenant_id);
  }

  @Get('airport')
  getAirport(@Request() req: any) {
    return this.service.getAirport(req.user.profile.tenant_id);
  }

  @Post('airport')
  createAirport(@Request() req: any, @Body() dto: any) {
    return this.service.createAirport(req.user.profile.tenant_id, dto);
  }

  @Patch('airport/:id')
  updateAirport(@Request() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.service.updateAirport(id, req.user.profile.tenant_id, dto);
  }

  @Delete('airport/:id')
  deleteAirport(@Request() req: any, @Param('id') id: string) {
    return this.service.deleteAirport(id, req.user.profile.tenant_id);
  }
}
