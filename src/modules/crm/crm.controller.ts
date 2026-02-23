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
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { PassengersService } from './passengers.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('CRM')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtGuard, RolesGuard)
@Roles('TENANT_ADMIN', 'TENANT_STAFF')
@Controller('crm')
export class CrmController {
  constructor(
    private readonly contactsService: ContactsService,
    private readonly passengersService: PassengersService,
  ) {}

  @Get('contacts')
  getContacts(@Request() req: any, @Query() query: any) {
    return this.contactsService.findAll(req.user.profile.tenant_id, query);
  }

  @Get('contacts/:id')
  getContact(@Param('id') id: string, @Request() req: any) {
    return this.contactsService.findById(id, req.user.profile.tenant_id);
  }

  @Post('contacts')
  createContact(@Body() dto: any, @Request() req: any) {
    return this.contactsService.create(req.user.profile.tenant_id, dto);
  }

  @Patch('contacts/:id')
  updateContact(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    return this.contactsService.update(id, req.user.profile.tenant_id, dto);
  }

  @Delete('contacts/:id')
  deleteContact(@Param('id') id: string, @Request() req: any) {
    return this.contactsService.remove(id, req.user.profile.tenant_id);
  }

  @Get('passengers')
  getPassengers(@Request() req: any, @Query() query: any) {
    return this.passengersService.findAll(req.user.profile.tenant_id, query);
  }

  @Get('passengers/:id')
  getPassenger(@Param('id') id: string, @Request() req: any) {
    return this.passengersService.findById(id, req.user.profile.tenant_id);
  }

  @Post('passengers')
  createPassenger(@Body() dto: any, @Request() req: any) {
    return this.passengersService.create(req.user.profile.tenant_id, dto);
  }

  @Patch('passengers/:id')
  updatePassenger(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    return this.passengersService.update(id, req.user.profile.tenant_id, dto);
  }

  @Delete('passengers/:id')
  deletePassenger(@Param('id') id: string, @Request() req: any) {
    return this.passengersService.remove(id, req.user.profile.tenant_id);
  }
}
