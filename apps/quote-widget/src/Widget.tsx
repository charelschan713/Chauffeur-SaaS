import { useEffect, useState } from 'react';
import { fetchTenantInfo, fetchServiceTypes, fetchRoute, fetchQuote } from './api';

interface TenantInfo {
  company_name: string;
  slug: string;
  currency: string;
  timezone: string;
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
  pricing_snapshot_preview: Record<string, unknown>;
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
      const route = await fetchRoute(slug, pickup, dropoff);
      setRouteData(route);
      const pickupUtc = localToUtc(datetime, tenant?.timezone ?? 'Australia/Sydney');
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
        return_distance_km: tripMode === 'RETURN' ? route.distance_km : undefined,
        return_duration_minutes: tripMode === 'RETURN' ? route.duration_minutes : undefined,
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
    if (!quoteData || !routeData) return;
    const payload = {
      service_type_id: serviceTypeId,
      service_class_id: result.service_class_id,
      trip_mode: tripMode,
      pickup_address: pickup,
      dropoff_address: dropoff,
      pickup_at_utc: localToUtc(datetime, tenant?.timezone ?? 'Australia/Sydney'),
      timezone: tenant?.timezone ?? 'Australia/Sydney',
      passenger_count: pax,
      luggage_count: bags,
      quoted_price_minor: result.estimated_total_minor,
      distance_km: result.distance_km,
      duration_minutes: result.duration_minutes,
      return_distance_km: tripMode === 'RETURN' ? result.distance_km : undefined,
      return_duration_minutes: tripMode === 'RETURN' ? result.duration_minutes : undefined,
      quoted_at: quoteData.quoted_at,
      quote_expires_at: quoteData.expires_at,
      currency: result.currency,
    };

    // Build URL params — URL params are the sole source of truth.
    // sessionStorage is cross-origin isolated and will be empty after redirect.
    const params = new URLSearchParams();
    Object.entries(payload).forEach(([k, v]) => params.set(k, String(v)));

    // Portal base URL resolution (priority order):
    // 1. VITE_PORTAL_BASE_URL build-time env (e.g. https://aschauffeured.chauffeurssolution.com)
    // 2. Derive from slug using the chauffeurssolution.com pattern
    const envBase = import.meta.env.VITE_PORTAL_BASE_URL as string | undefined;
    const portalBase = envBase
      ? envBase.replace(/\/$/, '')
      : `https://${slug}.chauffeurssolution.com`;
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
                    {fmt(r.estimated_total_minor, r.currency)}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Estimated price</div>
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
