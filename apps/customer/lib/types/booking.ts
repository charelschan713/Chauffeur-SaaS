/**
 * Shared booking types for the customer portal.
 * Extracted from BookPageClient.tsx — used by BookPageClient and sub-components.
 */

export interface QuoteSession {
  id:         string;
  tenant_id:  string;
  payload: {
    slug:    string;
    request: {
      pickup_address:       string;
      dropoff_address:      string;
      pickup_at_utc:        string;
      timezone:             string;
      passenger_count:      number;
      luggage_count?:       number;
      trip_mode:            string;
      service_type_id:      string;
      city_id?:             string;
      infant_seats?:        number;
      toddler_seats?:       number;
      booster_seats?:       number;
      waypoints?:           string[];
      waypoints_count?:     number;
      return_date?:         string;
      return_time?:         string;
      return_pickup_at_utc?: string;
    };
    results: QuoteResult[];
    currency:   string;
    quoted_at:  string;
    expires_at: string;
  };
  expires_at: string;
  converted:  boolean;
}

export interface QuotePricingSnapshot {
  base_calculated_minor:  number;
  toll_parking_minor:     number;
  surcharge_minor:        number;
  surcharge_labels?:      string[];
  surcharge_items?:       { label: string; amount_minor: number }[];
  grand_total_minor:      number;
  minimum_applied:        boolean;
  discount_amount_minor?: number;
  discount_type?:         string;
  discount_value?:        number;
  pre_discount_fare_minor?: number;
  extras_minor?:          number;
  waypoints_minor?:       number;
  baby_seats_minor?:      number;
  toll_minor?:            number;
  parking_minor?:         number;
}

export interface QuoteResult {
  service_class_id:          string;
  service_class_name:        string;
  estimated_total_minor:     number;
  currency:                  string;
  pricing_snapshot_preview:  QuotePricingSnapshot;
}
