export class CreateBookingDto {
  service_city_id?: string;
  vehicle_type_id?: string;
  service_type?: string;
  pickup_address?: string;
  pickup_lat?: number;
  pickup_lng?: number;
  dropoff_address?: string;
  dropoff_lat?: number;
  dropoff_lng?: number;
  pickup_datetime?: string;
  duration_hours?: number;
  passenger_name?: string;
  passenger_phone?: string;
  passenger_email?: string;
  contact_id?: string;
  crm_passenger_id?: string;
  passenger_count?: number;
  luggage_count?: number;
  flight_number?: string;
  special_requests?: string;
  promo_code?: string;
}
