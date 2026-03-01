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
}
