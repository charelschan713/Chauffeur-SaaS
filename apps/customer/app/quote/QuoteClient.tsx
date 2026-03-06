'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { useTenant } from '@/components/TenantProvider';
import { cn, fmtMoney } from '@/lib/utils';
import {
  MapPin, Clock, Users, Luggage, ArrowRight, ArrowLeft,
  ChevronDown, Plane, RotateCcw, Car, AlertCircle, CheckCircle2,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://chauffeur-saas-production.up.railway.app';

function getTenantSlug() {
  if (typeof document === 'undefined') return 'aschauffeured';
  const fromCookie = document.cookie.split('; ').find(r => r.startsWith('tenant_slug='))?.split('=')[1];
  const fromHost = window.location.hostname.split('.')[0];
  return fromCookie || fromHost || 'aschauffeured';
}

// ── Types ──────────────────────────────────────────────────────────────────
type City        = { id: string; name: string; timezone: string };
type ServiceType = { id: string; name: string; code: string; calculation_type: string };
type CarType     = {
  id: string; name: string; vehicle_class: string; max_passengers: number;
  luggage_capacity: number; base_price_minor: number; currency: string;
  estimated_total_minor?: number; pre_discount_total_minor?: number;
  discount_amount_minor?: number; surcharge_labels?: string[];
  toll_parking_minor?: number;
};
type QuoteResult = CarType & { service_class_id: string };

// ── Address Autocomplete ───────────────────────────────────────────────────
function AddressInput({
  value, onChange, placeholder, cityId,
}: {
  value: string; onChange: (v: string) => void; placeholder: string; cityId?: string;
}) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const search = useCallback(async (q: string) => {
    if (q.length < 3) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ input: q, tenant_slug: getTenantSlug() });
      if (cityId) params.set('city_id', cityId);
      const res = await fetch(`${API_URL}/public/maps/autocomplete?${params}`);
      const data = await res.json();
      setSuggestions(data?.predictions ?? []);
      setOpen(true);
    } catch { setSuggestions([]); }
    finally { setLoading(false); }
  }, [cityId]);

  return (
    <div className="relative">
      <input
        className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[hsl(var(--primary)/0.6)] focus:bg-white/8 transition-all"
        placeholder={placeholder}
        value={value}
        onChange={e => {
          onChange(e.target.value);
          clearTimeout(debounce.current);
          debounce.current = setTimeout(() => search(e.target.value), 350);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {loading && <div className="absolute right-3 top-3 w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-[hsl(228,12%,12%)] border border-white/10 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => (
            <li key={i}
              className="px-4 py-2.5 text-sm text-white/80 hover:bg-white/8 cursor-pointer border-b border-white/5 last:border-0 transition-colors"
              onMouseDown={() => { onChange(s.description); setOpen(false); setSuggestions([]); }}>
              <span className="text-white/40 mr-2">📍</span>{s.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Stepper ────────────────────────────────────────────────────────────────
function Stepper({ label, value, onChange, min = 0, max = 20 }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-white/60">{label}</span>
      <div className="flex items-center gap-3">
        <button onClick={() => onChange(Math.max(min, value - 1))}
          className="w-7 h-7 rounded-full border border-white/20 text-white/60 hover:border-white/40 hover:text-white flex items-center justify-center text-base leading-none transition-colors">−</button>
        <span className="w-5 text-center text-sm font-medium text-white">{value}</span>
        <button onClick={() => onChange(Math.min(max, value + 1))}
          className="w-7 h-7 rounded-full border border-white/20 text-white/60 hover:border-white/40 hover:text-white flex items-center justify-center text-base leading-none transition-colors">+</button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export function QuoteClient() {
  const router = useRouter();
  const { token } = useAuthStore();
  const tenant = useTenant();

  // Config
  const [cities, setCities]               = useState<City[]>([]);
  const [serviceTypes, setServiceTypes]   = useState<ServiceType[]>([]);
  const [loading, setLoading]             = useState(true);
  const [loadError, setLoadError]         = useState(false);

  // Form
  const [cityId, setCityId]               = useState('');
  const [serviceTypeId, setServiceTypeId] = useState('');
  const [tripType, setTripType]           = useState<'ONE_WAY'|'RETURN'>('ONE_WAY');
  const [pickup, setPickup]               = useState('');
  const [dropoff, setDropoff]             = useState('');
  const [date, setDate]                   = useState('');
  const [time, setTime]                   = useState('');
  const [returnDate, setReturnDate]       = useState('');
  const [returnTime, setReturnTime]       = useState('');
  const [passengers, setPassengers]       = useState(1);
  const [luggage, setLuggage]             = useState(0);
  const [infantSeats, setInfantSeats]     = useState(0);
  const [toddlerSeats, setToddlerSeats]   = useState(0);
  const [boosterSeats, setBoosterSeats]   = useState(0);
  const [flightNumber, setFlightNumber]   = useState('');
  const [durationHours, setDurationHours] = useState(2);

  // Quote
  const [quoting, setQuoting]             = useState(false);
  const [results, setResults]             = useState<QuoteResult[]>([]);
  const [selected, setSelected]           = useState<QuoteResult | null>(null);
  const [quoteError, setQuoteError]       = useState('');
  const [autoDiscount, setAutoDiscount]   = useState<{ name: string; rate: number } | null>(null);

  const selectedCity = cities.find(c => c.id === cityId);
  const selectedST   = serviceTypes.find(s => s.id === serviceTypeId);
  const isHourly     = selectedST?.calculation_type === 'HOURLY_CHARTER';
  const isP2P        = selectedST?.code === 'POINT_TO_POINT';

  // Generate time options (5-min intervals)
  const timeOptions = Array.from({ length: 288 }, (_, i) => {
    const h = Math.floor(i / 12);
    const m = (i % 12) * 5;
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    const ampm = h < 12 ? 'AM' : 'PM';
    const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return { value: `${hh}:${mm}`, label: `${h12}:${mm} ${ampm}` };
  });

  // Load config
  useEffect(() => {
    const slug = getTenantSlug();
    setLoading(true);
    Promise.all([
      fetch(`${API_URL}/public/cities?tenant_slug=${slug}`).then(r => r.json()),
      fetch(`${API_URL}/public/service-types?tenant_slug=${slug}`).then(r => r.json()),
    ]).then(([c, s]) => {
      const vc = Array.isArray(c) ? c : [];
      const vs = Array.isArray(s) ? s.filter((x: any) => x.name) : [];
      setCities(vc);
      setServiceTypes(vs);
      if (vc.length) setCityId(vc[0].id);
      if (vs.length) setServiceTypeId(vs[0].id);
    }).catch(() => setLoadError(true))
      .finally(() => setLoading(false));
    // Auto-discount (non-blocking)
    fetch(`${API_URL}/public/discounts/auto?tenant_slug=${slug}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.name) setAutoDiscount({ name: d.name, rate: Number(d.discount_value) }); })
      .catch(() => {});
  }, []);

  // Get Quote
  const handleGetQuote = useCallback(async () => {
    if (!pickup || !date || !time) { setQuoteError('Please fill pickup address, date and time.'); return; }
    if (!isHourly && !dropoff) { setQuoteError('Please fill dropoff address.'); return; }

    // 12-hour advance check
    const slug = getTenantSlug();
    const tz   = selectedCity?.timezone ?? 'Australia/Sydney';
    const dtMs = new Date(`${date}T${time}:00`).getTime();
    if (dtMs - Date.now() < 12 * 3600 * 1000) {
      setQuoteError('Bookings require at least 12 hours advance notice.');
      return;
    }

    setQuoteError('');
    setQuoting(true);
    setResults([]);
    setSelected(null);

    try {
      const body: any = {
        tenant_slug: slug,
        city_id: cityId,
        service_type_id: serviceTypeId,
        trip_type: tripType,
        pickup_address: pickup,
        dropoff_address: isHourly ? '' : dropoff,
        pickup_date: date,
        pickup_time: time,
        timezone: tz,
        passenger_count: passengers,
        luggage_count: luggage,
        infant_seats: infantSeats,
        toddler_seats: toddlerSeats,
        booster_seats: boosterSeats,
        flight_number: flightNumber || null,
        duration_hours: isHourly ? durationHours : undefined,
      };
      if (tripType === 'RETURN') {
        body.return_date = returnDate;
        body.return_time = returnTime;
      }
      if (token) {
        body.customer_id_hint = 'me'; // backend resolves from token
      }

      const res = await fetch(`${API_URL}/public/pricing/quote?tenant_slug=${slug}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Quote failed');
      const data = await res.json();
      const r: QuoteResult[] = (data.results ?? []).map((r: any) => ({
        ...r,
        id: r.service_class_id,
        name: r.service_class_name ?? r.name,
      }));
      setResults(r);
      if (r.length) setSelected(r[0]);
    } catch {
      setQuoteError('Failed to get a quote. Please try again.');
    } finally {
      setQuoting(false);
    }
  }, [pickup, dropoff, date, time, returnDate, returnTime, cityId, serviceTypeId,
      tripType, passengers, luggage, infantSeats, toddlerSeats, boosterSeats,
      flightNumber, durationHours, isHourly, selectedCity, token]);

  // Book Now
  const handleBook = useCallback(() => {
    if (!selected) return;
    // Find the quote_id from the most recent quote fetch
    // We need to re-use the quote session — store it in state
    if (!quoteId) return;
    router.push(`/book?quote_id=${quoteId}&car_type_id=${selected.service_class_id}`);
  }, [selected, router]);

  const [quoteId, setQuoteId] = useState<string | null>(null);

  // Re-do quote to also capture session id
  const handleGetQuoteWithSession = useCallback(async () => {
    if (!pickup || !date || !time) { setQuoteError('Please fill pickup address, date and time.'); return; }
    if (!isHourly && !dropoff) { setQuoteError('Please fill dropoff address.'); return; }

    const dtMs = new Date(`${date}T${time}:00`).getTime();
    if (dtMs - Date.now() < 12 * 3600 * 1000) {
      setQuoteError('Bookings require at least 12 hours advance notice.');
      return;
    }

    setQuoteError('');
    setQuoting(true);
    setResults([]);
    setSelected(null);
    setQuoteId(null);

    const slug = getTenantSlug();
    const tz   = selectedCity?.timezone ?? 'Australia/Sydney';

    try {
      const body: any = {
        tenant_slug: slug,
        city_id: cityId,
        service_type_id: serviceTypeId,
        trip_type: tripType,
        pickup_address: pickup,
        dropoff_address: isHourly ? '' : dropoff,
        pickup_date: date,
        pickup_time: time,
        timezone: tz,
        passenger_count: passengers,
        luggage_count: luggage,
        infant_seats: infantSeats,
        toddler_seats: toddlerSeats,
        booster_seats: boosterSeats,
        flight_number: flightNumber || null,
        duration_hours: isHourly ? durationHours : undefined,
      };
      if (tripType === 'RETURN') {
        body.return_date = returnDate;
        body.return_time = returnTime;
      }

      const res = await fetch(`${API_URL}/public/pricing/quote?tenant_slug=${slug}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Quote failed');
      const data = await res.json();
      setQuoteId(data.quote_id ?? data.id ?? null);
      const r: QuoteResult[] = (data.results ?? []).map((r: any) => ({
        ...r,
        id: r.service_class_id,
        name: r.service_class_name ?? r.name,
      }));
      setResults(r);
      if (r.length) setSelected(r[0]);
    } catch {
      setQuoteError('Failed to get a quote. Please try again.');
    } finally {
      setQuoting(false);
    }
  }, [pickup, dropoff, date, time, returnDate, returnTime, cityId, serviceTypeId,
      tripType, passengers, luggage, infantSeats, toddlerSeats, boosterSeats,
      flightNumber, durationHours, isHourly, selectedCity, token]);

  const fmtFee = (m?: number) => m ? ` + ${fmtMoney(m, 'AUD')} tolls/parking` : '';

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white/20 border-t-[hsl(var(--primary))] rounded-full animate-spin" />
    </div>
  );

  if (loadError) return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-3">
        <AlertCircle className="h-10 w-10 text-red-400 mx-auto" />
        <p className="text-white/70">Unable to load booking options.</p>
        <button onClick={() => window.location.reload()} className="text-sm text-[hsl(var(--primary))] underline">Try again</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[hsl(228,12%,8%)] border-b border-white/8 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-white/60 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-semibold text-white">Get a Quote</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">

        {/* Auto-discount banner */}
        {autoDiscount && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-400/8 border border-emerald-400/20">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-300">{autoDiscount.rate}% {autoDiscount.name}</p>
              <p className="text-[11px] text-emerald-400/70 mt-0.5">Applied automatically — no code needed</p>
            </div>
          </div>
        )}

        {/* City + Service Type */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-white/50 mb-1.5 font-medium uppercase tracking-wide">City</label>
            <select value={cityId} onChange={e => setCityId(e.target.value)}
              className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white appearance-none focus:outline-none focus:border-[hsl(var(--primary)/0.6)] transition-colors">
              {cities.map(c => <option key={c.id} value={c.id} className="bg-gray-900">{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1.5 font-medium uppercase tracking-wide">Service Type</label>
            <select value={serviceTypeId} onChange={e => setServiceTypeId(e.target.value)}
              className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white appearance-none focus:outline-none focus:border-[hsl(var(--primary)/0.6)] transition-colors">
              {serviceTypes.map(s => <option key={s.id} value={s.id} className="bg-gray-900">{s.name}</option>)}
            </select>
          </div>
        </div>

        {/* Trip Type (P2P only) */}
        {isP2P && (
          <div className="flex rounded-xl overflow-hidden border border-white/10">
            {(['ONE_WAY', 'RETURN'] as const).map(t => (
              <button key={t} onClick={() => setTripType(t)}
                className={cn('flex-1 py-2.5 text-sm font-medium transition-all',
                  tripType === t
                    ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                    : 'text-white/50 hover:text-white/80')}>
                {t === 'ONE_WAY' ? 'One Way' : '⇄ Return'}
              </button>
            ))}
          </div>
        )}

        {/* Addresses */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-white/50 mb-1.5 font-medium uppercase tracking-wide flex items-center gap-1.5">
              <MapPin className="h-3 w-3" /> Pickup Address
            </label>
            <AddressInput value={pickup} onChange={setPickup} placeholder="Enter pickup location" cityId={cityId} />
          </div>
          {!isHourly && (
            <div>
              <label className="block text-xs text-white/50 mb-1.5 font-medium uppercase tracking-wide flex items-center gap-1.5">
                <MapPin className="h-3 w-3" /> Dropoff Address
              </label>
              <AddressInput value={dropoff} onChange={setDropoff} placeholder="Enter dropoff location" cityId={cityId} />
            </div>
          )}
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/50 mb-1.5 font-medium uppercase tracking-wide">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              min={new Date(Date.now() + 12 * 3600 * 1000).toISOString().split('T')[0]}
              className="w-full h-11 px-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-[hsl(var(--primary)/0.6)] transition-colors [color-scheme:dark]" />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1.5 font-medium uppercase tracking-wide">Time</label>
            <select value={time} onChange={e => setTime(e.target.value)}
              className="w-full h-11 px-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white appearance-none focus:outline-none focus:border-[hsl(var(--primary)/0.6)] transition-colors">
              <option value="" className="bg-gray-900">Select time</option>
              {timeOptions.map(o => <option key={o.value} value={o.value} className="bg-gray-900">{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* Return date/time */}
        {tripType === 'RETURN' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/50 mb-1.5 font-medium uppercase tracking-wide">Return Date</label>
              <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)}
                min={date || new Date().toISOString().split('T')[0]}
                className="w-full h-11 px-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-[hsl(var(--primary)/0.6)] transition-colors [color-scheme:dark]" />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1.5 font-medium uppercase tracking-wide">Return Time</label>
              <select value={returnTime} onChange={e => setReturnTime(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white appearance-none focus:outline-none focus:border-[hsl(var(--primary)/0.6)] transition-colors">
                <option value="" className="bg-gray-900">Select time</option>
                {timeOptions.map(o => <option key={o.value} value={o.value} className="bg-gray-900">{o.label}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Duration (Hourly) */}
        {isHourly && (
          <div>
            <label className="block text-xs text-white/50 mb-1.5 font-medium uppercase tracking-wide">Duration (hours)</label>
            <select value={String(durationHours)} onChange={e => setDurationHours(Number(e.target.value))}
              className="w-full h-11 px-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white appearance-none focus:outline-none focus:border-[hsl(var(--primary)/0.6)] transition-colors">
              {[2,3,4,5,6,7,8,9,10].map(h => <option key={h} value={h} className="bg-gray-900">{h} hours</option>)}
            </select>
          </div>
        )}

        {/* Passengers & Luggage */}
        <div className="rounded-xl bg-white/4 border border-white/8 px-4 py-4 space-y-3">
          <Stepper label="Passengers" value={passengers} onChange={setPassengers} min={1} max={20} />
          <Stepper label="Luggage" value={luggage} onChange={setLuggage} max={20} />
          <div className="border-t border-white/8 pt-3 space-y-2">
            <p className="text-xs text-white/40 font-medium uppercase tracking-wide">Baby Seats</p>
            <Stepper label="Infant (0–6m)" value={infantSeats} onChange={setInfantSeats} />
            <Stepper label="Toddler (0–4yrs)" value={toddlerSeats} onChange={setToddlerSeats} />
            <Stepper label="Booster (4–8yrs)" value={boosterSeats} onChange={setBoosterSeats} />
          </div>
        </div>

        {/* Flight Number */}
        <div>
          <label className="block text-xs text-white/50 mb-1.5 font-medium uppercase tracking-wide flex items-center gap-1.5">
            <Plane className="h-3 w-3" /> Flight Number <span className="normal-case text-white/30">(optional)</span>
          </label>
          <input value={flightNumber} onChange={e => setFlightNumber(e.target.value)}
            placeholder="e.g. QF 401"
            className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[hsl(var(--primary)/0.6)] transition-colors" />
        </div>

        {/* Error */}
        {quoteError && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />{quoteError}
          </div>
        )}

        {/* Get Quote Button */}
        <button onClick={handleGetQuoteWithSession} disabled={quoting}
          className={cn(
            'w-full h-12 rounded-xl font-semibold text-sm tracking-wide transition-all duration-300',
            'bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.8)] text-[hsl(var(--primary-foreground))]',
            'hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed',
            quoting && 'animate-pulse',
          )}>
          {quoting ? 'Getting Quote…' : 'Get Quote →'}
        </button>

        {/* Car Type Cards */}
        {results.length > 0 && (
          <div className="space-y-3 pt-2">
            <p className="text-xs text-white/40 font-medium uppercase tracking-wide">Select Your Vehicle</p>
            {results.map(r => {
              const isSelected = selected?.service_class_id === r.service_class_id;
              const hasDiscount = r.discount_amount_minor && r.discount_amount_minor > 0;
              return (
                <div key={r.service_class_id}
                  onClick={() => setSelected(r)}
                  className={cn(
                    'rounded-xl border cursor-pointer transition-all p-4 space-y-3',
                    isSelected
                      ? 'border-[hsl(var(--primary)/0.6)] bg-[hsl(var(--primary)/0.06)]'
                      : 'border-white/8 bg-white/3 hover:border-white/20',
                  )}>
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      {r.vehicle_class && (
                        <span className="inline-block text-[10px] font-semibold tracking-widest uppercase text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.2)] rounded-full px-2 py-0.5 mb-1.5">
                          {r.vehicle_class}
                        </span>
                      )}
                      <p className="font-semibold text-white text-sm">{r.name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {hasDiscount && (
                        <p className="text-xs text-white/30 line-through">{fmtMoney(r.pre_discount_total_minor ?? 0, r.currency ?? 'AUD')}</p>
                      )}
                      <p className="text-lg font-bold text-[hsl(var(--primary))]">{fmtMoney(r.estimated_total_minor ?? 0, r.currency ?? 'AUD')}</p>
                      {hasDiscount && (
                        <p className="text-[10px] text-emerald-400">−{fmtMoney(r.discount_amount_minor ?? 0, r.currency ?? 'AUD')} saved</p>
                      )}
                      {/* Radio */}
                      <div className={cn('w-4 h-4 rounded-full border-2 ml-auto mt-1.5 transition-all',
                        isSelected ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]' : 'border-white/30')}>
                        {isSelected && <div className="w-1.5 h-1.5 bg-[hsl(var(--primary-foreground))] rounded-full m-auto mt-0.5" />}
                      </div>
                    </div>
                  </div>
                  {/* Specs row */}
                  <div className="flex items-center gap-3 text-[11px] text-white/40">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{r.max_passengers ?? '—'}</span>
                    <span className="flex items-center gap-1"><Luggage className="h-3 w-3" />{r.luggage_capacity ?? '—'}</span>
                    {r.toll_parking_minor ? <span className="flex items-center gap-1"><Car className="h-3 w-3" />Incl. {fmtMoney(r.toll_parking_minor, r.currency ?? 'AUD')} tolls</span> : null}
                    {r.surcharge_labels?.map((l, i) => (
                      <span key={i} className="flex items-center gap-1 text-amber-400/70"><Clock className="h-3 w-3" />{l}</span>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Book Now */}
            <button
              onClick={() => {
                if (!selected || !quoteId) return;
                router.push(`/book?quote_id=${quoteId}&car_type_id=${selected.service_class_id}`);
              }}
              disabled={!selected || !quoteId}
              className="w-full h-12 rounded-xl font-semibold text-sm tracking-wide bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.8)] text-[hsl(var(--primary-foreground))] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              Book Now — {selected ? fmtMoney(selected.estimated_total_minor ?? 0, selected.currency ?? 'AUD') : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
