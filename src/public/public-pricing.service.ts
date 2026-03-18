import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PricingResolver } from '../pricing/pricing.resolver';
import { PublicTenantService } from './public-tenant.service';
import { PricingContext } from '../pricing/pricing.types';
import { DiscountService } from '../discount/discount.service';

interface QuoteRequest {
  service_type_id: string;
  trip_mode: 'ONE_WAY' | 'RETURN';
  pickup_address: string;
  dropoff_address: string;
  pickup_at_utc: string;
  timezone: string;
  passenger_count?: number;
  luggage_count?: number;
  distance_km: number;
  duration_minutes: number;
  waypoints_count?: number;
  return_waypoints_count?: number;  // waypoints on return leg (may differ if asymmetric)
  return_pickup_at_utc?: string;
  return_pickup_address?: string;
  return_dropoff_address?: string;
  waiting_minutes?: number;
  infant_seats?: number;
  toddler_seats?: number;
  booster_seats?: number;
  return_distance_km?: number;
  return_duration_minutes?: number;
  promo_code?: string;              // optional promo code from widget
  customerId?: string | null;       // optional — injected from JWT for loyalty discount
}

@Injectable()
export class PublicPricingService {
  constructor(
    private readonly db: DataSource,
    private readonly pricing: PricingResolver,
    private readonly tenantSvc: PublicTenantService,
    private readonly discountSvc: DiscountService,
  ) {}

  private async buildQuoteResults(
    tenant: any,
    dto: QuoteRequest,
  ) {
    // Load all active car types for this tenant
    const carTypes = await this.db.query(
      `SELECT tsc.id, tsc.name
       FROM public.tenant_service_classes tsc
       WHERE tsc.tenant_id = $1 AND tsc.active = true
       ORDER BY tsc.display_order ASC NULLS LAST, tsc.name ASC`,
      [tenant.id],
    );

    // Fetch toll_enabled + waypoint_charge_enabled from service TYPE
    let tollEnabled = false;
    let waypointChargeEnabled = true; // default: charge for waypoints
    if (dto.service_type_id) {
      const [st] = await this.db.query(
        `SELECT toll_enabled, waypoint_charge_enabled FROM public.tenant_service_types WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
        [dto.service_type_id, tenant.id],
      );
      tollEnabled = st?.toll_enabled ?? false;
      waypointChargeEnabled = st?.waypoint_charge_enabled ?? true;
    }

    const results = await Promise.all(
      carTypes.map(async (ct: any) => {
        const ctx: PricingContext = {
          tenantId: tenant.id,
          serviceClassId: ct.id,
          serviceTypeId: dto.service_type_id,
          tripType: dto.trip_mode,
          distanceKm: dto.distance_km,
          durationMinutes: dto.duration_minutes,
          returnDistanceKm: dto.return_distance_km,
          returnDurationMinutes: dto.return_duration_minutes,
          returnPickupAtUtc: dto.return_pickup_at_utc ? new Date(dto.return_pickup_at_utc) : undefined,
          returnPickupAddress: dto.return_pickup_address ?? dto.dropoff_address,
          returnDropoffAddress: dto.return_dropoff_address ?? dto.pickup_address,
          // Outbound stops — pricing resolver handles return stops separately
          waypointsCount: waypointChargeEnabled ? (dto.waypoints_count ?? 0) : 0,
          returnWaypointsCount: waypointChargeEnabled ? (dto.return_waypoints_count ?? 0) : 0,
          babyseatCount:
            (dto.infant_seats ?? 0) +
            (dto.toddler_seats ?? 0) +
            (dto.booster_seats ?? 0),
          infantSeats: dto.infant_seats ?? 0,
          toddlerSeats: dto.toddler_seats ?? 0,
          boosterSeats: dto.booster_seats ?? 0,
          requestedAtUtc: new Date(dto.pickup_at_utc),
          pickupAtUtc: new Date(dto.pickup_at_utc),
          timezone: dto.timezone ?? 'Australia/Sydney',
          currency: tenant.currency,
          customerId: dto.customerId ?? null,
          tollEnabled,
          pickupAddress: dto.pickup_address,
          dropoffAddress: dto.dropoff_address,
        };

        try {
          const snapshot = await this.pricing.resolve(ctx);
          // pricing.resolver already applied tier discount (DiscountResolver)
          const grandTotal = snapshot.grand_total_minor ?? snapshot.totalPriceMinor;
          const tollParkingMinor = (snapshot.toll_minor ?? 0) + (snapshot.parking_minor ?? 0);

          // Pre-discount base = fare before tenant discount (excl. tolls)
          const preDiscountBase = snapshot.pre_discount_fare_minor ?? (grandTotal - tollParkingMinor);

          const tierDiscountMinor = snapshot.discount_amount_minor ?? 0;
          const tierDiscountRate = snapshot.discount_value ?? 0;

          // Tenant discount (promo / auto-apply)
          const tenantDiscountResult = await this.discountSvc.resolveDiscount(
            tenant.id,
            preDiscountBase,
            {
              code: dto.promo_code || undefined,
              serviceTypeId: dto.service_type_id,
              customerId: dto.customerId ?? null,
              isNewCustomer: false,
            },
          );

          const extraDiscountMinor = tenantDiscountResult?.discountMinor ?? 0;
          const totalDiscountMinor = tierDiscountMinor + extraDiscountMinor;
          const finalTotal = grandTotal - extraDiscountMinor;
          const combinedRate = tierDiscountRate + (tenantDiscountResult?.value ?? 0);

          return {
            service_class_id: ct.id,
            service_class_name: ct.name,
            estimated_total_minor: finalTotal,
            distance_km: dto.distance_km,
            duration_minutes: dto.duration_minutes,
            currency: tenant.currency,
            discount: (totalDiscountMinor > 0) ? {
              id:             tenantDiscountResult?.discountId ?? 'tier',
              name:           tierDiscountRate > 0 ? `${combinedRate}% loyalty` : (tenantDiscountResult?.name ?? 'Discount'),
              type:           'PERCENTAGE',
              value:          combinedRate,
              discount_minor: totalDiscountMinor,
              capped_by_max:  tenantDiscountResult?.cappedByMax ?? false,
              max_discount_minor: tenantDiscountResult?.maxDiscountMinor ?? null,
            } : null,
            pricing_snapshot_preview: {
              leg1_minor: snapshot.leg1_minor ?? null,
              leg1_surcharge_minor: snapshot.leg1_surcharge_minor ?? 0,
              leg2_minor: snapshot.leg2_minor ?? null,
              leg2_surcharge_minor: snapshot.leg2_surcharge_minor ?? 0,
              toll_minor: snapshot.toll_minor ?? 0,
              parking_minor: snapshot.parking_minor ?? 0,
              discount_amount_minor: totalDiscountMinor,
              final_fare_minor: finalTotal,
            },
          };
        } catch {
          return null;
        }
      }),
    );

    const validResults = (results.filter(Boolean) as any[]).sort((a, b) => (a?.estimated_total_minor ?? 0) - (b?.estimated_total_minor ?? 0));
    return validResults;
  }

  async quote(slug: string, dto: QuoteRequest) {
    const tenant = await this.tenantSvc.resolveTenantBySlug(slug);
    const results = await this.buildQuoteResults(tenant, dto);
    const quotedAt = new Date();
    const expiresAt = new Date(quotedAt.getTime() + 30 * 60 * 1000);

    const payload = {
      slug,
      tenant_id: tenant.id,
      request: dto,
      results,
      quoted_at: quotedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      currency: tenant.currency,
    };

    const customerId = dto.customerId ?? null;
    const [session] = await this.db.query(
      `INSERT INTO public.quote_sessions (tenant_id, customer_id, payload, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [tenant.id, customerId, JSON.stringify(payload), expiresAt],
    );

    return {
      quote_id: session.id,
      quoted_at: quotedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      currency: tenant.currency,
      results,
    };
  }

  async getQuoteSession(quoteId: string) {
    const [session] = await this.db.query(
      `SELECT id, tenant_id, payload, expires_at, converted, created_at
       FROM public.quote_sessions
       WHERE id = $1 AND expires_at > now()`,
      [quoteId],
    );
    return session ?? null;
  }

  async markConverted(quoteId: string) {
    await this.db.query(
      `UPDATE public.quote_sessions
       SET converted = true
       WHERE id = $1`,
      [quoteId],
    );
  }
}
