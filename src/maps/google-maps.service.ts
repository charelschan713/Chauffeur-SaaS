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
   * Get route distance/duration using the legacy Distance Matrix API.
   * Does NOT return toll data (use getRouteWithToll for that).
   */
  async getRoute(
    tenantId: string,
    origin: string,
    destination: string,
  ): Promise<RouteResult | null> {
    const cacheKey = `${tenantId}:${origin}:${destination}`;
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
      const result: RouteResult = {
        distanceMeters: element.distance.value,
        distanceKm: element.distance.value / 1000,
        durationSeconds: element.duration.value,
        durationMinutes: Math.ceil(element.duration.value / 60),
        tollAmountMinor: 0,
        tollCurrency: 'AUD',
      };
      this.routeCache.set(cacheKey, { result, expiresAt: Date.now() + 15 * 60 * 1000 });
      return result;
    } catch (err) {
      this.logger.error('Google Maps fetch error', err as Error);
      return null;
    }
  }

  /**
   * Get route WITH actual toll cost using Google Routes API v2.
   * Requires the API key to have Routes API enabled.
   * Returns toll_amount_minor in the route's currency (defaults to AUD).
   */
  async getRouteWithToll(
    tenantId: string,
    origin: string,
    destination: string,
    currency = 'AUD',
  ): Promise<RouteResult | null> {
    const cacheKey = `toll:${tenantId}:${currency}:${origin}:${destination}`;
    const cached = this.tollCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.result;

    const integration = await this.integrationResolver.resolve(tenantId, 'google_maps');
    if (!integration) {
      this.logger.warn('No Google Maps API key configured');
      return null;
    }

    try {
      const apiKey = integration.config.api_key as string;

      // Google Routes API v2 — computeRoutes with TOLLS extra computation
      const body = {
        origin: { address: origin },
        destination: { address: destination },
        travelMode: 'DRIVE',
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
            // Request toll info + distance + duration in response
            'X-Goog-FieldMask':
              'routes.distanceMeters,routes.duration,routes.travelAdvisory.tollInfo',
          },
          body: JSON.stringify(body),
        },
      );

      const data = await res.json();

      if (!res.ok || !data.routes?.length) {
        this.logger.error(
          `Google Routes API error: ${JSON.stringify(data.error ?? data)}`,
        );
        // Fall back to Distance Matrix with no toll
        return this.getRoute(tenantId, origin, destination);
      }

      const route = data.routes[0];
      const distanceMeters: number = route.distanceMeters ?? 0;
      const durationSeconds: number = parseInt(route.duration ?? '0', 10);

      // Extract toll cost — Routes API returns estimatedPrice[] per route
      let tollAmountMinor = 0;
      let tollCurrency = currency;
      const tollInfo = route.travelAdvisory?.tollInfo;
      if (tollInfo?.estimatedPrice?.length) {
        // Find matching currency, or fall back to first available
        const priceEntry =
          tollInfo.estimatedPrice.find(
            (p: any) => p.currencyCode?.toUpperCase() === currency.toUpperCase(),
          ) ?? tollInfo.estimatedPrice[0];

        if (priceEntry) {
          tollCurrency = priceEntry.currencyCode ?? currency;
          // units (integer part) + nanos (fractional, 9 decimal places)
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
        `Route ${origin} → ${destination}: ${result.distanceKm.toFixed(1)}km, ` +
        `${result.durationMinutes}min, toll: ${tollCurrency} ${(tollAmountMinor / 100).toFixed(2)}`,
      );

      this.tollCache.set(cacheKey, { result, expiresAt: Date.now() + 15 * 60 * 1000 });
      return result;
    } catch (err) {
      this.logger.error('Google Routes API fetch error', err as Error);
      // Graceful fallback to Distance Matrix
      return this.getRoute(tenantId, origin, destination);
    }
  }
}
