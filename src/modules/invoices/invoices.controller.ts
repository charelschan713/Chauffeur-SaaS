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
import { InvoicesService } from './invoices.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('invoices')
@UseGuards(JwtGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  // =====================
  // 司机路由
  // =====================

  @Get('driver/invoiceable-bookings')
  @UseGuards(RolesGuard)
  @Roles('DRIVER')
  getInvoiceableBookings(@Request() req: any) {
    return this.invoicesService.getInvoiceableBookings(req.user.id);
  }

  @Get('driver')
  @UseGuards(RolesGuard)
  @Roles('DRIVER')
  getMyInvoices(@Request() req: any) {
    return this.invoicesService.getDriverInvoices(req.user.id);
  }

  @Get('driver/:invoice_id')
  @UseGuards(RolesGuard)
  @Roles('DRIVER')
  getMyInvoice(@Param('invoice_id') invoice_id: string, @Request() req: any) {
    return this.invoicesService.getInvoice(invoice_id, req.user.id);
  }

  @Post('driver')
  @UseGuards(RolesGuard)
  @Roles('DRIVER')
  createInvoice(
    @Body() dto: { tenant_id: string; booking_ids: string[] },
    @Request() req: any,
  ) {
    return this.invoicesService.createInvoice(
      req.user.id,
      dto.tenant_id,
      dto.booking_ids,
    );
  }

  @Patch('driver/:invoice_id/submit')
  @UseGuards(RolesGuard)
  @Roles('DRIVER')
  submitInvoice(@Param('invoice_id') invoice_id: string, @Request() req: any) {
    return this.invoicesService.submitInvoice(invoice_id, req.user.id);
  }

  @Delete('driver/:invoice_id')
  @UseGuards(RolesGuard)
  @Roles('DRIVER')
  deleteInvoice(@Param('invoice_id') invoice_id: string, @Request() req: any) {
    return this.invoicesService.deleteInvoice(invoice_id, req.user.id);
  }

  @Patch('driver/abn')
  @UseGuards(RolesGuard)
  @Roles('DRIVER')
  updateABN(
    @Body()
    dto: {
      abn: string;
      bank_bsb?: string;
      bank_account?: string;
      bank_name?: string;
      invoice_prefix?: string;
    },
    @Request() req: any,
  ) {
    return this.invoicesService.updateDriverABN(req.user.id, dto);
  }

  @Get('verify-abn/:abn')
  verifyABN(@Param('abn') abn: string) {
    return this.invoicesService.verifyABN(abn);
  }

  // =====================
  // 租户Admin路由
  // =====================

  @Get('tenant')
  @UseGuards(RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  getTenantInvoices(
    @Query()
    filters: {
      invoice_status?: string;
      page?: string;
      limit?: string;
    },
    @Request() req: any,
  ) {
    return this.invoicesService.getTenantInvoices(req.user.profile.tenant_id, {
      invoice_status: filters.invoice_status,
      page: filters.page ? parseInt(filters.page) : 1,
      limit: filters.limit ? parseInt(filters.limit) : 20,
    });
  }

  @Get('tenant/:invoice_id')
  @UseGuards(RolesGuard)
  @Roles('TENANT_ADMIN', 'TENANT_STAFF')
  getTenantInvoice(@Param('invoice_id') invoice_id: string) {
    return this.invoicesService.getInvoice(invoice_id);
  }

  @Patch('tenant/:invoice_id/paid')
  @UseGuards(RolesGuard)
  @Roles('TENANT_ADMIN')
  markPaid(@Param('invoice_id') invoice_id: string, @Request() req: any) {
    return this.invoicesService.markInvoicePaid(
      invoice_id,
      req.user.profile.tenant_id,
      req.user.id,
    );
  }
}
