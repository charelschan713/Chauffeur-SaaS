import {
  Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { DiscountService } from './discount.service';

@Controller('discounts')
@UseGuards(JwtGuard)
export class DiscountController {
  constructor(private readonly svc: DiscountService) {}

  @Get()
  list(@Req() req: any) {
    return this.svc.list(req.user.tenant_id);
  }

  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.svc.create(req.user.tenant_id, body);
  }

  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.update(req.user.tenant_id, id, body);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.svc.remove(req.user.tenant_id, id);
  }

  /** Validate a promo code for a given fare — used by customer portal */
  @Post('validate')
  async validate(@Req() req: any, @Body() body: any) {
    const result = await this.svc.resolveDiscount(req.user.tenant_id, body.baseFareMinor ?? 0, {
      code:          body.code,
      serviceTypeId: body.serviceTypeId,
      customerId:    body.customerId,
      isNewCustomer: body.isNewCustomer,
    });
    if (!result) return { valid: false, message: 'Code not found or not applicable' };
    return { valid: true, ...result };
  }
}
