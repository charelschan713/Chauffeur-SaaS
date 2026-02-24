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

  @Get('contacts/search/quick')
  @UseGuards(JwtGuard)
  quickSearchContacts(@Query('q') q: string, @Request() req: any) {
    return this.contactsService.findAll(req.user.profile.tenant_id, {
      search: q,
      limit: '10',
    });
  }

  @Get('contacts/:id')
  getContact(@Param('id') id: string, @Request() req: any) {
    return this.contactsService.findById(id, req.user.profile.tenant_id);
  }

  // 获取联系人的乘客列表
  @Get('contacts/:id/passengers')
  @UseGuards(JwtGuard)
  getContactPassengers(@Param('id') id: string, @Request() req: any) {
    return this.contactsService.getPassengers(id, req.user.profile.tenant_id);
  }

  // 关联乘客到联系人
  @Post('contacts/:id/passengers')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  linkPassenger(
    @Param('id') contact_id: string,
    @Body()
    dto: {
      passenger_id: string;
      is_default?: boolean;
      relationship?: string;
    },
    @Request() req: any,
  ) {
    return this.contactsService.linkPassenger(
      contact_id,
      dto.passenger_id,
      req.user.profile.tenant_id,
      dto.is_default,
      dto.relationship,
    );
  }

  // 取消关联
  @Delete('contacts/:contactId/passengers/:passengerId')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  unlinkPassenger(
    @Param('contactId') contact_id: string,
    @Param('passengerId') passenger_id: string,
    @Request() req: any,
  ) {
    return this.contactsService.unlinkPassenger(
      contact_id,
      passenger_id,
      req.user.profile.tenant_id,
    );
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

  @Get('passengers/search/quick')
  @UseGuards(JwtGuard)
  quickSearchPassengers(@Query('q') q: string, @Request() req: any) {
    return this.passengersService.findAll(req.user.profile.tenant_id, {
      search: q,
      limit: '10',
    });
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
