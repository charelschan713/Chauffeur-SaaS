import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { IntegrationResolver } from '../integration/integration.resolver';
import { JwtGuard } from '../common/guards/jwt.guard';
import { GoogleMapsService } from './google-maps.service';

@Controller('maps')
@UseGuards(JwtGuard)
export class MapsController {
  constructor(
    private readonly mapsService: GoogleMapsService,
    private readonly integrationResolver: IntegrationResolver,
  ) {}

  @Get('route')
  async getRoute(
    @Query('origin') origin: string,
    @Query('destination') destination: string,
    @Req() req: any,
  ) {
    return this.mapsService.getRoute(req.user.tenant_id, origin, destination);
  }

  @Get('autocomplete')
  async autocomplete(
    @Query('input') input: string,
    @Query('sessiontoken') sessionToken: string,
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Req() req: any,
  ) {
    if (!input?.trim()) return { predictions: [] };

    const integration = await this.integrationResolver.resolve(req.user.tenant_id, 'google_maps');
    if (!integration) return { predictions: [] };

    const paramObj: Record<string, string> = {
      input: input.trim(),
      key: integration.config.api_key,
      types: 'address',
      language: 'en-AU',
      components: 'country:au',
    };
    if (sessionToken) paramObj.sessiontoken = sessionToken;
    // Location bias: restrict results to within ~100km of the selected city
    if (lat && lng) {
      paramObj.location = `${lat},${lng}`;
      paramObj.radius = '100000';   // 100km covers greater metro area
      paramObj.strictbounds = 'true'; // hard-restrict, not just bias
    }
    const params = new URLSearchParams(paramObj);

    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`,
    );
    const data = await res.json();

    if (data.status === 'REQUEST_DENIED') {
      // Places API not enabled on this key — log and return empty
      console.error('[Maps] Places Autocomplete REQUEST_DENIED. Enable "Places API" in Google Cloud Console for this API key. Error:', data.error_message);
      return { predictions: [], error: 'Places API not enabled on Google API key' };
    }
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

  @Get('route/toll')
  async getRouteWithToll(
    @Query('origin') origin: string,
    @Query('destination') destination: string,
    @Query('currency') currency: string,
    @Req() req: any,
  ) {
    return this.mapsService.getRouteWithToll(
      req.user.tenant_id,
      origin,
      destination,
      currency ?? 'AUD',
    );
  }
}
