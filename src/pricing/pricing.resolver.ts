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
import { AirportParkingService } from '../surcharge/airport-parking.service';
import { DebugTraceService } from '../debug/debug-trace.service';

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
    private readonly airportParkingService: AirportParkingService,
    private readonly trace?: DebugTraceService,
  ) {}

  // Estimate toll from route distance (Sydney CityLink rates)
  // Google Maps Distance Matrix doesn't return toll costs directly;
  // we use a per-km estimate based on known Sydney toll corridors.
  // If both pickup + dropoff are provided and toll_enabled, we fetch the
  // actual route distance and apply the estimate.
  private async resolveTollForRoute(
    tenantId: string,
    pickupAddress: string | null | undefined,
    dropoffAddress: string | null | undefined,
    currency: string,
    pickupAtUtc: Date | string | null | undefined,
    enabled: boolean,
  ): Promise<number> {
    if (!enabled) return 0;
    if (!pickupAddress || !dropoffAddress) return 0;
    try {
      const route = await this.mapsService.getRouteWithToll(
        tenantId,
        pickupAddress,
        dropoffAddress,
        currency,
        pickupAtUtc ?? null,
      );
      if (!route) return 0;
      return route.tollAmountMinor;
    } catch (err) {
      this.logger.warn(`Toll calculation failed: ${(err as Error).message}`);
      return 0;
    }
  }

  private async resolveToll(ctx: PricingContext): Promise<number> {
    return this.resolveTollForRoute(
      ctx.tenantId,
      ctx.pickupAddress,
      ctx.dropoffAddress,
      ctx.currency,
      ctx.pickupAtUtc ?? null,
      !!ctx.tollEnabled,
    );
  }

  private async resolveParkingForPickup(
    tenantId: string,
    pickupAddress: string | null | undefined,
  ): Promise<number> {
    if (!pickupAddress) return 0;
    try {
      const parkingResult = await this.airportParkingService.resolveParking(
        tenantId,
        pickupAddress,
      );
      return ((parkingResult as { parkingAmountMinor?: number }).parkingAmountMinor ?? parkingResult.fee_minor);
    } catch {
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

  private mergeReturnSurcharges(
    outbound: { surcharges: any[]; total_surcharge_minor: number },
    ret: { surcharges: any[]; total_surcharge_minor: number },
    combinedBaseMinor: number,
  ) {
    const key = (s: any) => `${s.label}::${s.type}::${s.value}`;
    const all = [...(outbound?.surcharges ?? []), ...(ret?.surcharges ?? [])];
    const uniq = new Map<string, any>();
    for (const s of all) {
      if (!s) continue;
      uniq.set(key(s), s);
    }
    const surcharges = Array.from(uniq.values()).map((s: any) => {
      const amount_minor = s.type === 'PERCENTAGE'
        ? Math.round(combinedBaseMinor * (Number(s.value) / 100))
        : Math.round(Number(s.value) * 100);
      return { ...s, amount_minor };
    });
    const total_surcharge_minor = surcharges.reduce((sum, s) => sum + (s.amount_minor ?? 0), 0);
    return { surcharges, total_surcharge_minor };
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

  private calculateReturnableLegMinor(
    baseFareMinor: number,
    distanceKm: number,
    durationMinutes: number,
    perKmMinor: number,
    perMinMinor: number,
    multiplierMode: MultiplierMode,
    multiplierValue: number,
    surchargeMinor: number,
    minimumFareMinor: number,
    waypointMinor: number,
    waypointCount: number,
  ): number {
    const legCore =
      baseFareMinor +
      Math.round(distanceKm * perKmMinor) +
      Math.round(durationMinutes * perMinMinor);
    return Math.max(
      this.applyMultiplier(legCore, multiplierMode, multiplierValue, surchargeMinor),
      minimumFareMinor,
    ) + Math.max(0, waypointCount) * waypointMinor;
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

    const outboundWaypoints = Math.max(0, ctx.waypointsCount ?? 0);
    const returnWaypoints = ctx.tripType === 'RETURN'
      ? Math.max(0, ctx.returnWaypointsCount ?? outboundWaypoints)
      : 0;

    const infantSeats = Math.max(0, ctx.infantSeats ?? ctx.babyseatCount ?? 0);
    const toddlerSeats = Math.max(0, ctx.toddlerSeats ?? 0);
    const boosterSeats = Math.max(0, ctx.boosterSeats ?? 0);

    // Baby seats applied per leg
    const seatLegCount = ctx.tripType === 'RETURN' ? 2 : 1;
    const babySeatsMinor =
      (infantSeats * (carType.infant_seat_minor ?? 0) +
        toddlerSeats * (carType.toddler_seat_minor ?? 0) +
        boosterSeats * (carType.booster_seat_minor ?? 0)) * seatLegCount;

    let baseMinor = 0;
    let multiplierMode: MultiplierMode = 'PERCENTAGE';
    let multiplierValue: number | null = null;
    let surchargeMinor = 0;
    let minimumApplied = false;
    let minimumFareMinor = 0;
    let leg1Minor: number | undefined;
    let leg2Minor: number | undefined;
    let combinedBefore: number | undefined;

    let tollMinor = 0;
    let parkingMinor = 0;
    let timeSurchargeMinor = 0;
    let leg1SurchargeMinor = 0;
    let leg2SurchargeMinor = 0;
    let surchargeLabels: string[] = [];
    let surchargeItems: { label: string; amount_minor: number }[] = [];
    const totalWaypoints = outboundWaypoints + returnWaypoints;

    if (serviceType?.calculation_type === 'HOURLY_CHARTER' || ctx.bookedHours) {
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
      baseMinor = this.applyMultiplier(subtotal, multiplierMode, tier.value ?? 100, surchargeMinor);

      tollMinor = await this.resolveToll(ctx);
      parkingMinor = await this.resolveParkingForPickup(ctx.tenantId, ctx.pickupAddress);
      leg1Minor = baseMinor;
      if (ctx.pickupAtUtc) {
        const sr = await this.surchargeService.resolve(
          ctx.tenantId,
          ctx.pickupAtUtc,
          baseMinor,
          ctx.timezone ?? 'Australia/Sydney',
          ctx.cityId ?? null,
        );
        timeSurchargeMinor = sr.total_surcharge_minor;
        leg1SurchargeMinor = sr.total_surcharge_minor;
        leg2SurchargeMinor = 0;
        surchargeLabels = sr.surcharges.map((s) => s.label);
        surchargeItems = sr.surcharges.map((s) => ({ label: s.label, amount_minor: s.amount_minor }));
      }
    } else {
      const oneWayMode = serviceType?.one_way_type ?? 'PERCENTAGE';
      const oneWayValue = Number(serviceType?.one_way_value ?? 100);
      const oneWaySurcharge = serviceType?.one_way_surcharge_minor ?? 0;
      const minFare = carType.minimum_fare_minor ?? 0;
      minimumFareMinor = minFare;

      const carBase = carType.base_fare_minor ?? 0;
      const perKm = carType.per_km_minor ?? 0;
      const perMin = carType.per_min_driving_minor ?? 0;
      const waypointMinor = carType.waypoint_minor ?? 0;

      const outboundWithWaypoints = this.calculateReturnableLegMinor(
        carBase,
        ctx.distanceKm,
        ctx.durationMinutes,
        perKm,
        perMin,
        oneWayMode as MultiplierMode,
        oneWayValue,
        oneWaySurcharge,
        minFare,
        waypointMinor,
        outboundWaypoints,
      );
      const outboundAfterMultiplier = this.applyMultiplier(
        carBase + Math.round(ctx.distanceKm * perKm) + Math.round(ctx.durationMinutes * perMin),
        oneWayMode as MultiplierMode,
        oneWayValue,
        oneWaySurcharge,
      );
      const outboundAfterMin = Math.max(outboundAfterMultiplier, minFare);

      if (ctx.tripType === 'RETURN') {
        const returnDistance = ctx.returnDistanceKm ?? ctx.distanceKm;
        const returnDuration = ctx.returnDurationMinutes ?? ctx.durationMinutes;

        const returnWithWaypoints = this.calculateReturnableLegMinor(
          carBase,
          returnDistance,
          returnDuration,
          perKm,
          perMin,
          oneWayMode as MultiplierMode,
          oneWayValue,
          oneWaySurcharge,
          minFare,
          waypointMinor,
          returnWaypoints,
        );
        const returnAfterMultiplier = this.applyMultiplier(
          carBase + Math.round(returnDistance * perKm) + Math.round(returnDuration * perMin),
          oneWayMode as MultiplierMode,
          oneWayValue,
          oneWaySurcharge,
        );
        const returnAfterMin = Math.max(returnAfterMultiplier, minimumFareMinor);

        leg1Minor = outboundWithWaypoints;
        leg2Minor = returnWithWaypoints;
        combinedBefore = leg1Minor + leg2Minor;

        // Trip-level return adjustment only after independent leg totals
        multiplierMode = serviceType?.return_type ?? 'PERCENTAGE';
        multiplierValue = multiplierMode === 'PERCENTAGE' ? Number(serviceType?.return_value ?? 100) : null;
        surchargeMinor = serviceType?.return_surcharge_minor ?? 0;
        baseMinor = this.applyMultiplier(
          combinedBefore,
          multiplierMode,
          Number(serviceType?.return_value ?? 100),
          surchargeMinor,
        );

        minimumApplied = outboundAfterMultiplier < minimumFareMinor || returnAfterMultiplier < minimumFareMinor;

        // Leg-specific toll/parking and time-context surcharges
        const returnPickupAt = ctx.returnPickupAtUtc ?? ctx.pickupAtUtc ?? null;

        const returnPickupAddress = ctx.returnPickupAddress ?? ctx.dropoffAddress;
        const returnDropoffAddress = ctx.returnDropoffAddress ?? ctx.pickupAddress;

        const [outToll, retToll] = await Promise.all([
          this.resolveTollForRoute(ctx.tenantId, ctx.pickupAddress, ctx.dropoffAddress, ctx.currency, ctx.pickupAtUtc ?? null, !!ctx.tollEnabled),
          this.resolveTollForRoute(ctx.tenantId, returnPickupAddress, returnDropoffAddress, ctx.currency, returnPickupAt, !!ctx.tollEnabled),
        ]);
        tollMinor = outToll + retToll;

        const [outParking, retParking] = await Promise.all([
          this.resolveParkingForPickup(ctx.tenantId, ctx.pickupAddress),
          this.resolveParkingForPickup(ctx.tenantId, returnPickupAddress),
        ]);
        parkingMinor = outParking + retParking;

        const outboundSr = ctx.pickupAtUtc
          ? await this.surchargeService.resolve(ctx.tenantId, ctx.pickupAtUtc, leg1Minor, ctx.timezone ?? 'Australia/Sydney', ctx.cityId ?? null)
          : { total_surcharge_minor: 0, surcharges: [] as any[] };
        const returnSr = returnPickupAt
          ? await this.surchargeService.resolve(ctx.tenantId, returnPickupAt, leg2Minor, ctx.timezone ?? 'Australia/Sydney', ctx.cityId ?? null)
          : { total_surcharge_minor: 0, surcharges: [] as any[] };

        const merged = this.mergeReturnSurcharges(outboundSr, returnSr, leg1Minor + leg2Minor);
        if ((outboundSr?.surcharges?.length ?? 0) > 0 && (returnSr?.surcharges?.length ?? 0) > 0) {
          this.trace?.traceWarn('return_surcharge_deduped', {
            tenant_id: ctx.tenantId,
            message: 'Return trip surcharge matched on both legs; applied once on combined base',
            context: {
              outbound_labels: outboundSr.surcharges?.map((s: any) => s.label) ?? [],
              return_labels: returnSr.surcharges?.map((s: any) => s.label) ?? [],
              combined_base_minor: leg1Minor + leg2Minor,
            },
          }, true);
        }
        leg1SurchargeMinor = merged.total_surcharge_minor;
        leg2SurchargeMinor = 0; // apply once if any leg qualifies
        timeSurchargeMinor = merged.total_surcharge_minor;
        surchargeItems = merged.surcharges.map((s: any) => ({ label: s.label, amount_minor: s.amount_minor }));
        surchargeLabels = surchargeItems.map((s) => s.label);
      } else {
        multiplierMode = oneWayMode as MultiplierMode;
        multiplierValue = multiplierMode === 'PERCENTAGE' ? oneWayValue : null;
        surchargeMinor = oneWaySurcharge;
        baseMinor = outboundWithWaypoints;
        leg1Minor = outboundWithWaypoints;
        minimumApplied = outboundAfterMultiplier < minimumFareMinor;

        tollMinor = await this.resolveToll(ctx);
        parkingMinor = await this.resolveParkingForPickup(ctx.tenantId, ctx.pickupAddress);
        if (ctx.pickupAtUtc) {
          const sr = await this.surchargeService.resolve(
            ctx.tenantId,
            ctx.pickupAtUtc,
            baseMinor,
            ctx.timezone ?? 'Australia/Sydney',
            ctx.cityId ?? null,
          );
          timeSurchargeMinor = sr.total_surcharge_minor;
          leg1SurchargeMinor = sr.total_surcharge_minor;
          leg2SurchargeMinor = 0;
          surchargeLabels = sr.surcharges.map((s) => s.label);
          surchargeItems = sr.surcharges.map((s) => ({ label: s.label, amount_minor: s.amount_minor }));
        }
      }
    }

    const tollParkingMinor = tollMinor + parkingMinor;
    const fareWithSurcharge = baseMinor + timeSurchargeMinor;
    const discountBaseMinor = fareWithSurcharge + babySeatsMinor;

    const discount = await this.discountResolver.resolve(
      ctx.tenantId,
      ctx.customerId ?? null,
      discountBaseMinor,
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
      toll_minor: tollMinor,
      parking_minor: parkingMinor,
      grand_total_minor: grandTotalMinor,
      discount_source_customer_id: ctx.customerId ?? null,
      extras_minor: babySeatsMinor,
      waypoints_minor: totalWaypoints * (carType.waypoint_minor ?? 0),
      baby_seats_minor: babySeatsMinor,
      base_calculated_minor: ctx.tripType === 'RETURN' ? undefined : baseMinor,
      leg1_minor: leg1Minor,
      leg1_surcharge_minor: leg1SurchargeMinor,
      leg2_minor: leg2Minor,
      leg2_surcharge_minor: leg2SurchargeMinor,
      combined_before_multiplier: combinedBefore,
      multiplier_mode: multiplierMode,
      multiplier_value: multiplierValue,
      surcharge_minor: surchargeMinor,
      minimum_applied: minimumApplied,
      minimum_fare_minor: minimumFareMinor,
      time_surcharge_minor: timeSurchargeMinor,
      surcharge_labels: surchargeLabels,
      surcharge_items: surchargeItems,
    };
  }
}
