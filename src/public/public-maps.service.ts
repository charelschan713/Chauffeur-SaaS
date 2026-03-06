import { Injectable, Logger } from '@nestjs/common';
import { GoogleMapsService } from '../maps/google-maps.service';
import { PublicTenantService } from './public-tenant.service';

@Injectable()
export class PublicMapsService {
  private readonly logger = new Logger(PublicMapsService.name);

  constructor(
    private readonly maps: GoogleMapsService,
    private readonly tenantSvc: PublicTenantService,
  ) {}

  async getRoute(slug: string, origin: string, destination: string, pickupAt?: string | null) {
    const tenant = await this.tenantSvc.resolveTenantBySlug(slug);
    const route = await this.maps.getRoute(tenant.id, origin, destination, pickupAt);
    if (!route) return { distance_km: 0, duration_minutes: 0 };
    return {
      distance_km: route.distanceKm,
      duration_minutes: route.durationMinutes,
    };
  }

  async autocomplete(
    slug: string,
    input: string,
    sessionToken?: string,
    lat?: number,
    lng?: number,
  ) {
    if (!input?.trim()) return { predictions: [] };
    const tenant = await this.tenantSvc.resolveTenantBySlug(slug);
    const integration = await this.maps['integrationResolver'].resolve(tenant.id, 'google_maps');
    if (!integration) return { predictions: [] };

    const params = new URLSearchParams({
      input: input.trim(),
      key: integration.config.api_key as string,
      types: 'geocode|establishment',
      language: 'en-AU',
      components: 'country:au',
    });
    if (sessionToken) params.set('sessiontoken', sessionToken);
    // Location bias: soft-bias toward selected city (50km radius, not strict — inter-city routes still work)
    if (lat != null && lng != null) {
      params.set('location', `${lat},${lng}`);
      params.set('radius', '50000');
    }

    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`,
    );
    const data = await res.json();
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      return { predictions: [] };
    }
    return {
      predictions: (data.predictions ?? []).map((p: any) => ({
        place_id: p.place_id,
        description: p.description,
        main_text: p.structured_formatting?.main_text ?? p.description,
        secondary_text: p.structured_formatting?.secondary_text ?? '',
      })),
    };
  }
}
