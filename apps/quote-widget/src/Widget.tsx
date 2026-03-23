import { useEffect, useState } from 'react';
import { fetchTenantInfo, fetchServiceTypes, fetchCities, fetchCarTypes, fetchRoute, fetchQuote } from './api';
import { LuxDateTimePicker } from './components/LuxDateTimePicker';

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

interface CarType {
  id: string;
  name: string;
  max_passengers?: number | null;
  luggage_capacity?: number | null;
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
  const [carTypes, setCarTypes] = useState<CarType[]>([]);
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ pickup?: string; dropoff?: string; datetime?: string; returnDatetime?: string }>({});

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
  const [showExtras, setShowExtras] = useState(false);
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

  const [openBreakdowns, setOpenBreakdowns] = useState<Record<string, boolean>>({});
  const resultsRef = useRef<HTMLDivElement>(null);

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

    fetchCarTypes(slug)
      .then((rows) => {
        setCarTypes(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {});
  }, [slug]);

  async function handleGetQuote() {
    const errors: { pickup?: string; dropoff?: string; datetime?: string; returnDatetime?: string } = {};
    if (!pickup) errors.pickup = 'Please select a pickup location.';
    if (!dropoff) errors.dropoff = 'Please select a drop-off location.';
    if (!datetime || !serviceTypeId) errors.datetime = 'Please select pickup date & time.';
    if (showReturn && effectiveTripMode === 'RETURN' && !returnDatetime) errors.returnDatetime = 'Please select return pickup date & time.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

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
      setOpenBreakdowns({});
      setStep(2);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch {
      setError('Quote unavailable. Please try again.');
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
        <div className="cw-title">Get an Instant Quote</div>
        <div className="cw-subtitle">{tenant?.company_name ?? 'Luxury chauffeur service'}</div>
      </div>

      {error && (
        <div className="cw-error" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="cw-form cw-panel">
          {/* City + Service */}
          {cities.length > 0 && (
            <div className="cw-span-2">
              <div className="cw-label">City</div>
              <select
                value={cityId}
                onChange={(e) => { setCityId(e.target.value); clearQuote(); }}
                className="cw-input"
              >
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {serviceTypes.length > 0 && (
            <div className="cw-span-2">
              <div className="cw-label">Service Type</div>
              <select
                value={serviceTypeId}
                onChange={(e) => { setServiceTypeId(e.target.value); setTripMode('ONE_WAY'); clearQuote(); }}
                className="cw-input"
              >
                {serviceTypes.map((st) => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </select>
            </div>
          )}

          {(isWedding || (isHourly && minHours)) && (
            <div className="cw-alert">
              <span>•</span>
              <span>{isWedding ? `Wedding Hire requires a minimum of ${minHours ?? 4} hours${hasSurge ? ` and includes a ${surgePercent}% special occasion surcharge` : ''}.` : `Hourly Charter minimum is ${minHours} hours.`}</span>
            </div>
          )}

          {isHourly ? (
            <div className="cw-span-2">
              <div className="cw-label">Duration (hours)</div>
              <select className="cw-input" value={durationHours} onChange={(e)=>{setDurationHours(e.target.value); clearQuote();}}>
                {[2,3,4,5,6,7,8,9,10,12].filter(h=>h>=(minHours??2)).map(h=> (
                  <option key={h} value={String(h)}>{h} hours{h===minHours?' (minimum)':''}</option>
                ))}
              </select>
            </div>
          ) : null}

          {/* Route */}
          <div className="cw-span-2 cw-group">
            <div className="cw-group-title">Route</div>
            <div className="cw-field">
              <div className="cw-label">Pickup</div>
              <PlacesAutocomplete
                tenantSlug={tenant?.slug ?? slug}
                id="widget-pickup"
                name="widget-pickup"
                value={pickup}
                onChange={(v) => { setPickup(v); clearQuote(); setFieldErrors((e)=>({ ...e, pickup: undefined })); }}
                placeholder="Enter pickup location"
                pinColor="gold"
                cityBias={selectedCity?.lat && selectedCity?.lng ? { lat: selectedCity.lat, lng: selectedCity.lng } : undefined}
              />
              {fieldErrors.pickup && <div className="cw-field-error">{fieldErrors.pickup}</div>}
            </div>

            {showWaypoints && (
              <div className="cw-field">
                <div className="cw-label">Stops (optional)</div>
                <div className="cw-stack">
                  {waypoints.map((wp, idx) => (
                    <div key={idx} className="cw-inline">
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
                        className="cw-icon-btn"
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

            <div className="cw-field">
              <div className="cw-label">Drop-off</div>
              <PlacesAutocomplete
                tenantSlug={tenant?.slug ?? slug}
                id="widget-dropoff"
                name="widget-dropoff"
                value={dropoff}
                onChange={(v) => { setDropoff(v); clearQuote(); setFieldErrors((e)=>({ ...e, dropoff: undefined })); }}
                placeholder="Enter drop-off location"
                pinColor="muted"
                cityBias={selectedCity?.lat && selectedCity?.lng ? { lat: selectedCity.lat, lng: selectedCity.lng } : undefined}
              />
              {fieldErrors.dropoff && <div className="cw-field-error">{fieldErrors.dropoff}</div>}
            </div>
          </div>

          {/* Time */}
          <div className="cw-span-2 cw-group">
            <div className="cw-group-title">Date & Time</div>
            <LuxDateTimePicker
              dateValue={datetime ? datetime.split('T')[0] : ''}
              timeValue={datetime && datetime.includes('T') ? (datetime.split('T')[1] ?? '').slice(0,5) : ''}
              onDateChange={(v)=>{ const t = datetime?.split('T')[1] ?? ''; setDatetime(v && t ? `${v}T${t}` : (v ? `${v}T` : '')); clearQuote(); setFieldErrors((e)=>({ ...e, datetime: undefined })); }}
              onTimeChange={(v)=>{ const d = datetime?.split('T')[0] ?? ''; setDatetime(d && v ? `${d}T${v}` : (v ? `T${v}` : '')); clearQuote(); setFieldErrors((e)=>({ ...e, datetime: undefined })); }}
              minDate={new Date().toISOString().slice(0,10)}
            />
            {fieldErrors.datetime && <div className="cw-field-error">{fieldErrors.datetime}</div>}
          </div>

          {/* Return Trip */}
          {showReturn && !isHourly && allowReturnTrip && (
            <div className="cw-span-2 cw-group">
              <div className="cw-group-title">Return Trip</div>
              <button
                type="button"
                className={`cw-toggle ${tripMode === 'RETURN' ? 'cw-toggle-active' : ''}`}
                onClick={() => {
                  const next = tripMode === 'RETURN' ? 'ONE_WAY' : 'RETURN';
                  setTripMode(next as 'ONE_WAY' | 'RETURN');
                  if (next === 'RETURN' && !returnDatetime && datetime) {
                    setReturnDatetime(datetime);
                  }
                  clearQuote();
                }}
              >
                Return Trip
              </button>
              {tripMode === 'RETURN' && (
                <div className="cw-field" style={{ marginTop: 12 }}>
                  <LuxDateTimePicker
                    dateValue={returnDatetime ? returnDatetime.split('T')[0] : ''}
                    timeValue={returnDatetime && returnDatetime.includes('T') ? (returnDatetime.split('T')[1] ?? '').slice(0,5) : ''}
                    onDateChange={(v)=>{ const t = returnDatetime?.split('T')[1] ?? ''; setReturnDatetime(v && t ? `${v}T${t}` : (v ? `${v}T` : '')); clearQuote(); setFieldErrors((e)=>({ ...e, returnDatetime: undefined })); }}
                    onTimeChange={(v)=>{ const d = returnDatetime?.split('T')[0] ?? ''; setReturnDatetime(d && v ? `${d}T${v}` : (v ? `T${v}` : '')); clearQuote(); setFieldErrors((e)=>({ ...e, returnDatetime: undefined })); }}
                    minDate={(datetime ? datetime.split('T')[0] : '') || new Date().toISOString().slice(0,10)}
                  />
                  {fieldErrors.returnDatetime && <div className="cw-field-error">{fieldErrors.returnDatetime}</div>}
                </div>
              )}
            </div>
          )}

          {/* Capacity */}
          {(showPassengers || showLuggage) && (
            <div className="cw-span-2 cw-group">
              <div className="cw-group-title">Capacity</div>
              <div className="cw-grid-2">
                {showPassengers && (
                  <div>
                    <div className="cw-label">Passengers</div>
                    <div className="cw-stepper-portal">
                      <button type="button" onClick={() => { setPax((p) => Math.max(1, p - 1)); clearQuote(); }}>−</button>
                      <div className="cw-stepper-value-portal">
                        <input type="number" min={1} max={50} value={pax} onChange={(e)=>{const n=Math.max(1,Math.min(50,parseInt(e.target.value)||1)); setPax(n); clearQuote();}} />
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
                      </div>
                      <button type="button" onClick={() => { setBags((b) => Math.min(50, b + 1)); clearQuote(); }}>+</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Extras */}
          {(showBabySeats || showFlight || showPromo) && (
            <div className="cw-span-2 cw-group">
              <div className="cw-group-title">Extras</div>
              <button
                type="button"
                className={`cw-toggle ${showExtras ? 'cw-toggle-active' : ''}`}
                onClick={() => setShowExtras((v) => !v)}
              >
                Child seats & extras
              </button>
              {showExtras && (
                <div className="cw-stack" style={{ marginTop: 12 }}>
                  {showBabySeats && (
                    <div>
                      <div className="cw-label">Child Seats</div>
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

                  {showFlight && (
                    <div>
                      <div className="cw-label">Flight Details</div>
                      <input
                        value={flightNumber}
                        onChange={(e) => setFlightNumber(e.target.value)}
                        placeholder="Flight number"
                        className="cw-input"
                      />
                      {showReturn && tripMode === 'RETURN' && (
                        <input
                          value={returnFlightNumber}
                          onChange={(e) => setReturnFlightNumber(e.target.value)}
                          placeholder="Return flight number"
                          className="cw-input"
                          style={{ marginTop: 10 }}
                        />
                      )}
                    </div>
                  )}

                  {showPromo && (
                    <div>
                      <div className="cw-label">Promo Code</div>
                      <input
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        placeholder="Promo code"
                        className="cw-input"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <button onClick={handleGetQuote} disabled={loading || seatError || !pickup || !datetime || !serviceTypeId} className="cw-btn-primary cw-span-2" style={{ marginTop: 14 }}>
            {loading ? 'Calculating…' : <><span>{quoteData ? 'Update Quote' : 'Get Quote'}</span><span style={{ marginLeft: 8 }}>→</span></>}
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

          <div className="cw-results-title">Available Vehicles</div>

          {quoteData.results.length === 0 ? (
            <div className="cw-empty">No vehicles available for this route.</div>
          ) : (
            <div className="cw-results">
              {quoteData.results.map((r) => {
                const open = !!openBreakdowns[r.service_class_id];
                return (
                  <div key={r.service_class_id} className="cw-card">
                    <div className="cw-card-main">
                      <div className="cw-card-title">{r.service_class_name}</div>
                      <div className="cw-card-meta">
                        {(() => {
                          const ct = carTypes.find(c => c.id === r.service_class_id);
                          const paxLabel = ct?.max_passengers ? `${ct.max_passengers} passengers` : null;
                          const bagLabel = ct?.luggage_capacity ? `${ct.luggage_capacity} luggage` : null;
                          if (!paxLabel && !bagLabel) return null;
                          return <span>{[paxLabel, bagLabel].filter(Boolean).join(' · ')}</span>;
                        })()}
                      </div>
                      <div className="cw-card-price">
                        {fmt(r.pricing_snapshot_preview?.final_fare_minor ?? 0, r.currency)}
                      </div>
                      <div className="cw-card-sub">Total</div>

                      <button
                        type="button"
                        className="cw-breakdown-toggle"
                        onClick={() => setOpenBreakdowns((s) => ({ ...s, [r.service_class_id]: !open }))}
                      >
                        {open ? 'Hide price details' : 'Show price details'}
                      </button>

                      {open && r.pricing_snapshot_preview ? (
                        <div className="cw-breakdown">
                          {(() => {
                            const snap = r.pricing_snapshot_preview;
                            const leg1 = snap.leg1_minor ?? 0;
                            const leg2 = snap.leg2_minor ?? 0;
                            const leg1S = snap.leg1_surcharge_minor ?? 0;
                            const leg2S = snap.leg2_surcharge_minor ?? 0;
                            const leg1Toll = (snap as any).leg1_toll_minor ?? 0;
                            const leg2Toll = (snap as any).leg2_toll_minor ?? 0;
                            const tollTotal = snap.toll_minor ?? 0;
                            const parking = snap.parking_minor ?? 0;
                            const hasSplitToll = leg1Toll > 0 || leg2Toll > 0;
                            const discount = snap.discount_amount_minor ?? 0;
                            return (
                              <>
                                {leg1 > 0 && <div className="cw-breakdown-row"><span>Outbound price</span><span>{toMoney(leg1, r.currency)}</span></div>}
                                {leg1S > 0 && <div className="cw-breakdown-row"><span>Outbound surcharge</span><span>+{toMoney(leg1S, r.currency)}</span></div>}
                                {hasSplitToll ? (leg1Toll > 0 && <div className="cw-breakdown-row"><span>Outbound toll</span><span>+{toMoney(leg1Toll, r.currency)}</span></div>) : (tollTotal > 0 && <div className="cw-breakdown-row"><span>Outbound toll</span><span>+{toMoney(tollTotal, r.currency)}</span></div>)}

                                {leg2 > 0 && (
                                  <>
                                    <div className="cw-breakdown-row"><span>Return price</span><span>{toMoney(leg2, r.currency)}</span></div>
                                    {leg2S > 0 && <div className="cw-breakdown-row"><span>Return surcharge</span><span>+{toMoney(leg2S, r.currency)}</span></div>}
                                    {hasSplitToll && leg2Toll > 0 && <div className="cw-breakdown-row"><span>Return toll</span><span>+{toMoney(leg2Toll, r.currency)}</span></div>}
                                  </>
                                )}

                                {parking > 0 && <div className="cw-breakdown-row"><span>Parking</span><span>+{toMoney(parking, r.currency)}</span></div>}
                                {discount > 0 && <div className="cw-breakdown-row cw-breakdown-discount"><span>{r.discount?.name ?? 'Discount'}</span><span>-{toMoney(discount, r.currency)}</span></div>}
                                <div className="cw-breakdown-row cw-breakdown-total"><span>Total</span><span>{toMoney(snap.final_fare_minor ?? 0, r.currency)}</span></div>
                              </>
                            );
                          })()}
                        </div>
                      ) : null}
                    </div>
                    <div className="cw-card-reassure">Secure booking in minutes</div>
                    <button onClick={() => handleBookNow(r)} className="cw-btn-primary cw-card-cta">Book Now</button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="cw-footnote">Prices are estimates. Final price confirmed at booking.</div>
        </div>
      )}
    </div>
  );
}
