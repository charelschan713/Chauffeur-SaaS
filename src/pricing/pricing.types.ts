export interface PricingContext {
  tenantId: string;
  serviceClassId: string;
  distanceKm: number;
  durationMinutes: number;
  pickupZoneName?: string;
  dropoffZoneName?: string;
  waypointsCount: number;
  babyseatCount: number;
  requestedAtUtc: Date;
  currency: string;
  customerId?: string | null;
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
  pre_discount_fare_minor?: number;
  discount_type?: 'NONE' | 'TIER' | 'CUSTOM_PERCENT' | 'CUSTOM_FIXED';
  discount_value?: number;
  discount_amount_minor?: number;
  final_fare_minor?: number;
  toll_parking_minor?: number;
  grand_total_minor?: number;
  discount_source_customer_id?: string | null;
}
