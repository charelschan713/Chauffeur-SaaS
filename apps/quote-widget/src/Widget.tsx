import { useEffect, useState } from 'react';
import { fetchTenantInfo, fetchServiceTypes, fetchRoute, fetchQuote } from './api';

import { withDefaults, type WidgetSettings } from './widgetConfig';
import { normalizeWaypointsForRoute } from './waypoints';
import PlacesAutocomplete from './components/PlacesAutocomplete';

interface TenantInfo {
  company_name: string;
  slug: string;
  currency: string;
  timezone: string;
  custom_domain?: string | null;
  logo_url: string | null;
  primary_color: string;
  widget_settings?: WidgetSettings | null;
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
  // Backend surcharge logic treats the provided datetime string as *local time* (no timezone conversion).
  // So we deliberately send a naive local datetime string here.
  // Example: "2026-03-21T23:30" → "2026-03-21T23:30:00"
  if (!localDatetime) return '';
  const hasSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(localDatetime);
  return hasSeconds ? localDatetime : `${localDatetime}:00`;
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
  const [returnDatetime, setReturnDatetime] = useState('');
  const [pax, setPax] = useState(2);
  const [bags, setBags] = useState(1);
  const [tripMode, setTripMode] = useState<'ONE_WAY' | 'RETURN'>('ONE_WAY');
  const [waypoints, setWaypoints] = useState<string[]>([]);
  const [flightNumber, setFlightNumber] = useState('');
  const [returnFlightNumber, setReturnFlightNumber] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [infantSeats, setInfantSeats] = useState('0');
  const [toddlerSeats, setToddlerSeats] = useState('0');
  const [boosterSeats, setBoosterSeats] = useState('0');
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
      setError('Please fill in all required fields (pickup, drop-off, date/time, service).');
      return;
    }
    if (showReturn && tripMode === 'RETURN' && !returnDatetime) {
      setError('Please fill in return date & time.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const waypointList = showWaypoints ? normalizeWaypointsForRoute(waypoints) : [];
      const route = await fetchRoute(slug, pickup, dropoff, waypointList);
      setRouteData(route);
      const pickupUtc = localToUtc(datetime, tenant?.timezone ?? 'Australia/Sydney');

      let returnRoute: { distance_km: number; duration_minutes: number } | null = null;
      if (showReturn && tripMode === 'RETURN') {
        const returnWaypoints = [...waypointList].reverse();
        returnRoute = await fetchRoute(slug, dropoff, pickup, returnWaypoints);
      }

      const returnPickupUtc = (showReturn && tripMode === 'RETURN')
        ? localToUtc(returnDatetime, tenant?.timezone ?? 'Australia/Sydney')
        : undefined;

      const effectiveTripMode = showReturn ? tripMode : 'ONE_WAY';

      const quote = await fetchQuote(slug, {
        service_type_id: serviceTypeId,
        trip_mode: effectiveTripMode,
        pickup_address: pickup,
        dropoff_address: dropoff,
        pickup_at_utc: pickupUtc,
        timezone: tenant?.timezone ?? 'Australia/Sydney',
        passenger_count: showPassengers ? pax : undefined,
        luggage_count: showLuggage ? bags : undefined,
        distance_km: route.distance_km,
        duration_minutes: route.duration_minutes,
        waypoints_count: showWaypoints ? waypointList.length : 0,
        promo_code: showPromo ? (promoCode.trim().toUpperCase() || undefined) : undefined,
        infant_seats: showBabySeats ? Number(infantSeats) : 0,
        toddler_seats: showBabySeats ? Number(toddlerSeats) : 0,
        booster_seats: showBabySeats ? Number(boosterSeats) : 0,
        flight_number: showFlight ? (flightNumber.trim() || undefined) : undefined,

        // Return leg
        return_pickup_at_utc: (showReturn && effectiveTripMode === 'RETURN') ? returnPickupUtc : undefined,
        return_waypoints_count: (showReturn && effectiveTripMode === 'RETURN') ? waypointList.length : undefined,
        return_pickup_address: (showReturn && effectiveTripMode === 'RETURN') ? dropoff : undefined,
        return_dropoff_address: (showReturn && effectiveTripMode === 'RETURN') ? pickup : undefined,
        return_distance_km: (showReturn && effectiveTripMode === 'RETURN') ? returnRoute?.distance_km : undefined,
        return_duration_minutes: (showReturn && effectiveTripMode === 'RETURN') ? returnRoute?.duration_minutes : undefined,
        return_flight_number: (showReturn && effectiveTripMode === 'RETURN' && showFlight) ? (returnFlightNumber.trim() || undefined) : undefined,
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
    if (showFlight && flightNumber.trim()) params.set('flight_number', flightNumber.trim());
    if (showReturn && tripMode === 'RETURN' && showFlight && returnFlightNumber.trim()) params.set('return_flight_number', returnFlightNumber.trim());

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
  // Bridge old primary_color into HSL token if provided as hex
  useEffect(() => {
    if (!tenant?.primary_color) return;
    const hex = tenant.primary_color.trim();
    const m = hex.match(/^#?([0-9a-f]{6})$/i);
    if (!m) return;
    const n = parseInt(m[1], 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    // Convert to HSL and set --primary as H S% L%
    const rf = r / 255, gf = g / 255, bf = b / 255;
    const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    const d = max - min;
    if (d !== 0) {
      s = d / (1 - Math.abs(2 * l - 1));
      switch (max) {
        case rf: h = ((gf - bf) / d) % 6; break;
        case gf: h = (bf - rf) / d + 2; break;
        case bf: h = (rf - gf) / d + 4; break;
      }
      h = Math.round(h * 60);
      if (h < 0) h += 360;
    }
    const hs = `${h} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
    document.documentElement.style.setProperty('--primary', hs);
    document.documentElement.style.setProperty('--ring', hs);
  }, [tenant?.primary_color]);
  const ws = withDefaults(tenant?.widget_settings ?? null);
  const showReturn = ws.returnTrip;
  const showFlight = ws.flightNumber;
  const showWaypoints = ws.waypoints;
  const showPassengers = ws.passengers;
  const showLuggage = ws.luggage;
  const showBabySeats = ws.babySeats;
  const showPromo = ws.promoCode;

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


  return (
    <div className="cw-shell">
      {/* Header */}
      <div className="cw-header">
        {tenant?.logo_url && (
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          <img src={tenant.logo_url} alt={tenant.company_name} className="cw-logo" />
        )}
        <div className="cw-section-label">Instant Quote</div>
        <div className="cw-title">{tenant?.company_name ?? 'Instant Quote'}</div>
        <div className="cw-subtitle">Get Your Quote in Seconds</div>
        <div className="cw-muted">Instant Fare Estimate</div>
      </div>

      {error && (
        <div className="cw-error" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="cw-form cw-panel">
          {/* Service Type */}
          {serviceTypes.length > 1 && (
            <div className="cw-span-2">
              <div className="cw-label">Service type</div>
              <select
                value={serviceTypeId}
                onChange={(e) => setServiceTypeId(e.target.value)}
                className="cw-input"
                style={{
                  backgroundColor: 'hsl(var(--card) / 0.55)',
                  color: 'hsl(var(--foreground))',
                  borderColor: 'hsl(var(--input-border) / 0.7)',
                  WebkitTextFillColor: 'hsl(var(--foreground))',
                }}
              >
                {serviceTypes.map((st) => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Trip mode (optional) */}
          {showReturn && (
            <div className="cw-span-2" style={{ display: 'flex', gap: 10 }}>
              {(['ONE_WAY', 'RETURN'] as const).map((m) => {
                const active = tripMode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setTripMode(m)}
                    className={`cw-toggle ${active ? 'cw-toggle-active' : ''}`}
                  >
                    {m === 'ONE_WAY' ? 'One Way' : 'Return'}
                  </button>
                );
              })}
            </div>
          )}

          {/* Date & Time (full width like legacy widget) */}
          <div className="cw-span-2">
            <div className="cw-label">Pickup date & time</div>
            <div className="cw-date-row">
              <div className="cw-date-btn">
                <span>Select date</span>
                <input
                  type="date"
                  value={datetime ? datetime.split('T')[0] : ''}
                  onChange={(e) => {
                    const d = e.target.value;
                    const t = datetime?.split('T')[1] ?? '';
                    setDatetime(d && t ? `${d}T${t}` : (d ? `${d}T` : ''));
                  }}
                />
              </div>
              <div className="cw-date-btn">
                <span>Select time</span>
                <input
                  type="time"
                  value={datetime && datetime.includes('T') ? (datetime.split('T')[1] ?? '').slice(0,5) : ''}
                  onChange={(e) => {
                    const t = e.target.value;
                    const d = datetime?.split('T')[0] ?? '';
                    setDatetime(d && t ? `${d}T${t}` : (t ? `T${t}` : ''));
                  }}
                />
              </div>
            </div>

            {showFlight && (
              <div style={{ marginTop: 10 }}>
                <div className="cw-label">Flight number (optional)</div>
                <input
                  value={flightNumber}
                  onChange={(e) => setFlightNumber(e.target.value)}
                  placeholder="e.g. QF401"
                  className="cw-input"
                  style={{ backgroundColor: 'hsl(var(--card) / 0.55)', color: 'hsl(var(--foreground))', borderColor: 'hsl(var(--input-border) / 0.7)', WebkitTextFillColor: 'hsl(var(--foreground))' }}
                />
              </div>
            )}
          </div>

          {/* Addresses (like legacy widget) */}
          <div className="cw-span-2" style={{ display: 'grid', gap: 12 }}>
            <div>
              <div className="cw-label">Pickup location</div>
              <PlacesAutocomplete
                tenantSlug={tenant?.slug ?? slug}
                id="widget-pickup"
                name="widget-pickup"
                value={pickup}
                onChange={(v) => setPickup(v)}
                placeholder="Airport, hotel or address..."
                pinColor="gold"
              />
            </div>

            {/* Stops (between pickup and drop-off) */}
            {showWaypoints && (
              <div>
                <div className="cw-label">Stops (optional)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {waypoints.map((wp, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <PlacesAutocomplete
                        tenantSlug={tenant?.slug ?? slug}
                        id={`waypoint-${idx}`}
                        name={`waypoint-${idx}`}
                        value={wp}
                        onChange={(v) => {
                          const next = [...waypoints];
                          next[idx] = v;
                          setWaypoints(next);
                        }}
                        placeholder="Intermediate stop..."
                        pinColor="muted"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = waypoints.filter((_, i) => i !== idx);
                          setWaypoints(next);
                        }}
                        className="cw-muted"
                        style={{
                          background: 'transparent',
                          border: 0,
                          cursor: 'pointer',
                          width: 36,
                          height: 36,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 12,
                        }}
                        aria-label="Remove stop"
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {waypoints.length < 5 && (
                    <button
                      type="button"
                      onClick={() => {
                        setWaypoints((prev) => {
                          const next = [...prev, ''];
                          // focus new row on next tick
                          setTimeout(() => {
                            const el = document.querySelector(`#waypoint-${next.length - 1} input`) as HTMLInputElement | null;
                            el?.focus();
                          }, 0);
                          return next;
                        });
                      }}
                      className="cw-muted"
                      style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', textAlign: 'left', padding: '6px 10px', borderRadius: 10 }}
                    >
                      + Add stop
                    </button>
                  )}
                </div>
              </div>
            )}

            <div>
              <div className="cw-label">Drop-off location</div>
              <PlacesAutocomplete
                tenantSlug={tenant?.slug ?? slug}
                id="widget-dropoff"
                name="widget-dropoff"
                value={dropoff}
                onChange={(v) => setDropoff(v)}
                placeholder="Airport, hotel or destination..."
                pinColor="muted"
              />
            </div>
          </div>

          {showReturn && tripMode === 'RETURN' && (
            <div className="cw-span-2" style={{ paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
              <div className="cw-label" style={{ color: 'hsl(var(--primary))' }}>Return trip</div>
              <div className="cw-date-row" style={{ marginTop: 6 }}>
                <div className="cw-date-btn">
                  <span>Select date</span>
                  <input
                    type="date"
                    value={returnDatetime ? returnDatetime.split('T')[0] : ''}
                    onChange={(e) => {
                      const d = e.target.value;
                      const t = returnDatetime?.split('T')[1] ?? '';
                      setReturnDatetime(d && t ? `${d}T${t}` : (d ? `${d}T` : ''));
                    }}
                  />
                </div>
                <div className="cw-date-btn">
                  <span>Select time</span>
                  <input
                    type="time"
                    value={returnDatetime && returnDatetime.includes('T') ? (returnDatetime.split('T')[1] ?? '').slice(0,5) : ''}
                    onChange={(e) => {
                      const t = e.target.value;
                      const d = returnDatetime?.split('T')[0] ?? '';
                      setReturnDatetime(d && t ? `${d}T${t}` : (t ? `T${t}` : ''));
                    }}
                  />
                </div>
              </div>

              {showFlight && (
                <div style={{ marginTop: 10 }}>
                  <div className="cw-label">Return flight (optional)</div>
                  <input
                    value={returnFlightNumber}
                    onChange={(e) => setReturnFlightNumber(e.target.value)}
                    placeholder="e.g. QF402"
                    className="cw-input"
                    style={{ backgroundColor: 'hsl(var(--card) / 0.55)', color: 'hsl(var(--foreground))', borderColor: 'hsl(var(--input-border) / 0.7)', WebkitTextFillColor: 'hsl(var(--foreground))' }}
                  />
                </div>
              )}
            </div>
          )}


          {/* Passengers / Luggage (v2: steppers) */}
          {(showPassengers || showLuggage) && (
            <>
              {showPassengers && (
                <div>
                  <div className="cw-label">Passengers</div>
                  <div className="cw-stepper">
                    <button type="button" onClick={() => setPax((p) => Math.max(1, p - 1))}>−</button>
                    <div className="cw-stepper-value">{pax} pax</div>
                    <button type="button" onClick={() => setPax((p) => Math.min(50, p + 1))}>+</button>
                  </div>
                </div>
              )}
              {showLuggage && (
                <div>
                  <div className="cw-label">Luggage</div>
                  <div className="cw-stepper">
                    <button type="button" onClick={() => setBags((b) => Math.max(0, b - 1))}>−</button>
                    <div className="cw-stepper-value">{bags} bags</div>
                    <button type="button" onClick={() => setBags((b) => Math.min(50, b + 1))}>+</button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Baby seats (v2: 3-column steppers like original) */}
          {showBabySeats && (
            <div className="cw-span-2">
              <div className="cw-label">Baby seats</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <div className="cw-muted" style={{ fontSize: 12, marginBottom: 6 }}>Infant</div>
                  <div className="cw-stepper">
                    <button type="button" onClick={() => setInfantSeats((v) => String(Math.max(0, Number(v) - 1)))}>−</button>
                    <div className="cw-stepper-value">{infantSeats}</div>
                    <button type="button" onClick={() => setInfantSeats((v) => String(Math.min(9, Number(v) + 1)))}>+</button>
                  </div>
                </div>
                <div>
                  <div className="cw-muted" style={{ fontSize: 12, marginBottom: 6 }}>Toddler</div>
                  <div className="cw-stepper">
                    <button type="button" onClick={() => setToddlerSeats((v) => String(Math.max(0, Number(v) - 1)))}>−</button>
                    <div className="cw-stepper-value">{toddlerSeats}</div>
                    <button type="button" onClick={() => setToddlerSeats((v) => String(Math.min(9, Number(v) + 1)))}>+</button>
                  </div>
                </div>
                <div>
                  <div className="cw-muted" style={{ fontSize: 12, marginBottom: 6 }}>Booster</div>
                  <div className="cw-stepper">
                    <button type="button" onClick={() => setBoosterSeats((v) => String(Math.max(0, Number(v) - 1)))}>−</button>
                    <div className="cw-stepper-value">{boosterSeats}</div>
                    <button type="button" onClick={() => setBoosterSeats((v) => String(Math.min(9, Number(v) + 1)))}>+</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <button onClick={handleGetQuote} disabled={loading} className="cw-btn-primary cw-span-2" style={{ marginTop: 14 }}>
            {loading ? 'Calculating…' : <><span>Get Instant Quote</span><span style={{ marginLeft: 8 }}>→</span></>}
          </button>
        </div>
      )}

      {step === 2 && quoteData && (
        <div className="cw-panel">
          <div className="cw-results-header">
            <button onClick={() => setStep(1)} className="cw-back">
              ← Back
            </button>
            <span className="cw-muted">
              {routeData?.distance_km?.toFixed(1)} km · {routeData?.duration_minutes} min
            </span>
          </div>

          {quoteData.results.length === 0 ? (
            <div className="cw-empty">No vehicles available for this route.</div>
          ) : (
            <div className="cw-results">
              {quoteData.results.map((r) => (
                <div key={r.service_class_id} className="cw-card">
                  <div className="cw-card-main">
                    <div className="cw-card-title">{r.service_class_name}</div>
                    <div className="cw-card-price">
                      {fmt(r.pricing_snapshot_preview?.final_fare_minor ?? 0, r.currency)}
                    </div>
                    <div className="cw-card-sub">Estimated price</div>
                    {r.pricing_snapshot_preview ? (
                      <div className="cw-breakdown">
                        {r.pricing_snapshot_preview.leg1_minor != null && (
                          <div className="cw-breakdown-row"><span>Outbound price</span><span>{toMoney(r.pricing_snapshot_preview.leg1_minor, r.currency)}</span></div>
                        )}
                        {(r.pricing_snapshot_preview.leg1_surcharge_minor ?? 0) > 0 && (
                          <div className="cw-breakdown-row"><span>Outbound surcharge</span><span>+{toMoney(r.pricing_snapshot_preview.leg1_surcharge_minor, r.currency)}</span></div>
                        )}
                        {typeof r.pricing_snapshot_preview.leg2_minor === 'number' && r.pricing_snapshot_preview.leg2_minor > 0 && (
                          <>
                            <div className="cw-breakdown-row"><span>Return price</span><span>{toMoney(r.pricing_snapshot_preview.leg2_minor!, r.currency)}</span></div>
                            {(r.pricing_snapshot_preview.leg2_surcharge_minor ?? 0) > 0 && (
                              <div className="cw-breakdown-row"><span>Return surcharge</span><span>+{toMoney(r.pricing_snapshot_preview.leg2_surcharge_minor, r.currency)}</span></div>
                            )}
                          </>
                        )}
                        {(r.pricing_snapshot_preview.toll_minor ?? 0) > 0 && (
                          <div className="cw-breakdown-row"><span>Toll</span><span>+{toMoney(r.pricing_snapshot_preview.toll_minor, r.currency)}</span></div>
                        )}
                        {(r.pricing_snapshot_preview.parking_minor ?? 0) > 0 && (
                          <div className="cw-breakdown-row"><span>Parking</span><span>+{toMoney(r.pricing_snapshot_preview.parking_minor, r.currency)}</span></div>
                        )}
                        {r.pricing_snapshot_preview.discount_amount_minor > 0 && (
                          <div className="cw-breakdown-row cw-breakdown-discount"><span>{r.discount?.name ?? 'Discount'}</span><span>-{toMoney(r.pricing_snapshot_preview.discount_amount_minor, r.currency)}</span></div>
                        )}
                        <div className="cw-breakdown-row cw-breakdown-total"><span>Total</span><span>{toMoney(r.pricing_snapshot_preview.final_fare_minor ?? 0, r.currency)}</span></div>
                      </div>
                    ) : null}
                  </div>
                  <button onClick={() => handleBookNow(r)} className="cw-btn-primary cw-card-cta">Book now</button>
                </div>
              ))}
            </div>
          )}

          <div className="cw-footnote">Prices are estimates. Final price confirmed at booking.</div>
        </div>
      )}
    </div>
  );
}
