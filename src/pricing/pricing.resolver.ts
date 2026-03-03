import { Injectable } from '@nestjs/common';
import { ZoneResolver } from './resolvers/zone.resolver';
import { ItemResolver } from './resolvers/item.resolver';
import { MultiplierResolver } from './resolvers/multiplier.resolver';
import { AdjustmentResolver } from './resolvers/adjustment.resolver';
import { buildSnapshot } from './snapshot.builder';
import { PricingContext, PricingSnapshot } from './pricing.types';
import { DiscountResolver } from '../customer/discount.resolver';

@Injectable()
export class PricingResolver {
  constructor(
    private readonly zoneResolver: ZoneResolver,
    private readonly itemResolver: ItemResolver,
    private readonly multiplierResolver: MultiplierResolver,
    private readonly adjustmentResolver: AdjustmentResolver,
    private readonly discountResolver: DiscountResolver,
  ) {}

  async resolve(ctx: PricingContext): Promise<PricingSnapshot> {
    const { surgeMultiplier, serviceClassName } =
      await this.multiplierResolver.resolve(ctx.tenantId, ctx.serviceClassId);

    // Step 1: Zone check (highest priority)
    const zoneMatch = await this.zoneResolver.resolve(ctx);
    if (zoneMatch) {
      const snapshot = buildSnapshot({
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

      const tollParkingMinor = 0;
      const discount = await this.discountResolver.resolve(
        ctx.tenantId,
        ctx.customerId ?? null,
        snapshot.totalPriceMinor,
      );
      const grandTotalMinor = discount.final_fare_minor + tollParkingMinor;

      return {
        ...snapshot,
        pre_discount_fare_minor: discount.pre_discount_fare_minor,
        discount_type: discount.discount_type,
        discount_value: discount.discount_value,
        discount_amount_minor: discount.discount_amount_minor,
        final_fare_minor: discount.final_fare_minor,
        toll_parking_minor: tollParkingMinor,
        grand_total_minor: grandTotalMinor,
        discount_source_customer_id: ctx.customerId ?? null,
      } as PricingSnapshot;
    }

    // Step 2: Itemized pricing
    const items = await this.itemResolver.resolve(ctx);

    // Step 3: Adjustment (V1 passthrough)
    await this.adjustmentResolver.resolve(ctx);

    const snapshot = buildSnapshot({
      serviceClassId: ctx.serviceClassId,
      serviceClassName,
      pricingMode: 'ITEMIZED',
      resolvedZoneId: null,
      items,
      surgeMultiplier,
      currency: ctx.currency,
    });

    const tollParkingMinor = 0;
    const discount = await this.discountResolver.resolve(
      ctx.tenantId,
      ctx.customerId ?? null,
      snapshot.totalPriceMinor,
    );
    const grandTotalMinor = discount.final_fare_minor + tollParkingMinor;

    return {
      ...snapshot,
      pre_discount_fare_minor: discount.pre_discount_fare_minor,
      discount_type: discount.discount_type,
      discount_value: discount.discount_value,
      discount_amount_minor: discount.discount_amount_minor,
      final_fare_minor: discount.final_fare_minor,
      toll_parking_minor: tollParkingMinor,
      grand_total_minor: grandTotalMinor,
      discount_source_customer_id: ctx.customerId ?? null,
    } as PricingSnapshot;
  }
}
