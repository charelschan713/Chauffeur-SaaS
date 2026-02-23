import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('notifications')
@UseGuards(JwtGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('push-token')
  @UseGuards(RolesGuard)
  @Roles('DRIVER')
  registerPushToken(
    @Body() dto: { push_token: string; device_type?: 'ios' | 'android' },
    @Request() req: any,
  ) {
    return this.notificationsService.registerPushToken(
      req.user.id,
      dto.push_token,
      dto.device_type ?? 'ios',
    );
  }

  @Post('sms')
  @UseGuards(RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  adminSendSMS(
    @Body() dto: { recipient_phone: string; body: string; booking_id?: string },
    @Request() req: any,
  ) {
    return this.notificationsService.adminSendSMS(
      req.user.profile.tenant_id,
      dto.recipient_phone,
      dto.body,
      dto.booking_id,
    );
  }

  @Get('logs')
  @UseGuards(RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  getLogs(@Query('booking_id') booking_id: string, @Request() req: any) {
    return this.notificationsService.getNotificationLogs(
      req.user.profile.tenant_id,
      booking_id,
    );
  }

  @Get('logs/:booking_id')
  @UseGuards(RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  getBookingLogs(
    @Param('booking_id') booking_id: string,
    @Request() req: any,
  ) {
    return this.notificationsService.getNotificationLogs(
      req.user.profile.tenant_id,
      booking_id,
    );
  }

  @Post('resend/:booking_id')
  @UseGuards(RolesGuard)
  @Roles('TENANT_ADMIN')
  resendNotification(
    @Param('booking_id') booking_id: string,
    @Body()
    dto: {
      notification_type: string;
      recipient_type: 'BOOKER' | 'PASSENGER' | 'DRIVER';
      channels: ('EMAIL' | 'SMS' | 'PUSH')[];
    },
    @Request() req: any,
  ) {
    return this.notificationsService.sendNotification({
      tenant_id: req.user.profile.tenant_id,
      booking_id,
      notification_type: dto.notification_type,
      recipient_type: dto.recipient_type,
      channels: dto.channels,
      variables: {},
    });
  }
}
