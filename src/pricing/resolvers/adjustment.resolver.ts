import { Injectable } from '@nestjs/common';
import { PricingContext } from '../pricing.types';

// V1: stub only. Reserved for AI surge / contracts / partner pricing.
@Injectable()
export class AdjustmentResolver {
  async resolve(_ctx: PricingContext): Promise<number> {
    return 1.0;
  }
}
