import { useEffect, useState } from 'react';
import { fetchTenantInfo, fetchServiceTypes, fetchRoute, fetchQuote } from './api';

interface TenantInfo {
  company_name: string;
  slug: string;
  currency: string;
  timezone: string;
  custom_domain?: string | null;
  logo_url: string | null;
  primary_color: string;
}

interface ServiceType {
  id: string;
  name: string;
  calculation_type: string;
}

interface QuoteResult {
  service_class_id: string;
  service_class_name: string;
  estimated_total_minor: number;
  currency: string;
  distance_km: number;
  duration_minutes: number;
  discount?: {
    id: string;
    name: string;
    type: string;
    value: number;
    discount_minor: number;
  } | null;
  pricing_snapshot_preview: {
    leg1_minor?: number | null;
    leg1_surcharge_minor?: number | null;
    leg2_minor?: number | null;
    leg2_surcharge_minor?: number | null;
    multiplier_mode?: string | null;
    multiplier_value?: number | null;
    pre_discount_total_minor?: number;
    surcharge_minor?: number;
    surcharge_labels?: string[];
    waypoints_minor?: number;
    baby_seats_minor?: number;
    trip_mode?: 'ONE_WAY' | 'RETURN' | string;
    grand_total_minor?: number;
    final_fare_minor?: number;
    toll_minor?: number;
    parking_minor?: number;
    toll_parking_minor?: number;
    leg1_minor?: number;
    leg1_surcharge_minor?: number;
    leg2_minor?: number;
    leg2_surcharge_minor?: number;
    multiplier_mode?: string;
    multiplier_value?: number;
    discount_type?: string;
    discount_value?: number;
    discount_amount_minor?: number;
    discount_rate?: number;
    discount_name?: string;
    loyalty_applied?: boolean;
  };
}

interface QuoteData {
  quoted_at: string;
  expires_at: string;
  currency: string;
  results: QuoteResult[];
}

function fmt(minor: number, currency: string) {
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

function toMoney(value: unknown, currency: string) {
  const minor = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return fmt(minor, currency);
}

function returnRuleLabel(mode?: string | null, value?: number | null) {
  if (!mode || !value) return null;
  if (mode === 'PERCENTAGE') return `${value}% return rule`;
  if (mode === 'ADD_FIXED') return `+${fmt(value, '')} fixed surcharge`;
  return `${value} ${mode.replace('_', ' ').toLowerCase()} return rule`;
}

function localToUtc(localDatetime: string, tz: string): string {
  // Parse local datetime string, return UTC ISO
  try {
    // Append tz info via Intl — simple approach for V1
    const d = new Date(localDatetime);
    return d.toISOString();
  } catch {
    return new Date(localDatetime).toISOString();
  }
}

export function Widget({ slug }: { slug: string }) {
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [serviceTypeId, setServiceTypeId] = useState('');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [datetime, setDatetime] = useState('');
  const [pax, setPax] = useState(2);
  const [bags, setBags] = useState(1);
  const [tripMode, setTripMode] = useState<'ONE_WAY' | 'RETURN'>('ONE_WAY');
  const [waypoints, setWaypoints] = useState('');
  const allowReturnTrip = tenant?.booking_entry?.allow_return_trip ?? true;

  // Quote result
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
  const [routeData, setRouteData] = useState<{ distance_km: number; duration_minutes: number } | null>(null);

  useEffect(() => {
    fetchTenantInfo(slug)
      .then((t) => {
        setTenant(t);
        document.documentElement.style.setProperty('--asc-primary', t.primary_color);
      })
      .catch(() => setError('Could not load booking widget.'));
    fetchServiceTypes(slug)
      .then((types) => {
        setServiceTypes(types);
        if (types.length > 0) setServiceTypeId(types[0].id);
      });
  }, [slug]);

  async function handleGetQuote() {
    if (!pickup || !dropoff || !datetime || !serviceTypeId) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const waypointList = waypoints
        .split(/\n|\r|\,/)
        .map((w) => w.trim())
        .filter(Boolean);
      const route = await fetchRoute(slug, pickup, dropoff, waypointList);
      setRouteData(route);
      const pickupUtc = localToUtc(datetime, tenant?.timezone ?? 'Australia/Sydney');

      let returnRoute: { distance_km: number; duration_minutes: number } | null = null;
      if (tripMode === 'RETURN') {
        const returnWaypoints = [...waypointList].reverse();
        returnRoute = await fetchRoute(slug, dropoff, pickup, returnWaypoints);
      }

      const quote = await fetchQuote(slug, {
        service_type_id: serviceTypeId,
        trip_mode: tripMode,
        pickup_address: pickup,
        dropoff_address: dropoff,
        pickup_at_utc: pickupUtc,
        timezone: tenant?.timezone ?? 'Australia/Sydney',
        passenger_count: pax,
        luggage_count: bags,
        distance_km: route.distance_km,
        duration_minutes: route.duration_minutes,
        waypoints_count: waypointList.length,
        return_waypoints_count: tripMode === 'RETURN' ? waypointList.length : undefined,
        return_pickup_address: tripMode === 'RETURN' ? dropoff : undefined,
        return_dropoff_address: tripMode === 'RETURN' ? pickup : undefined,
        return_distance_km: tripMode === 'RETURN' ? returnRoute?.distance_km : undefined,
        return_duration_minutes: tripMode === 'RETURN' ? returnRoute?.duration_minutes : undefined,
      });
      setQuoteData(quote);
      setStep(2);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Failed to get quote. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleBookNow(result: QuoteResult) {
    if (!quoteData || !routeData || !quoteData.quote_id) return;

    // Handoff contract for public booking page requires stable quote/carmap identifiers,
    // not a full quote payload in URL (to avoid fragile shared-field coupling).
    const params = new URLSearchParams({
      quote_id: quoteData.quote_id,
      car_type_id: result.service_class_id,
    });

    // Portal base URL resolution (priority order):
    // 1. VITE_PORTAL_BASE_URL build-time env (e.g. https://aschauffeured.chauffeurssolution.com)
    // 2. Derive from slug using the chauffeurssolution.com pattern
    const envBase = import.meta.env.VITE_PORTAL_BASE_URL as string | undefined;
    const customDomain = tenant?.custom_domain ? `https://${tenant.custom_domain}` : null;
    const portalBase = envBase
      ? envBase.replace(/\/$/, '')
      : (customDomain ?? `https://${slug}.chauffeurssolution.com`);
    window.location.href = `${portalBase}/book?${params.toString()}`;
  }

  const primary = tenant?.primary_color ?? '#2563eb';
  const btnStyle = {
    background: primary,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 20px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 14,
    width: '100%',
  };

  const cardStyle = {
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    background: '#fff',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    fontSize: 14,
    boxSizing: 'border-box' as const,
    marginTop: 4,
  };

  const labelStyle = { fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 2 };

  return (
    <div style={{
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: 480,
      margin: '0 auto',
      background: '#f9fafb',
      borderRadius: 16,
      padding: 24,
      boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 20, textAlign: 'center' }}>
        {tenant?.logo_url && (
          <img src={tenant.logo_url} alt={tenant.company_name} style={{ height: 40, marginBottom: 8 }} />
        )}
        <div style={{ fontWeight: 700, fontSize: 18, color: '#111' }}>
          {tenant?.company_name ?? 'Instant Quote'}
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#b91c1c', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Service Type */}
          {serviceTypes.length > 1 && (
            <div>
              <label style={labelStyle}>Service Type</label>
              <select value={serviceTypeId} onChange={(e) => setServiceTypeId(e.target.value)} style={inputStyle}>
                {serviceTypes.map((st) => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Trip mode */}
          <div style={{ display: 'flex', gap: 8 }}>
            {(['ONE_WAY', 'RETURN'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setTripMode(m)}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 8,
                  border: `2px solid ${tripMode === m ? primary : '#e5e7eb'}`,
                  background: tripMode === m ? primary + '15' : '#fff',
                  color: tripMode === m ? primary : '#374151',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {m === 'ONE_WAY' ? 'One Way' : 'Return'}
              </button>
            ))}
          </div>

          {/* Pickup */}
          <div>
            <label style={labelStyle}>📍 Pickup Address</label>
            <input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Enter pickup address" style={inputStyle} />
          </div>

          {/* Dropoff */}
          <div>
            <label style={labelStyle}>🏁 Drop-off Address</label>
            <input value={dropoff} onChange={(e) => setDropoff(e.target.value)} placeholder="Enter destination" style={inputStyle} />
          </div>

          {/* Date & Time */}
          <div>
            <label style={labelStyle}>📅 Date & Time</label>
            <input type="datetime-local" value={datetime} onChange={(e) => setDatetime(e.target.value)} style={inputStyle} />
          </div>

          {/* Waypoints */}
          <div>
            <label style={labelStyle}>🧭 Waypoints (optional, one per line)</label>
            <textarea
              value={waypoints}
              onChange={(e) => setWaypoints(e.target.value)}
              placeholder="Add stops between pickup and drop-off"
              style={{ ...inputStyle, minHeight: 72 }}
            />
          </div>

          {/* Pax + Bags */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>👤 Passengers</label>
              <input type="number" min={1} max={20} value={pax} onChange={(e) => setPax(Number(e.target.value))} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>🧳 Luggage</label>
              <input type="number" min={0} max={20} value={bags} onChange={(e) => setBags(Number(e.target.value))} style={inputStyle} />
            </div>
          </div>

          <button onClick={handleGetQuote} disabled={loading} style={{ ...btnStyle, opacity: loading ? 0.7 : 1, marginTop: 4 }}>
            {loading ? 'Calculating...' : '🔍 Get Quote'}
          </button>
        </div>
      )}

      {step === 2 && quoteData && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => setStep(1)}
              style={{ background: 'none', border: 'none', color: primary, cursor: 'pointer', fontWeight: 600, fontSize: 13, padding: 0 }}
            >
              ← Back
            </button>
            <span style={{ color: '#6b7280', fontSize: 13 }}>
              {routeData?.distance_km?.toFixed(1)} km · {routeData?.duration_minutes} min
            </span>
          </div>

          {quoteData.results.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#6b7280', padding: 24 }}>No vehicles available for this route.</div>
          ) : (
            quoteData.results.map((r) => (
              <div key={r.service_class_id} style={cardStyle}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#111', marginBottom: 2 }}>{r.service_class_name}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: primary }}>
                    {fmt(r.pricing_snapshot_preview?.final_fare_minor ?? 0, r.currency)}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Estimated price</div>
                  {r.pricing_snapshot_preview ? (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 12,
                        color: '#374151',
                        lineHeight: 1.35,
                        display: 'grid',
                        gap: 2,
                        width: 220,
                      }}
                    >
                      {r.pricing_snapshot_preview.leg1_minor != null && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Outbound price</span>
                          <span>{toMoney(r.pricing_snapshot_preview.leg1_minor, r.currency)}</span>
                        </div>
                      )}
                      {(r.pricing_snapshot_preview.leg1_surcharge_minor ?? 0) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Outbound surcharge</span>
                          <span>+{toMoney(r.pricing_snapshot_preview.leg1_surcharge_minor, r.currency)}</span>
                        </div>
                      )}
                      {(r.pricing_snapshot_preview.toll_minor ?? 0) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Outbound toll</span>
                          <span>+{toMoney(r.pricing_snapshot_preview.toll_minor, r.currency)}</span>
                        </div>
                      )}
                      {(r.pricing_snapshot_preview.parking_minor ?? 0) > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Outbound parking</span>
                          <span>+{toMoney(r.pricing_snapshot_preview.parking_minor, r.currency)}</span>
                        </div>
                      )}
                      {typeof r.pricing_snapshot_preview.leg2_minor === 'number' && r.pricing_snapshot_preview.leg2_minor > 0 && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Return price</span>
                            <span>{toMoney(r.pricing_snapshot_preview.leg2_minor!, r.currency)}</span>
                          </div>
                          {(r.pricing_snapshot_preview.leg2_surcharge_minor ?? 0) > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>Return surcharge</span>
                              <span>+{toMoney(r.pricing_snapshot_preview.leg2_surcharge_minor, r.currency)}</span>
                            </div>
                          )}
                          {(r.pricing_snapshot_preview.toll_minor ?? 0) > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>Return toll</span>
                              <span>+{toMoney(r.pricing_snapshot_preview.toll_minor, r.currency)}</span>
                            </div>
                          )}
                          {(r.pricing_snapshot_preview.parking_minor ?? 0) > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>Return parking</span>
                              <span>+{toMoney(r.pricing_snapshot_preview.parking_minor, r.currency)}</span>
                            </div>
                          )}
                        </>
                      )}
                      {r.pricing_snapshot_preview.discount_amount_minor > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#047857' }}>
                          <span>{r.discount?.name ?? 'Discount'}</span>
                          <span>-{toMoney(r.pricing_snapshot_preview.discount_amount_minor, r.currency)}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 2 }}>
                        <span>Total</span>
                        <span>{toMoney(r.pricing_snapshot_preview.final_fare_minor ?? 0, r.currency)}</span>
                      </div>
                    </div>
                  ) : null}
                </div>
                <button
                  onClick={() => handleBookNow(r)}
                  style={{ ...btnStyle, width: 'auto', padding: '10px 16px', marginLeft: 12 }}
                >
                  Book Now →
                </button>
              </div>
            ))
          )}

          <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 8 }}>
            Prices are estimates. Final price confirmed at booking.
          </div>
        </div>
      )}
    </div>
  );
}
