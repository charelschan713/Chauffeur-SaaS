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

  async getRoute(slug: string, origin: string, destination: string) {
    const tenant = await this.tenantSvc.resolveTenantBySlug(slug);
    const route = await this.maps.getRoute(tenant.id, origin, destination);
    return {
      distance_km: route.distanceKm,
      duration_minutes: route.durationMinutes,
    };
  }
}
