export interface PricingContext {
  tenantId: string;
  serviceClassId: string;
  distanceKm: number;
  tollEnabled?: boolean;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  durationMinutes: number;
  pickupZoneName?: string;
  dropoffZoneName?: string;
  waypointsCount: number;
  returnWaypointsCount?: number;   // stops on return leg (may differ from outbound)
  babyseatCount: number;
  infantSeats?: number;
  toddlerSeats?: number;
  boosterSeats?: number;
  requestedAtUtc: Date;
  pickupAtUtc?: Date | string | null;  // actual pickup time (for surcharge resolution)
  timezone?: string | null;            // booking city timezone
  cityId?: string | null;
  currency: string;
  customerId?: string | null;
  serviceTypeId?: string | null;
  tripType?: 'ONE_WAY' | 'RETURN';
  returnDistanceKm?: number;
  returnDurationMinutes?: number;
  returnPickupAtUtc?: Date | string | null;
  returnPickupAddress?: string | null;
  returnDropoffAddress?: string | null;
  bookedHours?: number;
}

export interface PricingItemBreakdown {
  type: string;
  unit: string;
  quantity: number;
  unitAmountMinor: number;
  subtotalMinor: number;
}

export interface PricingSnapshot {
  snapshotVersion: 1;
  calculatedAt: string;
  pricingMode: 'ZONE' | 'ITEMIZED';
  resolvedZoneId: string | null;
  resolvedItemsCount: number;
  serviceClass: { id: string; name: string };
  items: PricingItemBreakdown[];
  surgeMultiplier: number;
  subtotalMinor: number;
  totalPriceMinor: number;
  currency: string;
  fare_minor?: number;
  total_fare_minor?: number;
  booked_hours?: number;
  hourly_included_km?: number;
  hourly_excess_km?: number;
  hourly_charge_minor?: number;
  pre_discount_fare_minor?: number;
  discount_type?: 'NONE' | 'TIER' | 'CUSTOM_PERCENT' | 'CUSTOM_FIXED';
  discount_value?: number;
  discount_amount_minor?: number;
  final_fare_minor?: number;
  toll_parking_minor?: number;
  toll_minor?: number;
  parking_minor?: number;
  leg1_toll_minor?: number;
  leg2_toll_minor?: number;
  leg1_parking_minor?: number;
  leg2_parking_minor?: number;
  grand_total_minor?: number;
  discount_source_customer_id?: string | null;
  base_calculated_minor?: number;
  leg1_minor?: number;
  leg1_surcharge_minor?: number;
  leg2_minor?: number;
  leg2_surcharge_minor?: number;
  combined_before_multiplier?: number;
  multiplier_mode?: string;
  multiplier_value?: number | null;
  surcharge_minor?: number;
  minimum_applied?: boolean;
  minimum_fare_minor?: number;
  time_surcharge_minor?: number;
  surcharge_labels?: string[];
  surcharge_items?: { label: string; amount_minor: number }[];
  extras_minor?: number;
  waypoints_minor?: number;
  baby_seats_minor?: number;
}
