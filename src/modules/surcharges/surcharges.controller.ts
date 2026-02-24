import {
  Controller,
  Get,
  Post,
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
@Roles('TENANT_ADMIN')
export class SurchargesController {
  constructor(private readonly service: SurchargesService) {}

  @Get('time')
  getTimeSurcharges(@Request() req: any) {
    return this.service.getTimeSurcharges(req.user.profile.tenant_id);
  }

  @Post('time')
  createTimeSurcharge(@Body() dto: any, @Request() req: any) {
    return this.service.createTimeSurcharge(req.user.profile.tenant_id, dto);
  }

  @Delete('time/:id')
  deleteTimeSurcharge(@Param('id') id: string, @Request() req: any) {
    return this.service.deleteTimeSurcharge(id, req.user.profile.tenant_id);
  }

  @Get('holidays')
  getHolidays(@Request() req: any) {
    return this.service.getHolidays(req.user.profile.tenant_id);
  }

  @Post('holidays')
  createHoliday(@Body() dto: any, @Request() req: any) {
    return this.service.createHoliday(req.user.profile.tenant_id, dto);
  }

  @Delete('holidays/:id')
  deleteHoliday(@Param('id') id: string, @Request() req: any) {
    return this.service.deleteHoliday(id, req.user.profile.tenant_id);
  }

  @Get('promo-codes')
  getPromoCodes(@Request() req: any) {
    return this.service.getPromoCodes(req.user.profile.tenant_id);
  }

  @Post('promo-codes')
  createPromoCode(@Body() dto: any, @Request() req: any) {
    return this.service.createPromoCode(req.user.profile.tenant_id, dto);
  }

  @Delete('promo-codes/:id')
  deletePromoCode(@Param('id') id: string, @Request() req: any) {
    return this.service.deletePromoCode(id, req.user.profile.tenant_id);
  }
}
