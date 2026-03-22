import { useEffect, useState } from 'react';
import { fetchTenantInfo, fetchServiceTypes, fetchCities, fetchRoute, fetchQuote } from './api';

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

interface City {
  id: string;
  name: string;
  timezone: string;
  lat?: number;
  lng?: number;
}

interface ServiceType {
  id: string;
  name: string;
  calculation_type: string;
  code?: string;
  minimum_hours?: number | null;
  surge_multiplier?: number | null;
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
  const [cities, setCities] = useState<City[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [cityId, setCityId] = useState('');
  const [serviceTypeId, setServiceTypeId] = useState('');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [datetime, setDatetime] = useState('');
  const [returnDatetime, setReturnDatetime] = useState('');
  const [pax, setPax] = useState(1);
  const [bags, setBags] = useState(0);
  const [tripMode, setTripMode] = useState<'ONE_WAY' | 'RETURN'>('ONE_WAY');
  const [durationHours, setDurationHours] = useState('2');
  const [waypoints, setWaypoints] = useState<string[]>([]);
  const [flightNumber, setFlightNumber] = useState('');
  const [returnFlightNumber, setReturnFlightNumber] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [infantSeats, setInfantSeats] = useState('0');
  const [toddlerSeats, setToddlerSeats] = useState('0');
  const [boosterSeats, setBoosterSeats] = useState('0');
  const seatOptions = ['0','1','2','3','4','5'];
  const allowReturnTrip = tenant?.booking_entry?.allow_return_trip ?? true;
  const ws = withDefaults(tenant?.widget_settings ?? null);
  const showReturn = ws.returnTrip;
  const showFlight = ws.flightNumber;
  const showWaypoints = ws.waypoints;
  const showPassengers = ws.passengers;
  const showLuggage = ws.luggage;
  const showBabySeats = ws.babySeats;
  const showPromo = ws.promoCode;

  const selectedCity = cities.find((c) => c.id === cityId);
  const selectedServiceType = serviceTypes.find((s) => s.id === serviceTypeId);
  const isHourly = selectedServiceType?.calculation_type === 'HOURLY_CHARTER';
  const isWedding = selectedServiceType?.code === 'WEDDING_HIRE';
  const minHours = selectedServiceType?.minimum_hours ?? (isHourly ? 2 : null);
  const hasSurge = (selectedServiceType?.surge_multiplier ?? 1) > 1;
  const surgePercent = hasSurge ? Math.round(((selectedServiceType!.surge_multiplier! - 1) * 100)) : 0;
  const effectiveTripMode = isHourly ? 'ONE_WAY' : tripMode;
  const totalSeats = Number(infantSeats) + Number(toddlerSeats) + Number(boosterSeats);
  const seatError = showBabySeats && totalSeats > pax;

  // Quote result
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
  const [routeData, setRouteData] = useState<{ distance_km: number; duration_minutes: number } | null>(null);

  const clearQuote = () => {
    setQuoteData(null);
    setRouteData(null);
    setStep(1);
  };

  const applyTenantTheme = (t: Tenant) => {
    const branding = (t as any).branding ?? (t as any).theme_json?.branding ?? null;
    const root = document.documentElement;
    const primary = branding?.primary_color ?? t.primary_color;
    if (primary) {
      root.style.setProperty('--asc-primary', primary);
      root.style.setProperty('--primary', primary);
      root.style.setProperty('--ring', primary);
      root.style.setProperty('--gold', primary);
    }
    if (branding?.background_color) root.style.setProperty('--background', branding.background_color);
    if (branding?.card_color) root.style.setProperty('--card', branding.card_color);
    if (branding?.text_color) root.style.setProperty('--foreground', branding.text_color);
    if (branding?.muted_text_color) root.style.setProperty('--muted-foreground', branding.muted_text_color);
    if (branding?.border_color) root.style.setProperty('--border', branding.border_color);
    if (branding?.font_family) root.style.setProperty('--font-display', `'${branding.font_family}', Georgia, serif`);
    if (branding?.button_radius != null) root.style.setProperty('--radius-button', `${branding.button_radius}px`);
    if (branding?.card_radius != null) root.style.setProperty('--radius-card', `${branding.card_radius}px`);
    if (branding?.input_radius != null) root.style.setProperty('--radius-input', `${branding.input_radius}px`);
  };

  useEffect(() => {
    fetchTenantInfo(slug)
      .then((t) => {
        setTenant(t);
        applyTenantTheme(t);
      })
      .catch(() => setError('Could not load booking widget.'));

    fetchCities(slug)
      .then((rows) => {
        setCities(rows);
        if (rows.length > 0) setCityId(rows[0].id);
      })
      .catch(() => {});

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
    if (showReturn && effectiveTripMode === 'RETURN' && !returnDatetime) {
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
      if (showReturn && effectiveTripMode === 'RETURN' && !isHourly) {
        const returnWaypoints = [...waypointList].reverse();
        returnRoute = await fetchRoute(slug, dropoff, pickup, returnWaypoints);
      }

      const returnPickupUtc = (showReturn && effectiveTripMode === 'RETURN')
        ? localToUtc(returnDatetime, tenant?.timezone ?? 'Australia/Sydney')
        : undefined;

      const quote = await fetchQuote(slug, {
        city_id: cityId || undefined,
        service_type_id: serviceTypeId,
        trip_mode: showReturn ? effectiveTripMode : 'ONE_WAY',
        pickup_address: pickup,
        dropoff_address: dropoff,
        pickup_at_utc: pickupUtc,
        timezone: tenant?.timezone ?? 'Australia/Sydney',
        passenger_count: showPassengers ? pax : undefined,
        luggage_count: showLuggage ? bags : undefined,
        ...(isHourly ? { duration_hours: Number(durationHours) } : {}),
        distance_km: route.distance_km,
        duration_minutes: route.duration_minutes,
        waypoints_count: showWaypoints ? waypointList.length : 0,
        promo_code: showPromo ? (promoCode.trim().toUpperCase() || undefined) : undefined,
        infant_seats: showBabySeats ? Number(infantSeats) : 0,
        toddler_seats: showBabySeats ? Number(toddlerSeats) : 0,
        booster_seats: showBabySeats ? Number(boosterSeats) : 0,
        flight_number: showFlight ? (flightNumber.trim() || undefined) : undefined,

        // Return leg
        return_pickup_at_utc: (showReturn && effectiveTripMode === 'RETURN' && !isHourly) ? returnPickupUtc : undefined,
        return_waypoints_count: (showReturn && effectiveTripMode === 'RETURN' && !isHourly) ? waypointList.length : undefined,
        return_pickup_address: (showReturn && effectiveTripMode === 'RETURN' && !isHourly) ? dropoff : undefined,
        return_dropoff_address: (showReturn && effectiveTripMode === 'RETURN' && !isHourly) ? pickup : undefined,
        return_distance_km: (showReturn && effectiveTripMode === 'RETURN' && !isHourly) ? returnRoute?.distance_km : undefined,
        return_duration_minutes: (showReturn && effectiveTripMode === 'RETURN' && !isHourly) ? returnRoute?.duration_minutes : undefined,
        return_flight_number: (showReturn && effectiveTripMode === 'RETURN' && showFlight && !isHourly) ? (returnFlightNumber.trim() || undefined) : undefined,
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
          {/* City */}
          {cities.length > 0 && (
            <div className="cw-span-2">
              <div className="cw-label">City</div>
              <select
                value={cityId}
                onChange={(e) => { setCityId(e.target.value); clearQuote(); }}
                className="cw-input"
                style={{
                  backgroundColor: 'hsl(var(--card) / 0.55)',
                  color: 'hsl(var(--foreground))',
                  borderColor: 'hsl(var(--input-border) / 0.7)',
                  WebkitTextFillColor: 'hsl(var(--foreground))',
                }}
              >
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Service Type */}
          {serviceTypes.length > 0 && (
            <div className="cw-span-2">
              <div className="cw-label">Service Type</div>
              <select
                value={serviceTypeId}
                onChange={(e) => { setServiceTypeId(e.target.value); setTripMode('ONE_WAY'); clearQuote(); }}
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

          {/* Service notice */}
          {(isWedding || (isHourly && minHours)) && (
            <div className="cw-alert">
              <span>•</span>
              <span>{isWedding ? `Wedding Hire requires a minimum of ${minHours ?? 4} hours${hasSurge ? ` and includes a ${surgePercent}% special occasion surcharge` : ''}.` : `Hourly Charter minimum is ${minHours} hours.`}</span>
            </div>
          )}

          {/* Trip Type / Duration */}
          {isHourly ? (
            <div className="cw-span-2">
              <div className="cw-label">Duration (hours)</div>
              <select className="cw-input" value={durationHours} onChange={(e)=>{setDurationHours(e.target.value); clearQuote();}}>
                {[2,3,4,5,6,7,8,9,10,12].filter(h=>h>=(minHours??2)).map(h=> (
                  <option key={h} value={String(h)}>{h} hours{h===minHours?' (minimum)':''}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="cw-span-2">
              <div className="cw-label">Trip Type</div>
              <select
                value={effectiveTripMode}
                onChange={(e) => { setTripMode(e.target.value as 'ONE_WAY' | 'RETURN'); clearQuote(); }}
                className="cw-input"
              >
                <option value="ONE_WAY">One Way</option>
                <option value="RETURN">Return</option>
              </select>
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
                    clearQuote();
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
                    clearQuote();
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
              <div className="cw-label">Pickup Location</div>
              <PlacesAutocomplete
                tenantSlug={tenant?.slug ?? slug}
                id="widget-pickup"
                name="widget-pickup"
                value={pickup}
                onChange={(v) => { setPickup(v); clearQuote(); }}
                placeholder="Airport, hotel or address..."
                pinColor="gold"
                cityBias={selectedCity?.lat && selectedCity?.lng ? { lat: selectedCity.lat, lng: selectedCity.lng } : undefined}
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
                          clearQuote();
                        }}
                        placeholder="Intermediate stop..."
                        pinColor="muted"
                        cityBias={selectedCity?.lat && selectedCity?.lng ? { lat: selectedCity.lat, lng: selectedCity.lng } : undefined}
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
                      className="cw-add-stop"
                    >
                      + Add stop
                    </button>
                  )}
                </div>
              </div>
            )}

            <div>
              <div className="cw-label">Drop-off Location <span className="cw-optional">(optional)</span></div>
              <PlacesAutocomplete
                tenantSlug={tenant?.slug ?? slug}
                id="widget-dropoff"
                name="widget-dropoff"
                value={dropoff}
                onChange={(v) => { setDropoff(v); clearQuote(); }}
                placeholder="Airport, hotel or destination..."
                pinColor="muted"
                cityBias={selectedCity?.lat && selectedCity?.lng ? { lat: selectedCity.lat, lng: selectedCity.lng } : undefined}
              />
            </div>
          </div>

          {showReturn && tripMode === 'RETURN' && !isHourly && (
            <div className="cw-span-2" style={{ paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
              <div className="cw-section-label" style={{ marginBottom: 6 }}>Return Trip</div>
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
                      clearQuote();
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
                      clearQuote();
                    }}
                  />
                </div>
              </div>
              <div className="cw-muted" style={{ fontSize: 12, marginTop: 6 }}>Return pickup from drop-off location.</div>

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
            <div className="cw-grid-2">
              {showPassengers && (
                <div>
                  <div className="cw-label">Passengers</div>
                  <div className="cw-stepper-portal">
                    <button type="button" onClick={() => { setPax((p) => Math.max(1, p - 1)); clearQuote(); }}>−</button>
                    <div className="cw-stepper-value-portal">
                      <input type="number" min={1} max={50} value={pax} onChange={(e)=>{const n=Math.max(1,Math.min(50,parseInt(e.target.value)||1)); setPax(n); clearQuote();}} />
                      <span>passengers</span>
                    </div>
                    <button type="button" onClick={() => { setPax((p) => Math.min(50, p + 1)); clearQuote(); }}>+</button>
                  </div>
                </div>
              )}
              {showLuggage && (
                <div>
                  <div className="cw-label">Luggage</div>
                  <div className="cw-stepper-portal">
                    <button type="button" onClick={() => { setBags((b) => Math.max(0, b - 1)); clearQuote(); }}>−</button>
                    <div className="cw-stepper-value-portal">
                      <input type="number" min={0} max={50} value={bags} onChange={(e)=>{const n=Math.max(0,Math.min(50,parseInt(e.target.value)||0)); setBags(n); clearQuote();}} />
                      <span>bags</span>
                    </div>
                    <button type="button" onClick={() => { setBags((b) => Math.min(50, b + 1)); clearQuote(); }}>+</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Baby seats (match portal: dropdowns) */}
          {showBabySeats && (
            <div className="cw-span-2">
              <div className="cw-section-label" style={{ color: '#9ca3af' }}>Baby Seats <span className="cw-optional">(optional)</span></div>
              <div className="cw-seat-grid">
                <div className="cw-seat-col">
                  <div className="cw-seat-label">Infant</div>
                  <div className="cw-seat-sub">Rear-facing · 0–6 months</div>
                  <select className="cw-select" value={infantSeats} onChange={(e) => { setInfantSeats(e.target.value); clearQuote(); }}>
                    {[0,1,2,3].map((v) => (<option key={`infant-${v}`} value={v}>{v}</option>))}
                  </select>
                </div>
                <div className="cw-seat-col">
                  <div className="cw-seat-label">Toddler</div>
                  <div className="cw-seat-sub">Forward-facing · 0–4 yrs</div>
                  <select className="cw-select" value={toddlerSeats} onChange={(e) => { setToddlerSeats(e.target.value); clearQuote(); }}>
                    {[0,1,2,3].map((v) => (<option key={`toddler-${v}`} value={v}>{v}</option>))}
                  </select>
                </div>
                <div className="cw-seat-col">
                  <div className="cw-seat-label">Booster</div>
                  <div className="cw-seat-sub">4–8 years old</div>
                  <select className="cw-select" value={boosterSeats} onChange={(e) => { setBoosterSeats(e.target.value); clearQuote(); }}>
                    {[0,1,2,3].map((v) => (<option key={`booster-${v}`} value={v}>{v}</option>))}
                  </select>
                </div>
              </div>
              {seatError && (
                <div className="cw-seat-error">Baby seats ({totalSeats}) must be less than total passengers ({pax}) — at least 1 adult required.</div>
              )}
            </div>
          )}

          <button onClick={handleGetQuote} disabled={loading || seatError || !pickup || !datetime || !serviceTypeId} className="cw-btn-primary cw-span-2" style={{ marginTop: 14 }}>
            {loading ? 'Calculating…' : <><span>{quoteData ? '↻ Recalculate' : 'Get Instant Quote'}</span><span style={{ marginLeft: 8 }}>→</span></>}
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
