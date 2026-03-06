import { Injectable, Logger } from '@nestjs/common';
import { IntegrationResolver } from '../integration/integration.resolver';

export interface RouteResult {
  distanceMeters: number;
  distanceKm: number;
  durationSeconds: number;
  durationMinutes: number;
  tollAmountMinor: number;   // actual toll in minor units (cents), 0 if none
  tollCurrency: string;      // e.g. "AUD"
}

@Injectable()
export class GoogleMapsService {
  private readonly logger = new Logger(GoogleMapsService.name);

  // Separate caches for route (no toll) and route+toll
  private readonly routeCache = new Map<string, { result: RouteResult; expiresAt: number }>();
  private readonly tollCache  = new Map<string, { result: RouteResult; expiresAt: number }>();

  constructor(private readonly integrationResolver: IntegrationResolver) {}

  /**
   * Get route distance/duration using the Distance Matrix API with real-time traffic.
   * Uses departure_time + duration_in_traffic when the pickup time is in the future.
   * Does NOT return toll data (use getRouteWithToll for that).
   *
   * @param pickupAt  Optional pickup time (ISO string or Date). If omitted or past, uses 'now'.
   */
  async getRoute(
    tenantId: string,
    origin: string,
    destination: string,
    pickupAt?: Date | string | null,
  ): Promise<RouteResult | null> {
    // Resolve departure time — must be in the future for traffic data
    const now = Date.now();
    const pickupMs = pickupAt ? new Date(pickupAt).getTime() : now;
    // Use future pickup time if it's more than 60s ahead, otherwise use 'now'
    const departureTimeSec = pickupMs > now + 60_000
      ? Math.floor(pickupMs / 1000)
      : Math.floor(now / 1000);

    const cacheKey = `${tenantId}:${origin}:${destination}:${departureTimeSec}`;
    const cached = this.routeCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.result;

    const integration = await this.integrationResolver.resolve(tenantId, 'google_maps');
    if (!integration) {
      this.logger.warn('No Google Maps API key configured');
      return null;
    }

    try {
      const params = new URLSearchParams({
        origins: origin,
        destinations: destination,
        key: integration.config.api_key,
        units: 'metric',
        departure_time: String(departureTimeSec),
        traffic_model: 'best_guess',
      });
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/distancematrix/json?${params}`,
      );
      const data = await res.json();
      if (data.status !== 'OK') {
        this.logger.error(`Google Maps Distance Matrix error: ${data.status}`);
        return null;
      }
      const element = data.rows?.[0]?.elements?.[0];
      if (!element || element.status !== 'OK') {
        this.logger.error(`Route not found: ${element?.status}`);
        return null;
      }

      // Prefer duration_in_traffic (real-time traffic) over duration (historical)
      const durationSec: number =
        element.duration_in_traffic?.value ?? element.duration.value;

      const result: RouteResult = {
        distanceMeters: element.distance.value,
        distanceKm: element.distance.value / 1000,
        durationSeconds: durationSec,
        durationMinutes: Math.ceil(durationSec / 60),
        tollAmountMinor: 0,
        tollCurrency: 'AUD',
      };

      this.logger.log(
        `Route ${origin} → ${destination}: ${result.distanceKm.toFixed(1)}km, ` +
        `${result.durationMinutes}min (traffic: ${element.duration_in_traffic ? 'yes' : 'no'})`,
      );

      this.routeCache.set(cacheKey, { result, expiresAt: Date.now() + 10 * 60 * 1000 });
      return result;
    } catch (err) {
      this.logger.error('Google Maps fetch error', err as Error);
      return null;
    }
  }

  /**
   * Get route WITH actual toll cost using Google Routes API v2.
   * Uses TRAFFIC_AWARE routing + departureTime for real-time traffic.
   * Requires the API key to have Routes API enabled.
   *
   * @param pickupAt  Pickup date/time (ISO string or Date). Used for traffic-aware routing.
   */
  async getRouteWithToll(
    tenantId: string,
    origin: string,
    destination: string,
    currency = 'AUD',
    pickupAt?: Date | string | null,
  ): Promise<RouteResult | null> {
    const now = Date.now();
    const pickupMs = pickupAt ? new Date(pickupAt).getTime() : now;
    const departureTime = new Date(
      pickupMs > now + 60_000 ? pickupMs : now + 60_000
    ).toISOString();

    const cacheKey = `toll:${tenantId}:${currency}:${origin}:${destination}:${Math.floor(pickupMs / 600_000)}`; // 10-min buckets
    const cached = this.tollCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.result;

    const integration = await this.integrationResolver.resolve(tenantId, 'google_maps');
    if (!integration) {
      this.logger.warn('No Google Maps API key configured');
      return null;
    }

    try {
      const apiKey = integration.config.api_key as string;

      // Google Routes API v2 — TRAFFIC_AWARE + TOLLS + departureTime
      const body = {
        origin: { address: origin },
        destination: { address: destination },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',  // real-time traffic
        departureTime,
        extraComputations: ['TOLLS'],
        routeModifiers: {
          avoidTolls: false,
        },
      };

      const res = await fetch(
        'https://routes.googleapis.com/directions/v2:computeRoutes',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask':
              'routes.distanceMeters,routes.duration,routes.staticDuration,routes.travelAdvisory.tollInfo',
          },
          body: JSON.stringify(body),
        },
      );

      const data = await res.json();

      if (!res.ok || !data.routes?.length) {
        this.logger.error(
          `Google Routes API error: ${JSON.stringify(data.error ?? data)}`,
        );
        // Fall back to Distance Matrix with traffic
        return this.getRoute(tenantId, origin, destination, pickupAt);
      }

      const route = data.routes[0];
      const distanceMeters: number = route.distanceMeters ?? 0;

      // duration = traffic-aware travel time; staticDuration = without traffic
      const durationSeconds: number = parseInt(route.duration ?? route.staticDuration ?? '0', 10);

      // Extract toll cost
      let tollAmountMinor = 0;
      let tollCurrency = currency;
      const tollInfo = route.travelAdvisory?.tollInfo;
      if (tollInfo?.estimatedPrice?.length) {
        const priceEntry =
          tollInfo.estimatedPrice.find(
            (p: any) => p.currencyCode?.toUpperCase() === currency.toUpperCase(),
          ) ?? tollInfo.estimatedPrice[0];

        if (priceEntry) {
          tollCurrency = priceEntry.currencyCode ?? currency;
          const units = Number(priceEntry.units ?? 0);
          const nanos = Number(priceEntry.nanos ?? 0);
          const totalAmount = units + nanos / 1_000_000_000;
          tollAmountMinor = Math.round(totalAmount * 100);
        }
      }

      const result: RouteResult = {
        distanceMeters,
        distanceKm: distanceMeters / 1000,
        durationSeconds,
        durationMinutes: Math.ceil(durationSeconds / 60),
        tollAmountMinor,
        tollCurrency,
      };

      this.logger.log(
        `Route (traffic+toll) ${origin} → ${destination}: ${result.distanceKm.toFixed(1)}km, ` +
        `${result.durationMinutes}min, toll: ${tollCurrency} ${(tollAmountMinor / 100).toFixed(2)}, ` +
        `departure: ${departureTime}`,
      );

      this.tollCache.set(cacheKey, { result, expiresAt: Date.now() + 10 * 60 * 1000 });
      return result;
    } catch (err) {
      this.logger.error('Google Routes API fetch error', err as Error);
      // Graceful fallback to Distance Matrix
      return this.getRoute(tenantId, origin, destination, pickupAt);
    }
  }
}
