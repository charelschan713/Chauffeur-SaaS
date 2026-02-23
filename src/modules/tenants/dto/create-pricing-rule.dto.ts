export class CreatePricingRuleDto {
  vehicle_type_id?: string;
  service_city_id?: string;
  service_type?: string;
  base_fare?: number;
  per_km_rate?: number;
  hourly_rate?: number;
  minimum_fare?: number;
  surge_multiplier?: number;
  is_active?: boolean;
}
