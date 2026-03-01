import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PricingContext } from '../pricing.types';

@Injectable()
export class ZoneResolver {
  constructor(private readonly dataSource: DataSource) {}

  async resolve(
    ctx: PricingContext,
  ): Promise<{ zoneId: string; flatPriceMinor: number } | null> {
    if (!ctx.pickupZoneName || !ctx.dropoffZoneName) return null;
    const rows = await this.dataSource.query(
      `SELECT id, flat_price_minor FROM public.pricing_zones
       WHERE tenant_id = $1
         AND service_class_id = $2
         AND active = true
         AND LOWER(pickup_zone_name) = LOWER($3)
         AND LOWER(dropoff_zone_name) = LOWER($4)
         AND ($5::timestamptz >= COALESCE(valid_from, $5::timestamptz))
         AND ($5::timestamptz <= COALESCE(valid_to, $5::timestamptz))
       LIMIT 1`,
      [
        ctx.tenantId,
        ctx.serviceClassId,
        ctx.pickupZoneName,
        ctx.dropoffZoneName,
        ctx.requestedAtUtc,
      ],
    );
    if (!rows.length) return null;
    return {
      zoneId: rows[0].id,
      flatPriceMinor: Number(rows[0].flat_price_minor),
    };
  }
}
