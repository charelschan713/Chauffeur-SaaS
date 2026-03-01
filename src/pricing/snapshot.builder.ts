import { PricingItemBreakdown, PricingSnapshot } from './pricing.types';

export function buildSnapshot(params: {
  serviceClassId: string;
  serviceClassName: string;
  pricingMode: 'ZONE' | 'ITEMIZED';
  resolvedZoneId: string | null;
  items: PricingItemBreakdown[];
  surgeMultiplier: number;
  currency: string;
}): PricingSnapshot {
  const subtotal = params.items.reduce(
    (sum, item) => sum + item.subtotalMinor,
    0,
  );
  const total = Math.round(subtotal * params.surgeMultiplier);
  return {
    snapshotVersion: 1,
    calculatedAt: new Date().toISOString(),
    pricingMode: params.pricingMode,
    resolvedZoneId: params.resolvedZoneId,
    resolvedItemsCount: params.items.length,
    serviceClass: {
      id: params.serviceClassId,
      name: params.serviceClassName,
    },
    items: params.items,
    surgeMultiplier: params.surgeMultiplier,
    subtotalMinor: subtotal,
    totalPriceMinor: total,
    currency: params.currency,
  };
}
