export class CreatePricingRuleDto {
  vehicle_type_id?: string;
  service_city_id?: string;
  service_type?: string;
  surge_multiplier?: number;
  is_active?: boolean;
}
