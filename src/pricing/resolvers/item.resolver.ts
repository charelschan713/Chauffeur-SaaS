import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PricingContext, PricingItemBreakdown } from '../pricing.types';

@Injectable()
export class ItemResolver {
  constructor(private readonly dataSource: DataSource) {}

  async resolve(ctx: PricingContext): Promise<PricingItemBreakdown[]> {
    const items = await this.dataSource.query(
      `SELECT item_type, unit, amount_minor
       FROM public.service_class_pricing_items
       WHERE tenant_id = $1
         AND service_class_id = $2
         AND active = true`,
      [ctx.tenantId, ctx.serviceClassId],
    );

    return items.map((item: any) => {
      const quantity = this.resolveQuantity(item.item_type, ctx);
      const unitAmount = Number(item.amount_minor);
      return {
        type: item.item_type,
        unit: item.unit,
        quantity,
        unitAmountMinor: unitAmount,
        subtotalMinor: Math.round(quantity * unitAmount),
      };
    });
  }

  private resolveQuantity(itemType: string, ctx: PricingContext): number {
    switch (itemType) {
      case 'BASE_FARE':
        return 1;
      case 'PER_KM':
        return ctx.distanceKm;
      case 'DRIVING_TIME':
        return ctx.durationMinutes;
      case 'WAITING_TIME':
        return 0;
      case 'HOURLY_RATE':
        return ctx.durationMinutes / 60;
      case 'WAYPOINT':
        return ctx.waypointsCount;
      case 'BABYSEAT':
        return ctx.babyseatCount;
      default:
        return 0;
    }
  }
}
