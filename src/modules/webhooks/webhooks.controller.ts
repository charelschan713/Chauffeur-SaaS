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
import { WebhooksService, WEBHOOK_EVENTS } from './webhooks.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Webhooks')
@ApiBearerAuth('JWT-auth')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get('events')
  @ApiOperation({ summary: 'List available webhook events' })
  getEvents() {
    return {
      events: WEBHOOK_EVENTS,
      descriptions: {
        'booking.created': 'Fired when a new booking is created',
        'booking.confirmed': 'Fired when a booking is confirmed',
        'booking.cancelled': 'Fired when a booking is cancelled',
        'booking.completed': 'Fired when a booking is completed',
        'booking.driver_assigned': 'Fired when a driver is assigned',
        'booking.driver_on_the_way': 'Fired when driver starts driving',
        'booking.driver_arrived': 'Fired when driver arrives',
        'booking.no_show': 'Fired when passenger is a no-show',
        'payment.paid': 'Fired when payment is successful',
        'payment.refunded': 'Fired when a refund is issued',
        'driver.verified': 'Fired when a driver is verified',
      },
    };
  }

  @Post()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  @ApiOperation({ summary: 'Create a webhook endpoint' })
  create(
    @Body() dto: { webhook_name: string; webhook_url: string; events: string[] },
    @Request() req: any,
  ) {
    return this.webhooksService.createWebhook(req.user.profile.tenant_id, dto);
  }

  @Get()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  @ApiOperation({ summary: 'List all webhooks' })
  list(@Request() req: any) {
    return this.webhooksService.listWebhooks(req.user.profile.tenant_id);
  }

  @Patch(':id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  @ApiOperation({ summary: 'Update a webhook' })
  update(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    return this.webhooksService.updateWebhook(id, req.user.profile.tenant_id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  @ApiOperation({ summary: 'Delete a webhook' })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.webhooksService.deleteWebhook(id, req.user.profile.tenant_id);
  }

  @Post(':id/test')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN')
  @ApiOperation({ summary: 'Send a test webhook' })
  test(@Param('id') id: string, @Request() req: any) {
    return this.webhooksService.testWebhook(id, req.user.profile.tenant_id);
  }

  @Get(':id/deliveries')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  @ApiOperation({ summary: 'Get webhook delivery logs' })
  deliveries(
    @Param('id') id: string,
    @Query('limit') limit: string,
    @Request() req: any,
  ) {
    return this.webhooksService.getDeliveryLogs(
      id,
      req.user.profile.tenant_id,
      parseInt(limit ?? '50'),
    );
  }
}
