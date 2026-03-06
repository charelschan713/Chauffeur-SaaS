import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GoogleMapsService } from '../maps/google-maps.service';
import { ZoneResolver } from './resolvers/zone.resolver';
import { ItemResolver } from './resolvers/item.resolver';
import { MultiplierResolver } from './resolvers/multiplier.resolver';
import { AdjustmentResolver } from './resolvers/adjustment.resolver';
import { buildSnapshot } from './snapshot.builder';
import { PricingContext, PricingSnapshot } from './pricing.types';
import { DiscountResolver } from '../customer/discount.resolver';
import { SurchargeService } from '../surcharge/surcharge.service';

type MultiplierMode = 'PERCENTAGE' | 'FIXED_SURCHARGE';

type HourlyTier = {
  from_hours?: number;
  to_hours?: number;
  type?: MultiplierMode;
  value?: number;
  surcharge_minor?: number;
};

@Injectable()
export class PricingResolver {
  private readonly logger = new Logger(PricingResolver.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly zoneResolver: ZoneResolver,
    private readonly itemResolver: ItemResolver,
    private readonly multiplierResolver: MultiplierResolver,
    private readonly adjustmentResolver: AdjustmentResolver,
    private readonly discountResolver: DiscountResolver,
    private readonly mapsService: GoogleMapsService,
    private readonly surchargeService: SurchargeService,
  ) {}

  // Estimate toll from route distance (Sydney CityLink rates)
  // Google Maps Distance Matrix doesn't return toll costs directly;
  // we use a per-km estimate based on known Sydney toll corridors.
  // If both pickup + dropoff are provided and toll_enabled, we fetch the
  // actual route distance and apply the estimate.
  private async resolveToll(ctx: PricingContext): Promise<number> {
    if (!ctx.tollEnabled) return 0;
    if (!ctx.pickupAddress || !ctx.dropoffAddress) return 0;
    try {
      const route = await this.mapsService.getRouteWithToll(
        ctx.tenantId,
        ctx.pickupAddress,
        ctx.dropoffAddress,
        ctx.currency,
      );
      if (!route) return 0;
      return route.tollAmountMinor;
    } catch (err) {
      this.logger.warn(`Toll calculation failed: ${(err as Error).message}`);
      return 0;
    }
  }

  private applyMultiplier(
    baseMinor: number,
    type: MultiplierMode,
    value: number,
    surchargeMinor: number,
  ): number {
    if (type === 'PERCENTAGE') {
      return Math.round(baseMinor * (value / 100)) + surchargeMinor;
    }
    return baseMinor + surchargeMinor;
  }

  private findTier(tiers: HourlyTier[], actualHours: number): HourlyTier {
    const sorted = [...tiers].sort(
      (a, b) => (a.from_hours ?? 0) - (b.from_hours ?? 0),
    );
    return (
      sorted.find((tier) => {
        const from = tier.from_hours ?? 0;
        const to = tier.to_hours ?? Number.MAX_SAFE_INTEGER;
        return actualHours >= from && actualHours <= to;
      }) ?? {
        type: 'PERCENTAGE',
        value: 100,
        surcharge_minor: 0,
      }
    );
  }

  async resolve(ctx: PricingContext): Promise<PricingSnapshot> {
    if (ctx.serviceTypeId) {
      return this.resolveV41(ctx);
    }

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

      const tollParkingMinor = await this.resolveToll(ctx);
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
        toll_minor: tollParkingMinor,
        parking_minor: 0,
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

    const tollParkingMinor = await this.resolveToll(ctx);
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
        toll_minor: tollParkingMinor,
        parking_minor: 0,
      grand_total_minor: grandTotalMinor,
      discount_source_customer_id: ctx.customerId ?? null,
    } as PricingSnapshot;
  }

  private async resolveV41(ctx: PricingContext): Promise<PricingSnapshot> {
    const serviceTypeRows = await this.dataSource.query(
      `SELECT id, calculation_type,
              one_way_type, one_way_value, one_way_surcharge_minor,
              return_type, return_value, return_surcharge_minor,
              minimum_hours, km_per_hour_included, hourly_tiers
       FROM public.tenant_service_types
       WHERE tenant_id = $1 AND id = $2`,
      [ctx.tenantId, ctx.serviceTypeId],
    );
    const serviceType = serviceTypeRows[0];

    const classRows = await this.dataSource.query(
      `SELECT id, name,
              base_fare_minor, per_km_minor, per_min_driving_minor,
              minimum_fare_minor, waypoint_minor, infant_seat_minor,
              toddler_seat_minor, booster_seat_minor, hourly_rate_minor
       FROM public.tenant_service_classes
       WHERE tenant_id = $1 AND id = $2`,
      [ctx.tenantId, ctx.serviceClassId],
    );
    const carType = classRows[0];

    const waypoints = Math.max(0, ctx.waypointsCount ?? 0);
    const infantSeats  = Math.max(0, ctx.infantSeats  ?? ctx.babyseatCount ?? 0);
    const toddlerSeats = Math.max(0, ctx.toddlerSeats ?? 0);
    const boosterSeats = Math.max(0, ctx.boosterSeats ?? 0);
    const extras = waypoints * (carType.waypoint_minor ?? 0)
      + infantSeats  * (carType.infant_seat_minor   ?? 0)
      + toddlerSeats * (carType.toddler_seat_minor  ?? 0)
      + boosterSeats * (carType.booster_seat_minor  ?? 0);

    let baseMinor = 0;
    let multiplierMode: MultiplierMode = 'PERCENTAGE';
    let multiplierValue: number | null = null;
    let surchargeMinor = 0;
    let minimumApplied = false;
    let leg1Minor: number | undefined;
    let leg2Minor: number | undefined;
    let combinedBefore: number | undefined;

    if (serviceType?.calculation_type === 'HOURLY_CHARTER' || ctx.bookedHours) {
      // Hourly charter: no return trip concept — price covers the full charter period
      const bookedHours = ctx.bookedHours ?? 0;
      const actualHours = Math.max(bookedHours, serviceType?.minimum_hours ?? 2);
      const includedKm = actualHours * (serviceType?.km_per_hour_included ?? 0);
      const excessKm = Math.max(0, ctx.distanceKm - includedKm);
      const subtotal =
        Math.round(actualHours * (carType.hourly_rate_minor ?? 0)) +
        Math.round(excessKm * (carType.per_km_minor ?? 0));
      const tiers = Array.isArray(serviceType?.hourly_tiers) ? serviceType.hourly_tiers : [];
      const tier = this.findTier(tiers as HourlyTier[], actualHours);
      multiplierMode = (tier.type ?? 'PERCENTAGE') as MultiplierMode;
      multiplierValue = multiplierMode === 'PERCENTAGE' ? (tier.value ?? 100) : null;
      surchargeMinor = tier.surcharge_minor ?? 0;
      baseMinor = this.applyMultiplier(
        subtotal,
        multiplierMode,
        tier.value ?? 100,
        surchargeMinor,
      );
      baseMinor = baseMinor + extras;
      // Skip return logic entirely for hourly charter — fall through to discount+toll resolution below
    } else {
      const leg =
        (carType.base_fare_minor ?? 0) +
        Math.round(ctx.distanceKm * (carType.per_km_minor ?? 0)) +
        Math.round(ctx.durationMinutes * (carType.per_min_driving_minor ?? 0));

      if (ctx.tripType === 'RETURN') {
        leg1Minor = leg;
        const returnDistance = ctx.returnDistanceKm ?? ctx.distanceKm;
        const returnDuration = ctx.returnDurationMinutes ?? ctx.durationMinutes;
        leg2Minor =
          (carType.base_fare_minor ?? 0) +
          Math.round(returnDistance * (carType.per_km_minor ?? 0)) +
          Math.round(returnDuration * (carType.per_min_driving_minor ?? 0));
        combinedBefore = (leg1Minor ?? 0) + (leg2Minor ?? 0);
        multiplierMode = serviceType?.return_type ?? 'PERCENTAGE';
        multiplierValue =
          multiplierMode === 'PERCENTAGE' ? Number(serviceType?.return_value ?? 100) : null;
        surchargeMinor = serviceType?.return_surcharge_minor ?? 0;
        const afterMultiplier = this.applyMultiplier(
          combinedBefore,
          multiplierMode,
          Number(serviceType?.return_value ?? 100),
          surchargeMinor,
        );
        const afterExtras = afterMultiplier + extras;
        const final = Math.max(afterExtras, carType.minimum_fare_minor ?? 0);
        minimumApplied = final === (carType.minimum_fare_minor ?? 0);
        baseMinor = final;
      } else {
        multiplierMode = serviceType?.one_way_type ?? 'PERCENTAGE';
        multiplierValue =
          multiplierMode === 'PERCENTAGE' ? Number(serviceType?.one_way_value ?? 100) : null;
        surchargeMinor = serviceType?.one_way_surcharge_minor ?? 0;
        const afterMultiplier = this.applyMultiplier(
          leg,
          multiplierMode,
          Number(serviceType?.one_way_value ?? 100),
          surchargeMinor,
        );
        const afterExtras = afterMultiplier + extras;
        const final = Math.max(afterExtras, carType.minimum_fare_minor ?? 0);
        minimumApplied = final === (carType.minimum_fare_minor ?? 0);
        baseMinor = final;
      }
    }

    const tollParkingMinor = await this.resolveToll(ctx);

    // ── Time/Holiday surcharges ──────────────────────────────────────
    let timeSurchargeMinor = 0;
    let surchargeLabels: string[] = [];
    if (ctx.pickupAtUtc) {
      const surchargeResult = await this.surchargeService.resolve(
        ctx.tenantId,
        ctx.pickupAtUtc,
        baseMinor,
        ctx.timezone ?? 'Australia/Sydney',
      );
      timeSurchargeMinor = surchargeResult.total_surcharge_minor;
      surchargeLabels = surchargeResult.surcharges.map(s => s.label);
    }

    const fareWithSurcharge = baseMinor + timeSurchargeMinor;

    const discount = await this.discountResolver.resolve(
      ctx.tenantId,
      ctx.customerId ?? null,
      fareWithSurcharge,
    );
    const grandTotalMinor = discount.final_fare_minor + tollParkingMinor;

    return {
      snapshotVersion: 1,
      calculatedAt: new Date().toISOString(),
      pricingMode: 'ITEMIZED',
      resolvedZoneId: null,
      resolvedItemsCount: 0,
      serviceClass: { id: ctx.serviceClassId, name: carType?.name ?? 'Service Class' },
      items: [],
      surgeMultiplier: 1,
      subtotalMinor: baseMinor,
      totalPriceMinor: grandTotalMinor,
      currency: ctx.currency,
      pre_discount_fare_minor: discount.pre_discount_fare_minor,
      discount_type: discount.discount_type,
      discount_value: discount.discount_value,
      discount_amount_minor: discount.discount_amount_minor,
      final_fare_minor: discount.final_fare_minor,
      toll_parking_minor: tollParkingMinor,
      toll_minor: tollParkingMinor,
      parking_minor: 0,
      grand_total_minor: grandTotalMinor,
      discount_source_customer_id: ctx.customerId ?? null,
      base_calculated_minor: ctx.tripType === 'RETURN' ? undefined : baseMinor,
      leg1_minor: leg1Minor,
      leg2_minor: leg2Minor,
      combined_before_multiplier: combinedBefore,
      multiplier_mode: multiplierMode,
      multiplier_value: multiplierValue,
      surcharge_minor: surchargeMinor,
      minimum_applied: minimumApplied,
      time_surcharge_minor: timeSurchargeMinor,
      surcharge_labels: surchargeLabels,
    };
  }
}
