import { Injectable, Logger } from '@nestjs/common';
import { IntegrationResolver } from '../integration/integration.resolver';

export interface RouteResult {
  distanceMeters: number;
  distanceKm: number;
  durationSeconds: number;
  durationMinutes: number;
}

@Injectable()
export class GoogleMapsService {
  private readonly logger = new Logger(GoogleMapsService.name);
  private readonly cache = new Map<string, { result: RouteResult; expiresAt: number }>();

  constructor(private readonly integrationResolver: IntegrationResolver) {}

  async getRoute(
    tenantId: string,
    origin: string,
    destination: string,
  ): Promise<RouteResult | null> {
    const cacheKey = `${tenantId}:${origin}:${destination}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }

    const integration = await this.integrationResolver.resolve(
      tenantId,
      'google_maps',
    );
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
        this.logger.error(`Google Maps API error: ${data.status}`);
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
      };
      this.cache.set(cacheKey, {
        result,
        expiresAt: Date.now() + 15 * 60 * 1000,
      });
      return result;
    } catch (err) {
      this.logger.error('Google Maps fetch error', err as Error);
      return null;
    }
  }
}
