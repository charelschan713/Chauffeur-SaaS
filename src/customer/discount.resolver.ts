import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LoyaltyService } from '../loyalty/loyalty.service';

const TIER_DISCOUNT: Record<string, number> = {
  STANDARD: 0,
  SILVER: 5,
  GOLD: 10,
  PLATINUM: 15,
  VIP: 20,
};

export interface DiscountResult {
  discount_type: 'NONE' | 'TIER' | 'CUSTOM_PERCENT' | 'CUSTOM_FIXED';
  discount_value: number;
  discount_amount_minor: number;
  pre_discount_fare_minor: number;
  final_fare_minor: number;
}

@Injectable()
export class DiscountResolver {
  constructor(
    private readonly dataSource: DataSource,
    private readonly loyaltyService: LoyaltyService,
  ) {}

  async resolve(
    tenantId: string,
    customerId: string | null,
    fareMinor: number,
  ): Promise<DiscountResult> {
    if (!customerId) {
      return {
        discount_type: 'NONE',
        discount_value: 0,
        discount_amount_minor: 0,
        pre_discount_fare_minor: fareMinor,
        final_fare_minor: fareMinor,
      };
    }

    const rows = await this.dataSource.query(
      `SELECT tier, custom_discount_type, custom_discount_value
       FROM public.customers
       WHERE id = $1 AND tenant_id = $2 AND active = true`,
      [customerId, tenantId],
    );

    if (!rows.length) {
      return {
        discount_type: 'NONE',
        discount_value: 0,
        discount_amount_minor: 0,
        pre_discount_fare_minor: fareMinor,
        final_fare_minor: fareMinor,
      };
    }

    const customer = rows[0];

    if (customer.tier === 'CUSTOM') {
      if (customer.custom_discount_type === 'CUSTOM_FIXED') {
        const amount = Math.round(parseFloat(customer.custom_discount_value) * 100);
        return {
          discount_type: 'CUSTOM_FIXED',
          discount_value: parseFloat(customer.custom_discount_value),
          discount_amount_minor: amount,
          pre_discount_fare_minor: fareMinor,
          final_fare_minor: Math.max(0, fareMinor - amount),
        };
      }
      const pct = parseFloat(customer.custom_discount_value);
      const amount = Math.round(fareMinor * (pct / 100));
      return {
        discount_type: 'CUSTOM_PERCENT',
        discount_value: pct,
        discount_amount_minor: amount,
        pre_discount_fare_minor: fareMinor,
        final_fare_minor: Math.max(0, fareMinor - amount),
      };
    }

    const tierMap = await this.loyaltyService.getTierRateMap(tenantId);
    const pct = tierMap[customer.tier] ?? TIER_DISCOUNT[customer.tier] ?? 0;
    if (pct === 0) {
      return {
        discount_type: 'NONE',
        discount_value: 0,
        discount_amount_minor: 0,
        pre_discount_fare_minor: fareMinor,
        final_fare_minor: fareMinor,
      };
    }
    const amount = Math.round(fareMinor * (pct / 100));
    return {
      discount_type: 'TIER',
      discount_value: pct,
      discount_amount_minor: amount,
      pre_discount_fare_minor: fareMinor,
      final_fare_minor: Math.max(0, fareMinor - amount),
    };
  }
}
