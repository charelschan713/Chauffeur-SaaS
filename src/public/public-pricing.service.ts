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

  async quote(slug: string, dto: QuoteRequest) {
    const tenant = await this.tenantSvc.resolveTenantBySlug(slug);

    // Load all active car types for this tenant
    const carTypes = await this.db.query(
      `SELECT tsc.id, tsc.name
       FROM public.tenant_service_classes tsc
       WHERE tsc.tenant_id = $1 AND tsc.active = true
       ORDER BY tsc.display_order ASC NULLS LAST, tsc.name ASC`,
      [tenant.id],
    );

    // Fetch toll_enabled from service TYPE
    let tollEnabled = false;
    if (dto.service_type_id) {
      const [st] = await this.db.query(
        `SELECT toll_enabled FROM public.tenant_service_types WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
        [dto.service_type_id, tenant.id],
      );
      tollEnabled = st?.toll_enabled ?? false;
    }

    const quotedAt = new Date();
    const expiresAt = new Date(quotedAt.getTime() + 30 * 60 * 1000);

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
          waypointsCount: dto.waypoints_count ?? 0,
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
          const grandTotal = snapshot.grand_total_minor ?? snapshot.totalPriceMinor;

          // Tolls + parking are NOT discountable — exclude from discount base
          const tollParkingMinor = (snapshot.toll_minor ?? 0) + (snapshot.parking_minor ?? 0);
          const discountableBase = grandTotal - tollParkingMinor;

          // ── Apply discount to discountable base only ──
          const discountResult = await this.discountSvc.resolveDiscount(
            tenant.id,
            discountableBase,
            {
              code:          dto.promo_code,
              serviceTypeId: dto.service_type_id,
              customerId:    dto.customerId ?? null,
              isNewCustomer: false,
            },
          );

          const discountMinor  = discountResult?.discountMinor ?? 0;
          // Final = discounted base + non-discountable tolls/parking
          const finalTotal     = discountResult
            ? (discountResult.finalFareMinor + tollParkingMinor)
            : grandTotal;

          return {
            service_class_id: ct.id,
            service_class_name: ct.name,
            estimated_total_minor: finalTotal,
            distance_km: dto.distance_km,
            duration_minutes: dto.duration_minutes,
            currency: tenant.currency,
            // discount info for display
            discount: discountResult ? {
              id:             discountResult.discountId,
              name:           discountResult.name,
              type:           discountResult.type,
              value:          discountResult.value,
              discount_minor: discountMinor,
              capped_by_max:  discountResult.cappedByMax,
              max_discount_minor: discountResult.maxDiscountMinor,
            } : null,
            pricing_snapshot_preview: {
              base_calculated_minor:
                snapshot.base_calculated_minor ?? snapshot.subtotalMinor,
              multiplier_mode: snapshot.multiplier_mode ?? null,
              multiplier_value: snapshot.multiplier_value ?? null,
              surcharge_minor: snapshot.surcharge_minor ?? 0,
              time_surcharge_minor: snapshot.time_surcharge_minor ?? 0,
              surcharge_labels: snapshot.surcharge_labels ?? [],
              surcharge_items: snapshot.surcharge_items ?? [],
              toll_parking_minor: snapshot.toll_parking_minor ?? 0,
              toll_minor: snapshot.toll_minor ?? 0,
              parking_minor: snapshot.parking_minor ?? 0,
              extras_minor: snapshot.extras_minor ?? 0,
              waypoints_minor: snapshot.waypoints_minor ?? 0,
              baby_seats_minor: snapshot.baby_seats_minor ?? 0,
              pre_discount_total_minor: discountableBase,  // discountable base (excl. toll/parking)
              discount_amount_minor: discountMinor,
              final_fare_minor: finalTotal,
              grand_total_minor: finalTotal,
              minimum_applied: snapshot.minimum_applied ?? false,
            },
          };
        } catch {
          return null;
        }
      }),
    );

    const validResults = results
      .filter(Boolean)
      .sort((a, b) => a!.estimated_total_minor - b!.estimated_total_minor);

    // ── Persist quote session ──────────────────────────────
    const payload = {
      slug,
      tenant_id: tenant.id,
      request: dto,
      results: validResults,
      quoted_at: quotedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      currency: tenant.currency,
    };

    const [session] = await this.db.query(
      `INSERT INTO public.quote_sessions (tenant_id, payload, expires_at)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [tenant.id, JSON.stringify(payload), expiresAt],
    );

    return {
      quote_id: session.id,
      quoted_at: quotedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      currency: tenant.currency,
      results: validResults,
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
