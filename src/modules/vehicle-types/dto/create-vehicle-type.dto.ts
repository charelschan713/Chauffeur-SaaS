export class CreateVehicleTypeDto {
  type_name?: string;
  description?: string;
  max_luggage?: number;
  base_fare?: number;
  per_km_rate?: number;
  per_minute_rate?: number;
  included_km_per_hour?: number;
  extra_km_rate?: number;
  hourly_rate?: number;
  minimum_fare?: number;
  currency?: string;
  vehicle_ids?: string[];
}
