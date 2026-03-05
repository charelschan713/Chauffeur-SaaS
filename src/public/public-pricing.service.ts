import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PricingResolver } from '../pricing/pricing.resolver';
import { PublicTenantService } from './public-tenant.service';
import { PricingContext } from '../pricing/pricing.types';

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
}

@Injectable()
export class PublicPricingService {
  constructor(
    private readonly db: DataSource,
    private readonly pricing: PricingResolver,
    private readonly tenantSvc: PublicTenantService,
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
          babyseatCount: (dto.infant_seats ?? 0) + (dto.toddler_seats ?? 0) + (dto.booster_seats ?? 0),
          requestedAtUtc: new Date(dto.pickup_at_utc),
          currency: tenant.currency,
          customerId: null,
          tollEnabled,
          pickupAddress: dto.pickup_address,
          dropoffAddress: dto.dropoff_address,
        };

        try {
          const snapshot = await this.pricing.resolve(ctx);
          return {
            service_class_id: ct.id,
            service_class_name: ct.name,
            estimated_total_minor: snapshot.grand_total_minor ?? snapshot.totalPriceMinor,
            distance_km: dto.distance_km,
            duration_minutes: dto.duration_minutes,
            currency: tenant.currency,
            pricing_snapshot_preview: {
              base_calculated_minor: snapshot.base_calculated_minor ?? snapshot.subtotalMinor,
              multiplier_mode: snapshot.multiplier_mode ?? null,
              multiplier_value: snapshot.multiplier_value ?? null,
              surcharge_minor: snapshot.surcharge_minor ?? 0,
              toll_parking_minor: snapshot.toll_parking_minor ?? 0,
              discount_amount_minor: snapshot.discount_amount_minor ?? 0,
              final_fare_minor: snapshot.final_fare_minor ?? snapshot.totalPriceMinor,
              grand_total_minor: snapshot.grand_total_minor ?? snapshot.totalPriceMinor,
              minimum_applied: snapshot.minimum_applied ?? false,
            },
          };
        } catch {
          return null; // skip car types with pricing errors
        }
      }),
    );

    return {
      quoted_at: quotedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      currency: tenant.currency,
      results: results.filter(Boolean).sort(
        (a, b) => (a!.estimated_total_minor) - (b!.estimated_total_minor),
      ),
    };
  }
}
