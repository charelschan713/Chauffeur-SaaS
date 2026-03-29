import { Body, Controller, Get, Patch, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../common/guards/jwt.guard';
import { LoyaltyService, LoyaltyTierCode } from './loyalty.service';

@Controller('loyalty/tiers')
@UseGuards(JwtGuard)
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Get()
  async list(@Req() req: any) {
    return this.loyalty.list(req.user.tenant_id);
  }

  @Post()
  async upsertMany(@Req() req: any, @Body() body: any) {
    const tiers = Array.isArray(body?.tiers) ? body.tiers : [];
    return this.loyalty.upsertMany(req.user.tenant_id, tiers);
  }

  @Patch(':tier')
  async patchOne(@Req() req: any, @Param('tier') tier: LoyaltyTierCode, @Body() patch: any) {
    return this.loyalty.patchOne(req.user.tenant_id, tier, patch ?? {});
  }
}
