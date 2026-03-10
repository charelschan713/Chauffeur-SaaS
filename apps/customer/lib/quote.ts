/**
 * @deprecated This module is not used by the main booking flow.
 * BookPageClient.tsx handles quote loading inline via loadQuoteSession().
 * Canonical booking types moved to lib/types/booking.ts.
 * Safe to delete once confirmed no external callers remain.
 * Last audited: Phase 4 — 0 imports found outside this file.
 */
export const QUOTE_STORAGE_KEY = 'asc_quote_payload';
export const QUOTE_TTL_MS = 30 * 60 * 1000; // 30 min

export interface QuotePayload {
  service_type_id: string;
  service_class_id: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_at_utc: string;
  timezone: string;
  passenger_count: number;
  luggage_count: number;
  quoted_price_minor: number;
  distance_km: number;
  duration_minutes: number;
  quoted_at: string;
  quote_expires_at: string;
  currency: string;
}

export function parseQuoteFromParams(params: URLSearchParams): QuotePayload | null {
  const service_class_id = params.get('service_class_id');
  const pickup_address = params.get('pickup_address');
  if (!service_class_id || !pickup_address) return null;

  return {
    service_type_id: params.get('service_type_id') ?? '',
    service_class_id,
    pickup_address,
    dropoff_address: params.get('dropoff_address') ?? '',
    pickup_at_utc: params.get('pickup_at_utc') ?? '',
    timezone: params.get('timezone') ?? 'Australia/Sydney',
    passenger_count: Number(params.get('passenger_count') ?? 1),
    luggage_count: Number(params.get('luggage_count') ?? 0),
    quoted_price_minor: Number(params.get('quoted_price_minor') ?? 0),
    distance_km: Number(params.get('distance_km') ?? 0),
    duration_minutes: Number(params.get('duration_minutes') ?? 0),
    quoted_at: params.get('quoted_at') ?? new Date().toISOString(),
    quote_expires_at: params.get('quote_expires_at') ?? new Date(Date.now() + QUOTE_TTL_MS).toISOString(),
    currency: params.get('currency') ?? 'AUD',
  };
}

export function parseQuoteFromStorage(): QuotePayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(QUOTE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as QuotePayload;
  } catch {
    return null;
  }
}

export function isQuoteValid(payload: QuotePayload): boolean {
  return Date.now() < new Date(payload.quote_expires_at).getTime();
}

export function getMinutesRemaining(payload: QuotePayload): number {
  return Math.max(
    0,
    Math.floor((new Date(payload.quote_expires_at).getTime() - Date.now()) / 60000),
  );
}
