import { Injectable } from '@nestjs/common';

@Injectable()
export class GoogleMapsService {
  private readonly apiKey = process.env.GOOGLE_MAPS_API_KEY ?? '';

  async computeRoute(params: {
    origin: { lat: number; lng: number };
    destination: { lat: number; lng: number };
    waypoints?: { lat: number; lng: number }[];
  }): Promise<{
    distance_km: number;
    duration_minutes: number;
    toll_cost: number;
    toll_currency: string;
  }> {
    const body = {
      origin: {
        location: {
          latLng: {
            latitude: params.origin.lat,
            longitude: params.origin.lng,
          },
        },
      },
      destination: {
        location: {
          latLng: {
            latitude: params.destination.lat,
            longitude: params.destination.lng,
          },
        },
      },
      intermediates: (params.waypoints ?? []).map((wp) => ({
        location: {
          latLng: {
            latitude: wp.lat,
            longitude: wp.lng,
          },
        },
      })),
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      extraComputations: ['TOLLS'],
      units: 'METRIC',
    };

    const res = await fetch(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': [
            'routes.distanceMeters',
            'routes.duration',
            'routes.travelAdvisory.tollInfo',
          ].join(','),
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      throw new Error(`Google Maps API error: ${res.status}`);
    }

    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) {
      throw new Error('No route found');
    }

    // Distance (meters to km)
    const distance_km =
      Math.round((route.distanceMeters ?? 0) / 100) / 10;

    // Duration (seconds to minutes)
    const duration_minutes = Math.round(
      parseInt((route.duration ?? '0s').replace('s', '')) / 60,
    );

    // Tolls
    const tollPrices =
      route.travelAdvisory?.tollInfo?.estimatedPrice ?? [];
    const audToll = tollPrices.find(
      (p: any) => p.currencyCode === 'AUD',
    );
    const toll_cost = audToll
      ? parseFloat(audToll.units ?? '0') + (audToll.nanos ?? 0) / 1e9
      : 0;

    return {
      distance_km,
      duration_minutes,
      toll_cost: Math.round(toll_cost * 100) / 100,
      toll_currency: 'AUD',
    };
  }

  // Address to coordinates
  async geocode(
    address: string,
  ): Promise<{
    lat: number;
    lng: number;
    formatted_address: string;
    place_id: string;
  } | null> {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json` +
        `?address=${encodeURIComponent(address)}` +
        `&key=${this.apiKey}` +
        `&region=au`,
    );
    const data = await res.json();
    const result = data.results?.[0];
    if (!result) return null;

    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formatted_address: result.formatted_address,
      place_id: result.place_id,
    };
  }
}
