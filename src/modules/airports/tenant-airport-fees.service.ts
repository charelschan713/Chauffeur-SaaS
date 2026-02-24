import { BadRequestException, Injectable } from '@nestjs/common';
import { supabaseAdmin } from '../../config/supabase.config';
import { PlatformAirportsService } from './platform-airports.service';

@Injectable()
export class TenantAirportFeesService {
  constructor(private readonly airportsService: PlatformAirportsService) {}

  async getByTenant(tenant_id: string) {
    const [airportsRes, feesRes] = await Promise.all([
      supabaseAdmin.from('platform_airports').select('*').eq('is_active', true).order('city').order('name'),
      supabaseAdmin.from('tenant_airport_fees').select('*').eq('tenant_id', tenant_id),
    ]);

    if (airportsRes.error) throw new BadRequestException(airportsRes.error.message);
    if (feesRes.error) throw new BadRequestException(feesRes.error.message);

    const feeByAirport = new Map((feesRes.data ?? []).map((f: any) => [f.platform_airport_id, f]));
    return (airportsRes.data ?? []).map((airport: any) => {
      const fee = feeByAirport.get(airport.id);
      return {
        id: fee?.id ?? null,
        tenant_id,
        platform_airport_id: airport.id,
        parking_fee: fee?.parking_fee ?? 0,
        is_active: fee?.is_active ?? false,
        airport,
      };
    });
  }

  async upsert(tenant_id: string, platform_airport_id: string, parking_fee: number, is_active = true) {
    const { data, error } = await supabaseAdmin
      .from('tenant_airport_fees')
      .upsert({ tenant_id, platform_airport_id, parking_fee: parking_fee ?? 0, is_active }, { onConflict: 'tenant_id,platform_airport_id' })
      .select('*, airport:platform_airports(*)')
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async getByAirport(tenant_id: string, platform_airport_id: string) {
    const { data } = await supabaseAdmin
      .from('tenant_airport_fees')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('platform_airport_id', platform_airport_id)
      .eq('is_active', true)
      .maybeSingle();
    return data ?? null;
  }

  async matchAirport(tenant_id: string, address?: string, place_id?: string) {
    const airport = (await this.airportsService.findByPlaceId(place_id)) ?? (await this.airportsService.findByKeyword(address));
    if (!airport) return null;
    const fee = await this.getByAirport(tenant_id, airport.id);
    return { airport, parking_fee: fee?.parking_fee ?? 0, fee_active: fee?.is_active ?? false };
  }
}
