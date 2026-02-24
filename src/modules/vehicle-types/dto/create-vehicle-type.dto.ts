export class CreateVehicleTypeDto {
  type_name?: string;
  description?: string;
  max_luggage?: number;
  max_passengers?: number;
  base_fare?: number;
  per_km_rate?: number;
  per_minute_rate?: number;
  waypoint_fee?: number;
  baby_seat_infant_fee?: number;
  baby_seat_convertible_fee?: number;
  baby_seat_booster_fee?: number;
  max_baby_seats?: number | null;
  included_km_per_hour?: number;
  extra_km_rate?: number;
  hourly_rate?: number;
  minimum_fare?: number;
  currency?: string;
  required_platform_vehicle_ids?: string[];
}
