import { Injectable } from '@nestjs/common';
import { ZoneResolver } from './resolvers/zone.resolver';
import { ItemResolver } from './resolvers/item.resolver';
import { MultiplierResolver } from './resolvers/multiplier.resolver';
import { AdjustmentResolver } from './resolvers/adjustment.resolver';
import { buildSnapshot } from './snapshot.builder';
import { PricingContext, PricingSnapshot } from './pricing.types';

@Injectable()
export class PricingResolver {
  constructor(
    private readonly zoneResolver: ZoneResolver,
    private readonly itemResolver: ItemResolver,
    private readonly multiplierResolver: MultiplierResolver,
    private readonly adjustmentResolver: AdjustmentResolver,
  ) {}

  async resolve(ctx: PricingContext): Promise<PricingSnapshot> {
    const { surgeMultiplier, serviceClassName } =
      await this.multiplierResolver.resolve(ctx.tenantId, ctx.serviceClassId);

    // Step 1: Zone check (highest priority)
    const zoneMatch = await this.zoneResolver.resolve(ctx);
    if (zoneMatch) {
      return buildSnapshot({
        serviceClassId: ctx.serviceClassId,
        serviceClassName,
        pricingMode: 'ZONE',
        resolvedZoneId: zoneMatch.zoneId,
        items: [
          {
            type: 'ZONE_FLAT',
            unit: 'flat',
            quantity: 1,
            unitAmountMinor: zoneMatch.flatPriceMinor,
            subtotalMinor: zoneMatch.flatPriceMinor,
          },
        ],
        surgeMultiplier,
        currency: ctx.currency,
      });
    }

    // Step 2: Itemized pricing
    const items = await this.itemResolver.resolve(ctx);

    // Step 3: Adjustment (V1 passthrough)
    await this.adjustmentResolver.resolve(ctx);

    return buildSnapshot({
      serviceClassId: ctx.serviceClassId,
      serviceClassName,
      pricingMode: 'ITEMIZED',
      resolvedZoneId: null,
      items,
      surgeMultiplier,
      currency: ctx.currency,
    });
  }
}
