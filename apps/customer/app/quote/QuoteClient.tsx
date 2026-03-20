'use client';
/**
 * QuoteClient — 1:1 replica of the official ASChauffeured booking widget
 * Ported for the Customer Portal (Next.js, dark luxury theme, same API calls)
 *
 * Flow:
 *  1. Load cities + service-types + car-types on mount
 *  2. User fills fields → Get Quote → POST /public/maps/route + /public/pricing/quote
 *  3. Car type cards appear → Book Now → /book?quote_id=...&car_type_id=...
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { cn } from '@/lib/utils';
import { BackButton } from '@/components/BackButton';
import {
  Loader2, MapPin, Plus, X, ChevronRight, ArrowRight,
  CalendarIcon, Clock,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://chauffeur-saas-production.up.railway.app';

function getTenantSlug() {
  if (typeof document === 'undefined') return 'aschauffeured';
  const fromCookie = document.cookie.split('; ').find(r => r.startsWith('tenant_slug='))?.split('=')[1];
  const fromHost   = typeof window !== 'undefined' ? window.location.hostname.split('.')[0] : '';
  return fromCookie || fromHost || 'aschauffeured';
}

// ── Types ──────────────────────────────────────────────────────────────────
type City        = { id: string; name: string; timezone: string; lat?: number; lng?: number };
type ServiceType = { id: string; code: string; name: string; calculation_type: string; minimum_hours?: number | null; surge_multiplier?: number | null };
type CarType     = { id: string; name: string; description: string | null; max_passengers?: number | null; luggage_capacity?: number | null; vehicle_class?: string | null };
type QuoteResult = {
  service_class_id: string; service_class_name: string;
  estimated_total_minor: number; currency: string;
  discount?: { name: string; type: string; value: number; discount_minor: number; capped_by_max: boolean } | null;
  pricing_snapshot_preview: {
    base_calculated_minor: number;
    toll_parking_minor: number;
    surcharge_labels?: string[];
    surcharge_items?: { label: string; amount_minor: number }[];
    pre_discount_total_minor?: number;
    pre_discount_fare_minor?: number;
    discount_amount_minor: number;
    grand_total_minor: number;
    minimum_applied: boolean;
    waypoints_minor?: number;
    baby_seats_minor?: number;
    extras_minor?: number;
    toll_minor?: number;
    parking_minor?: number;
    leg1_minor?: number;
    leg1_surcharge_minor?: number;
    leg2_minor?: number;
    leg2_surcharge_minor?: number;
    final_fare_minor?: number;
    multiplier_mode?: string;
    multiplier_value?: number;
  };
};

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtMoney(minor: number, currency = 'AUD') {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100);
}
const todayISO = () => new Date().toISOString().slice(0, 10);
const isHourly  = (st?: ServiceType) => st?.calculation_type === 'HOURLY_CHARTER';
const isP2P     = (st?: ServiceType) => st?.code === 'POINT_TO_POINT';

// ── LuxDateTimePicker ─────────────────────────────────────────────────────
const DAYS   = ['SU','MO','TU','WE','TH','FR','SA'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function isoToDate(s: string) { if (!s) return null; const [y,m,d] = s.split('-').map(Number); return new Date(y,m-1,d); }
function dateToIso(d: Date)   { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function fmtDisplayDate(s: string) {
  const d = isoToDate(s); if (!d) return '';
  return `${DAYS[d.getDay()][0]+DAYS[d.getDay()].slice(1).toLowerCase()}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0,3)} ${d.getFullYear()}`;
}
function fmtDisplayTime(s: string) {
  if (!s) return '';
  const [h24,m] = s.split(':').map(Number);
  const period = h24>=12?'PM':'AM'; const h12 = h24%12===0?12:h24%12;
  return `${String(h12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${period}`;
}

function CalendarPicker({ value, onChange, minDate }: { value: string; onChange: (v: string) => void; minDate?: string }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const minD  = minDate ? isoToDate(minDate) : today;
  const selected = isoToDate(value);
  const initMonth = selected ?? minD ?? today;
  const [view, setView] = useState(new Date(initMonth.getFullYear(), initMonth.getMonth(), 1));
  const year = view.getFullYear(); const month = view.getMonth();
  const firstDow = new Date(year,month,1).getDay();
  const daysInMonth = new Date(year,month+1,0).getDate();
  const cells: (number|null)[] = [...Array(firstDow).fill(null), ...Array.from({length:daysInMonth},(_,i)=>i+1)];
  while (cells.length%7!==0) cells.push(null);
  return (
    <div className="select-none w-full" style={{minWidth:264}}>
      <div className="flex items-center justify-between px-3 py-2">
        <button type="button" onClick={()=>setView(v=>new Date(v.getFullYear(),v.getMonth()-1,1))} className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span className="text-sm font-semibold text-white">{MONTHS[month]} {year}</span>
        <button type="button" onClick={()=>setView(v=>new Date(v.getFullYear(),v.getMonth()+1,1))} className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">{DAYS.map(d=><div key={d} className="text-center text-[11px] font-medium text-gray-400 py-1">{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-y-0.5 px-2 pb-3">
        {cells.map((day,i)=>{
          if(!day) return <div key={i}/>;
          const cellDate=new Date(year,month,day); const iso=dateToIso(cellDate);
          const isDisabled=minD?cellDate<minD:false; const isSelected=value===iso; const isToday=dateToIso(today)===iso;
          return <button type="button" key={i} disabled={isDisabled} onMouseDown={e=>e.preventDefault()} onClick={()=>!isDisabled&&onChange(iso)}
            className={cn('mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors',
              isDisabled&&'text-white/20 cursor-not-allowed',
              !isDisabled&&!isSelected&&'hover:bg-white/10 text-white cursor-pointer',
              isSelected&&'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-semibold',
              isToday&&!isSelected&&'ring-1 ring-[hsl(var(--primary)/0.6)] text-[hsl(var(--primary))]')}>{day}</button>;
        })}
      </div>
    </div>
  );
}

function TimePicker({ value, onChange, onConfirm }: { value: string; onChange: (v: string) => void; onConfirm: () => void }) {
  const initH24 = value ? parseInt(value.split(':')[0]) : 9;
  const initM   = value ? Math.round(parseInt(value.split(':')[1])/5)*5 : 0;
  const initP   = initH24>=12?'PM':'AM'; const initH12 = initH24%12===0?12:initH24%12;
  const [hour,setHour]=useState(initH12); const [minute,setMinute]=useState(initM); const [period,setPeriod]=useState<'AM'|'PM'>(initP);
  const hours=[...Array(12)].map((_,i)=>i+1); const minutes=[...Array(12)].map((_,i)=>i*5);
  const commit=(h:number,m:number,p:'AM'|'PM')=>{let h24=p==='AM'?(h===12?0:h):(h===12?12:h+12);onChange(`${String(h24).padStart(2,'0')}:${String(m).padStart(2,'0')}`);};
  const colCls='overflow-y-auto h-40 scroll-smooth'; const itemCls=(sel:boolean)=>cn('px-3 py-2 text-center text-sm cursor-pointer rounded transition-colors',sel?'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-semibold':'text-white/70 hover:text-white hover:bg-white/10');
  return (
    <div style={{minWidth:200}}>
      <div className="flex border-b border-white/10 pb-1 mb-1">
        {['Hour','Min','Period'].map(l=><div key={l} className="flex-1 text-center text-xs text-gray-400 font-medium py-1">{l}</div>)}
      </div>
      <div className="flex">
        <div className={cn(colCls,'flex-1')}>{hours.map(h=><div key={h} data-selected={h===hour} className={itemCls(h===hour)} onMouseDown={e=>e.preventDefault()} onClick={()=>{setHour(h);commit(h,minute,period);}}>{String(h).padStart(2,'0')}</div>)}</div>
        <div className={cn(colCls,'flex-1')}>{minutes.map(m=><div key={m} data-selected={m===minute} className={itemCls(m===minute)} onMouseDown={e=>e.preventDefault()} onClick={()=>{setMinute(m);commit(hour,m,period);}}>{String(m).padStart(2,'0')}</div>)}</div>
        <div className={cn(colCls,'flex-1')}>{(['AM','PM'] as const).map(p=><div key={p} data-selected={p===period} className={itemCls(p===period)} onMouseDown={e=>e.preventDefault()} onClick={()=>{setPeriod(p);commit(hour,minute,p);}}>{p}</div>)}</div>
      </div>
      <div className="px-3 pt-3 pb-2"><button type="button" onClick={()=>{commit(hour,minute,period);onConfirm();}} className="w-full py-2 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm font-semibold">Confirm</button></div>
    </div>
  );
}

function DropdownPortal({ anchor, onClose, children }: { anchor: React.RefObject<HTMLElement | null>; onClose: () => void; children: React.ReactNode }) {
  const [pos, setPos] = useState({top:0,left:0,width:0}); const panelRef = useRef<HTMLDivElement>(null);
  const updatePos = useCallback(()=>{
    const el=anchor.current; if(!el) return;
    const r=el.getBoundingClientRect();
    const vw=window.innerWidth;
    const panelW=Math.max(r.width, 264);
    // clamp left so panel doesn't overflow viewport on mobile
    const rawLeft=r.left;
    const clampedLeft=Math.min(rawLeft, vw-panelW-8);
    setPos({top:r.bottom+6, left:Math.max(8, clampedLeft), width:panelW});
  },[anchor]);
  useEffect(()=>{ updatePos(); window.addEventListener('scroll',updatePos,true); window.addEventListener('resize',updatePos); return()=>{ window.removeEventListener('scroll',updatePos,true); window.removeEventListener('resize',updatePos); }; },[updatePos]);
  useEffect(()=>{ const h=(e:MouseEvent)=>{ if(!anchor.current?.contains(e.target as Node)&&!panelRef.current?.contains(e.target as Node)) onClose(); }; document.addEventListener('mousedown',h,true); return()=>document.removeEventListener('mousedown',h,true); },[anchor,onClose]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div ref={panelRef} style={{position:'fixed',top:pos.top,left:pos.left,width:pos.width,zIndex:9999}} className="rounded-xl border border-white/10 bg-[hsl(228,10%,8%)] shadow-2xl overflow-hidden" onMouseDown={e=>{e.stopPropagation();e.nativeEvent.stopImmediatePropagation();}}>
      {children}
    </div>, document.body
  );
}

function LuxDateTimePicker({ dateValue, timeValue, onDateChange, onTimeChange, minDate }: { dateValue:string; timeValue:string; onDateChange:(v:string)=>void; onTimeChange:(v:string)=>void; minDate?:string }) {
  const [openDate, setOpenDate] = useState(false); const [openTime, setOpenTime] = useState(false);
  const dateRef = useRef<HTMLButtonElement>(null); const timeRef = useRef<HTMLButtonElement>(null);
  const triggerCls = 'flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border text-sm transition-colors text-left bg-[hsl(228,10%,8%)] border-white/10 hover:border-white/30';
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <button ref={dateRef} type="button" className={triggerCls} onClick={()=>{setOpenDate(v=>!v);setOpenTime(false);}}>
          <CalendarIcon className="h-4 w-4 text-gray-400 shrink-0"/>
          <span className={dateValue?'text-white':'text-gray-400'}>{dateValue?fmtDisplayDate(dateValue):'Select date'}</span>
        </button>
        {openDate && <DropdownPortal anchor={dateRef} onClose={()=>setOpenDate(false)}><CalendarPicker value={dateValue} onChange={v=>{onDateChange(v);setOpenDate(false);}} minDate={minDate}/></DropdownPortal>}
      </div>
      <div>
        <button ref={timeRef} type="button" className={triggerCls} onClick={()=>{setOpenTime(v=>!v);setOpenDate(false);}}>
          <Clock className="h-4 w-4 text-gray-400 shrink-0"/>
          <span className={timeValue?'text-white':'text-gray-400'}>{timeValue?fmtDisplayTime(timeValue):'Select time'}</span>
        </button>
        {openTime && <DropdownPortal anchor={timeRef} onClose={()=>setOpenTime(false)}><TimePicker value={timeValue} onChange={onTimeChange} onConfirm={()=>setOpenTime(false)}/></DropdownPortal>}
      </div>
    </div>
  );
}

// ── PlacesAutocomplete ─────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [deb, setDeb] = useState(value);
  useEffect(() => { const t = setTimeout(()=>setDeb(value), delay); return ()=>clearTimeout(t); }, [value, delay]);
  return deb;
}

function PlacesAutocomplete({ value='', onChange, placeholder='Enter a location', cityBias, pinColor='muted' }: {
  value?: string; onChange?: (v: string, placeId?: string) => void; placeholder?: string;
  cityBias?: { lat: number; lng: number }; pinColor?: 'green'|'gold'|'muted';
}) {
  const PIN = { green:'text-emerald-400', gold:'text-amber-400', muted:'text-gray-400' };
  const [inputValue, setInputValue] = useState(value);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const fetchIdRef   = useRef(0);
  const justSelectedRef = useRef(false);
  const cityKey = cityBias ? `${cityBias.lat},${cityBias.lng}` : '';
  const debouncedInput = useDebounce(inputValue, 280);

  useEffect(() => { if (!justSelectedRef.current && value !== inputValue) setInputValue(value); }, [value]); // eslint-disable-line

  useEffect(() => {
    if (justSelectedRef.current) { justSelectedRef.current = false; setPredictions([]); setOpen(false); return; }
    if (!debouncedInput.trim() || debouncedInput.length < 2) { setPredictions([]); setOpen(false); return; }
    const id = ++fetchIdRef.current; setLoading(true);
    const params = new URLSearchParams({ tenant_slug: getTenantSlug(), input: debouncedInput, sessiontoken: Math.random().toString(36).slice(2) });
    if (cityBias) { params.set('lat', String(cityBias.lat)); params.set('lng', String(cityBias.lng)); }
    fetch(`${API_URL}/public/maps/autocomplete?${params}`)
      .then(r=>r.json()).then(data=>{ if(id!==fetchIdRef.current) return; const p=data.predictions??[]; setPredictions(p); setOpen(p.length>0); setActiveIdx(-1); })
      .catch(()=>{ if(id!==fetchIdRef.current) return; setPredictions([]); setOpen(false); })
      .finally(()=>{ if(id===fetchIdRef.current) setLoading(false); });
  }, [debouncedInput, cityKey]); // eslint-disable-line

  useEffect(() => { const h=(e:MouseEvent)=>{ if(containerRef.current&&!containerRef.current.contains(e.target as Node)){ setOpen(false); setActiveIdx(-1); } }; document.addEventListener('mousedown',h); return()=>document.removeEventListener('mousedown',h); }, []);

  const select = useCallback((pred: any) => {
    const val = pred.description || pred.main_text;
    const placeId = pred.place_id;
    justSelectedRef.current = true; setInputValue(val); setPredictions([]); setOpen(false); setActiveIdx(-1); onChange?.(val, placeId); inputRef.current?.blur();
  }, [onChange]);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative group">
        <MapPin className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none ${PIN[pinColor]}`}/>
        <input ref={inputRef} type="text" autoComplete="off" autoCorrect="off" spellCheck={false}
          value={inputValue} placeholder={placeholder}
          onChange={e=>{ setInputValue(e.target.value); if(!e.target.value) onChange?.(''); }}
          onKeyDown={e=>{ if(!open||!predictions.length) return; if(e.key==='ArrowDown'){e.preventDefault();setActiveIdx(i=>Math.min(i+1,predictions.length-1));} else if(e.key==='ArrowUp'){e.preventDefault();setActiveIdx(i=>Math.max(i-1,0));} else if(e.key==='Enter'&&activeIdx>=0){e.preventDefault();select(predictions[activeIdx]);} else if(e.key==='Escape'){setOpen(false);setActiveIdx(-1);} }}
          onFocus={()=>{ if(predictions.length>0) setOpen(true); }}
          className="w-full h-12 pl-9 pr-9 rounded-xl text-sm bg-white/5 border border-white/10 text-white placeholder:text-gray-400 focus:outline-none focus:border-amber-400/50 focus:bg-white/8 focus:ring-2 focus:ring-amber-400/10 transition-all"/>
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {loading ? <Loader2 className="h-4 w-4 text-gray-400 animate-spin"/> : inputValue ? <button type="button" onClick={()=>{setInputValue('');setPredictions([]);setOpen(false);onChange?.('');inputRef.current?.focus();}} className="text-gray-400 hover:text-gray-600 transition-colors p-0.5 rounded"><X className="h-3.5 w-3.5"/></button> : null}
        </div>
      </div>
      {open && predictions.length>0 && (
        <ul className="absolute z-[200] mt-1.5 w-full bg-[hsl(228,10%,10%)] border border-white/10 rounded-xl shadow-2xl overflow-hidden py-1">
          {predictions.map((pred,idx)=>(
            <li key={pred.place_id} onMouseDown={e=>{e.preventDefault();select(pred);}} onMouseEnter={()=>setActiveIdx(idx)}
              className={cn('flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors',idx===activeIdx?'bg-amber-400/10':'hover:bg-white/5')}>
              <MapPin className={`h-4 w-4 mt-0.5 shrink-0 ${idx===activeIdx?'text-amber-400':'text-white/25'}`}/>
              <p className="text-sm text-white leading-tight">{pred.description||pred.main_text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── LuxSelect ──────────────────────────────────────────────────────────────
function LuxSelect({ value, onChange, children, placeholder }: { value: string; onChange: (v: string) => void; children: React.ReactNode; placeholder?: string }) {
  return (
    <div className="relative">
      <select value={value} onChange={e=>onChange(e.target.value)}
        className="w-full h-12 pl-4 pr-9 rounded-xl bg-white/5 border border-white/10 text-sm appearance-none focus:outline-none focus:border-amber-400/50 transition-colors cursor-pointer"
        style={{ backgroundColor: 'hsl(var(--card))', color: '#ffffff', fontWeight: 400 }}>
        {placeholder && <option value="" disabled style={{ backgroundColor: 'hsl(var(--card))' }}>{placeholder}</option>}
        {children}
      </select>
      <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))] pointer-events-none rotate-90"/>
    </div>
  );
}

// ── Field Label ────────────────────────────────────────────────────────────
function FL({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] flex items-center gap-1.5 mb-2">{children}</p>;
}

// ── Main Component ─────────────────────────────────────────────────────────
export function QuoteClient() {
  const router = useRouter();
  const { token } = useAuthStore();

  const [cities, setCities]             = useState<City[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [carTypes, setCarTypes]         = useState<CarType[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [configError, setConfigError]   = useState(false);

  const [cityId, setCityId]             = useState('');
  const [serviceTypeId, setServiceTypeId] = useState('');
  const [tripType, setTripType]         = useState<'ONE_WAY'|'RETURN'>('ONE_WAY');
  const [pickup, setPickup]             = useState('');
  const [dropoff, setDropoff]           = useState('');
  const [waypoints, setWaypoints]       = useState<string[]>([]);
  const [date, setDate]                 = useState('');
  const [time, setTime]                 = useState('');
  const [returnDate, setReturnDate]     = useState('');
  const [returnTime, setReturnTime]     = useState('');
  const [durationHours, setDurationHours] = useState('2');
  const [passengers, setPassengers]     = useState('1');
  const [luggage, setLuggage]           = useState('0');
  const [infantSeats, setInfantSeats]   = useState('0');
  const [toddlerSeats, setToddlerSeats] = useState('0');
  const [boosterSeats, setBoosterSeats] = useState('0');

  const [autoDiscount, setAutoDiscount] = useState<{ name: string; rate: number } | null>(null);
  const [showUrgentModal, setShowUrgentModal] = useState(false);

  const [quoting, setQuoting]           = useState(false);
  const [quoteId, setQuoteId]           = useState<string | null>(null);
  const [quoteResults, setQuoteResults] = useState<QuoteResult[]>([]);
  const [selectedCarTypeId, setSelectedCarTypeId] = useState<string | null>(null);
  const [currency, setCurrency]         = useState('AUD');
  const [lastQuoteDebug, setLastQuoteDebug] = useState<any | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);

  const selectedServiceType = serviceTypes.find(s => s.id === serviceTypeId);
  const selectedCity        = cities.find(c => c.id === cityId);
  const isWedding           = selectedServiceType?.code === 'WEDDING_HIRE';
  const minHours            = selectedServiceType?.minimum_hours ?? (isHourly(selectedServiceType) ? 2 : null);
  const hasSurge            = (selectedServiceType?.surge_multiplier ?? 1) > 1;
  const surgePercent        = hasSurge ? Math.round(((selectedServiceType!.surge_multiplier! - 1) * 100)) : 0;

  const clearQuote = useCallback(() => { setQuoteId(null); setQuoteResults([]); setSelectedCarTypeId(null); }, []);

  // ── Pending Quotes (logged-in customers only) ────────────────────────────
  type PendingQuote = {
    quote_id: string;
    expires_at: string;
    created_at: string;
    currency: string;
    pickup_address: string | null;
    dropoff_address: string | null;
    pickup_at_utc: string | null;
    trip_mode: 'ONE_WAY' | 'RETURN';
    from_minor: number | null;
    options_count: number;
  };
  const [pendingQuotes, setPendingQuotes] = useState<PendingQuote[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

  useEffect(() => {
    if (!token) { setPendingQuotes([]); return; }
    setLoadingPending(true);
    fetch(`${API_URL}/customer-portal/pending-quotes`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => setPendingQuotes(Array.isArray(data) ? data : []))
      .catch(() => setPendingQuotes([]))
      .finally(() => setLoadingPending(false));
  }, [token]);

  // Load config
  useEffect(() => {
    const slug = getTenantSlug();
    setLoadingConfig(true); setConfigError(false);
    Promise.all([
      fetch(`${API_URL}/public/cities?tenant_slug=${slug}`).then(r => r.json()),
      fetch(`${API_URL}/public/service-types?tenant_slug=${slug}`).then(r => r.json()),
      fetch(`${API_URL}/public/car-types?tenant_slug=${slug}`).then(r => r.json()),
    ]).then(([c, s, ct]) => {
      const vc = Array.isArray(c) ? c : [];
      const vs = (Array.isArray(s) ? s : []).filter((x: any) => x.name);
      const vct = (Array.isArray(ct) ? ct : []).filter((x: any) => x.name);
      setCities(vc); setServiceTypes(vs); setCarTypes(vct);
      if (vc.length) setCityId(vc[0].id);
      if (vs.length) setServiceTypeId(vs[0].id);
    }).catch(() => setConfigError(true))
      .finally(() => setLoadingConfig(false));
    // Auto-discount (non-blocking, with retry)
    const fetchDiscount = (attempt = 0) => {
      fetch(`${API_URL}/public/discounts/auto?tenant_slug=${slug}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.name) {
            setAutoDiscount({ name: d.name, rate: Number(d.discount_value) });
          } else if (attempt < 3) {
            // Retry up to 3 times with backoff
            setTimeout(() => fetchDiscount(attempt + 1), 1500 * (attempt + 1));
          }
        })
        .catch(() => {
          if (attempt < 3) setTimeout(() => fetchDiscount(attempt + 1), 2000 * (attempt + 1));
        });
    };
    fetchDiscount();
  }, []);

  // Get Quote
  const handleGetQuote = useCallback(async () => {
    if (!pickup || !date || !time) return;
    const pickupMs = new Date(`${date}T${time}:00`).getTime();
    if (pickupMs - Date.now() < 12 * 3600 * 1000) { setShowUrgentModal(true); return; }
    if (tripType === 'RETURN' && (!returnDate || !returnTime)) return;
    const totalSeats = Number(infantSeats)+Number(toddlerSeats)+Number(boosterSeats);
    if (totalSeats > 0 && totalSeats >= Number(passengers)) return;

    setQuoting(true); clearQuote();
    const slug = getTenantSlug();
    const tz   = selectedCity?.timezone ?? 'Australia/Sydney';

    try {
      const effectiveDropoff = dropoff || pickup;
      const activeWaypoints = waypoints.filter(Boolean);
      const pickupAtUtcStr = new Date(`${date}T${time}:00`).toISOString();

      // Outbound route: A → [B…] → C
      const outboundParams = new URLSearchParams({ tenant_slug: slug, origin: pickup, destination: effectiveDropoff, pickup_at: pickupAtUtcStr });
      activeWaypoints.forEach(wp => outboundParams.append('waypoints', wp));
      const outboundRoute = await fetch(`${API_URL}/public/maps/route?${outboundParams}`).then(r => { if (!r.ok) throw new Error('Route failed'); return r.json(); });

      // Return route: C → [B…reversed] → A (separate calculation — tolls may differ by direction)
      let returnRoute = outboundRoute;
      if (tripType === 'RETURN' && !isHourly(selectedServiceType)) {
        const returnPickupAtUtcStr = new Date(`${returnDate}T${returnTime}:00`).toISOString();
        const returnParams = new URLSearchParams({ tenant_slug: slug, origin: effectiveDropoff, destination: pickup, pickup_at: returnPickupAtUtcStr });
        // Reverse waypoints for return leg: C → [B…reversed] → A
        [...activeWaypoints].reverse().forEach(wp => returnParams.append('waypoints', wp));
        returnRoute = await fetch(`${API_URL}/public/maps/route?${returnParams}`).then(r => { if (!r.ok) throw new Error('Return route failed'); return r.json(); });
      }

      const body: Record<string, any> = {
        service_type_id: serviceTypeId,
        city_id: cityId || undefined,
        trip_mode: isHourly(selectedServiceType) ? 'ONE_WAY' : tripType,
        pickup_address: pickup,
        dropoff_address: effectiveDropoff,
        pickup_at_utc: pickupAtUtcStr,
        timezone: tz,
        passenger_count: Number(passengers),
        luggage_count: Number(luggage),
        distance_km: outboundRoute.distance_km,
        duration_minutes: outboundRoute.duration_minutes,
        // Waypoints count = outbound stops only (return stops passed separately via return_distance_km)
        waypoints_count: activeWaypoints.length,
        waypoints: activeWaypoints,
        infant_seats: Number(infantSeats),
        toddler_seats: Number(toddlerSeats),
        booster_seats: Number(boosterSeats),
      };
      setLastQuoteDebug({
        payload: body,
        outboundRoute,
        returnRoute: tripType === 'RETURN' ? returnRoute : null,
      });
      if (isHourly(selectedServiceType)) body.duration_hours = Number(durationHours);
      if (tripType === 'RETURN') {
        body.return_distance_km = returnRoute.distance_km;
        body.return_duration_minutes = returnRoute.duration_minutes;
        body.return_date = returnDate;
        body.return_time = returnTime;
        // Return waypoints count for pricing (stops on return leg)
        body.return_waypoints_count = activeWaypoints.length;
      }

      const quote = await fetch(`${API_URL}/public/pricing/quote?tenant_slug=${slug}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      }).then(r => { if (!r.ok) throw new Error('Quote failed'); return r.json(); });

      setLastQuoteDebug((prev: any) => ({ ...prev, quote }));
      setQuoteId(quote.quote_id);
      setQuoteResults(quote.results ?? []);
      setCurrency(quote.currency ?? 'AUD');
      if (quote.results?.length > 0) setSelectedCarTypeId(quote.results[0].service_class_id);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      // If discount still not loaded, re-fetch once after quote
      if (!autoDiscount) {
        const slug = getTenantSlug();
        fetch(`${API_URL}/public/discounts/auto?tenant_slug=${slug}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d?.name) setAutoDiscount({ name: d.name, rate: Number(d.discount_value) }); })
          .catch(() => {});
      }
    } catch {
      // silent — could add toast
    } finally {
      setQuoting(false);
    }
  }, [pickup, dropoff, date, time, returnDate, returnTime, serviceTypeId, tripType, cityId,
      passengers, luggage, infantSeats, toddlerSeats, boosterSeats, durationHours,
      waypoints, selectedServiceType, selectedCity, clearQuote, token]);

  const totalSeats = Number(infantSeats)+Number(toddlerSeats)+Number(boosterSeats);
  const seatError  = totalSeats > 0 && totalSeats >= Number(passengers);

  if (loadingConfig) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))]"/>
    </div>
  );

  if (configError) return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-sm">
        <p className="text-gray-500 text-sm">Unable to load booking options.</p>
        <button onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm font-medium">
          <Loader2 className="h-4 w-4"/> Retry
        </button>
      </div>
    </div>
  );

  return (
    <>
    <div className="min-h-screen" style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-20 border-b border-white/10"
        style={{
          background: 'hsl(var(--background))',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          paddingTop: 'max(12px, env(safe-area-inset-top))',
          paddingBottom: 12,
          paddingLeft: 16,
          paddingRight: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <BackButton fallback="/login" />
        <h1 className="font-semibold text-white">Get a Quote</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5 pb-8">

        {/* ── Pending / Resumable Quotes ── */}
        {token && !loadingPending && pendingQuotes.length > 0 && (
          <div className="mb-5 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 space-y-3">
            <p className="text-xs font-semibold tracking-widest text-amber-400/80 uppercase">
              Resume a Recent Quote
            </p>
            {pendingQuotes.map(q => {
              const fmt = (v: number | null) =>
                v != null ? `${q.currency} ${(v / 100).toFixed(0)}` : '';
              const pickupDate = q.pickup_at_utc
                ? new Date(q.pickup_at_utc).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
                : null;
              const origin  = q.pickup_address  ? q.pickup_address.split(',')[0]  : '—';
              const dest    = q.dropoff_address ? q.dropoff_address.split(',')[0] : '—';
              const minsLeft = Math.max(0, Math.floor((new Date(q.expires_at).getTime() - Date.now()) / 60000));
              return (
                <button
                  key={q.quote_id}
                  className="w-full text-left rounded-lg bg-white/4 hover:bg-white/8 border border-white/10 px-4 py-3 transition-colors"
                  onClick={() => router.push(`/book?quote_id=${q.quote_id}`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {origin} → {dest}
                      </p>
                      {pickupDate && (
                        <p className="text-xs text-gray-400 mt-0.5">{pickupDate} · {q.trip_mode === 'RETURN' ? 'Return' : 'One Way'}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-0.5">{q.options_count} option{q.options_count !== 1 ? 's' : ''} · expires in {minsLeft}m</p>
                    </div>
                    <div className="shrink-0 text-right">
                      {q.from_minor != null && (
                        <p className="text-sm font-semibold text-[hsl(var(--primary))]">from {fmt(q.from_minor)}</p>
                      )}
                      <p className="text-xs text-amber-400/70 mt-0.5">Resume →</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="rounded-xl border border-white/10 bg-white/2 shadow-2xl p-5 sm:p-8 space-y-6">

          {/* Row 1 — City + Service Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <FL>City</FL>
              <LuxSelect value={cityId} onChange={v=>{setCityId(v);clearQuote();}}>
                {cities.map(c=><option key={c.id} value={c.id} style={{ backgroundColor: "hsl(var(--card))", color: "hsl(var(--foreground))" }}>{c.name}</option>)}
              </LuxSelect>
            </div>
            <div>
              <FL>Service Type</FL>
              <LuxSelect value={serviceTypeId} onChange={v=>{setServiceTypeId(v);setTripType('ONE_WAY');clearQuote();}}>
                {serviceTypes.map(s=><option key={s.id} value={s.id} style={{ backgroundColor: "hsl(var(--card))", color: "hsl(var(--foreground))" }}>{s.name}</option>)}
              </LuxSelect>
            </div>
          </div>

          {/* Service notice */}
          {(isWedding || (isHourly(selectedServiceType) && minHours)) && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-amber-400/8 border border-amber-400/20 text-xs text-amber-300/80">
              <span className="text-amber-400 mt-0.5 shrink-0">·</span>
              <span>{isWedding ? `Wedding Hire requires a minimum of ${minHours ?? 4} hours${hasSurge ? ` and includes a ${surgePercent}% special occasion surcharge` : ''}.` : `Hourly Charter minimum is ${minHours} hours.`}</span>
            </div>
          )}

          {/* Trip Type / Duration */}
          {isHourly(selectedServiceType) ? (
            <div>
              <FL>Duration (hours)</FL>
              <LuxSelect value={durationHours} onChange={v=>{setDurationHours(v);clearQuote();}}>
                {[2,3,4,5,6,7,8,9,10,12].filter(h=>h>=(minHours??2)).map(h=>(
                  <option key={h} value={String(h)} style={{ backgroundColor: "hsl(var(--card))", color: "hsl(var(--foreground))" }}>{h} hours{h===minHours?' (minimum)':''}</option>
                ))}
              </LuxSelect>
            </div>
          ) : (
            <div>
              <FL>Trip Type</FL>
              <LuxSelect value={tripType} onChange={v=>{setTripType(v as 'ONE_WAY'|'RETURN');clearQuote();}}>
                <option value="ONE_WAY" style={{ backgroundColor: "hsl(var(--card))", color: "hsl(var(--foreground))" }}>One Way</option>
                <option value="RETURN" style={{ backgroundColor: "hsl(var(--card))", color: "hsl(var(--foreground))" }}>Return</option>
              </LuxSelect>
            </div>
          )}

          {/* Pickup Date & Time */}
          <div>
            <FL>Pickup Date & Time</FL>
            <LuxDateTimePicker dateValue={date} timeValue={time} onDateChange={v=>{setDate(v);clearQuote();}} onTimeChange={v=>{setTime(v);clearQuote();}} minDate={todayISO()}/>
          </div>

          {/* Addresses */}
          <div className="space-y-4">
            <div>
              <FL><MapPin className="h-3 w-3 text-emerald-400"/> Pickup Location</FL>
              <PlacesAutocomplete value={pickup} onChange={v=>{setPickup(v);clearQuote();}} placeholder="Airport, hotel or address..." pinColor="green" cityBias={selectedCity?.lat&&selectedCity?.lng?{lat:selectedCity.lat,lng:selectedCity.lng}:undefined}/>
            </div>

            {/* Waypoints */}
            {waypoints.map((wp,idx)=>(
              <div key={idx} className="flex gap-2">
                <div className="flex-1">
                  <FL><MapPin className="h-3 w-3"/> Stop {idx+1}</FL>
                  <PlacesAutocomplete value={wp} onChange={v=>{const next=[...waypoints];next[idx]=v;setWaypoints(next);clearQuote();}} placeholder="Intermediate stop..." cityBias={selectedCity?.lat&&selectedCity?.lng?{lat:selectedCity.lat,lng:selectedCity.lng}:undefined}/>
                </div>
                <button type="button" onClick={()=>{setWaypoints(w=>w.filter((_,i)=>i!==idx));clearQuote();}} className="mt-7 p-2 text-gray-400 hover:text-red-400 transition-colors"><X className="h-4 w-4"/></button>
              </div>
            ))}
            {waypoints.length < 5 && (
              <button type="button" onClick={()=>setWaypoints(w=>[...w,''])} className="flex items-center gap-1.5 text-xs text-[hsl(var(--primary))] hover:opacity-80 font-medium transition-colors">
                <Plus className="h-3.5 w-3.5"/> Add Stop
              </button>
            )}

            <div>
              <FL><MapPin className="h-3 w-3 text-[hsl(var(--primary))]"/> Drop-off Location <span className="normal-case text-gray-400 font-normal ml-1">(optional)</span></FL>
              <PlacesAutocomplete value={dropoff} onChange={v=>{setDropoff(v);clearQuote();}} placeholder="Airport, hotel or destination..." pinColor="gold" cityBias={selectedCity?.lat&&selectedCity?.lng?{lat:selectedCity.lat,lng:selectedCity.lng}:undefined}/>
            </div>
          </div>

          {/* Return datetime */}
          {tripType === 'RETURN' && !isHourly(selectedServiceType) && (
            <div className="space-y-3 pt-2 border-t border-white/10">
              <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--primary))]">Return Trip</p>
              <LuxDateTimePicker dateValue={returnDate} timeValue={returnTime} onDateChange={v=>{setReturnDate(v);clearQuote();}} onTimeChange={v=>{setReturnTime(v);clearQuote();}} minDate={date||todayISO()}/>
              <p className="text-xs text-gray-400">Return pickup from drop-off location.</p>
            </div>
          )}

          {/* Passengers + Luggage */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label:'Passengers', value:passengers, set:setPassengers, min:1, max:50, suffix:(n:number)=>n===1?'passenger':'passengers' },
              { label:'Luggage',    value:luggage,    set:setLuggage,    min:0, max:50, suffix:(n:number)=>n===1?'bag':'bags' },
            ].map(({label,value,set,min,max,suffix})=>(
              <div key={label}>
                <FL>{label}</FL>
                <div className="flex items-center h-12 rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                  <button type="button" onClick={()=>{const v=Math.max(min,Number(value)-1);set(String(v));clearQuote();}} className="h-full w-11 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/8 transition-colors text-lg font-light shrink-0">−</button>
                  <div className="flex-1 flex items-center justify-center gap-1.5">
                    <input type="number" min={min} max={max} value={value} onChange={e=>{const n=Math.max(min,Math.min(max,parseInt(e.target.value)||min));set(String(n));clearQuote();}} className="w-8 bg-transparent text-center text-white text-sm font-semibold focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"/>
                    <span className="text-gray-400 text-xs">{suffix(Number(value))}</span>
                  </div>
                  <button type="button" onClick={()=>{const v=Math.min(max,Number(value)+1);set(String(v));clearQuote();}} className="h-full w-11 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/8 transition-colors text-lg font-light shrink-0">+</button>
                </div>
              </div>
            ))}
          </div>

          {/* Baby Seats */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Baby Seats <span className="normal-case font-normal">(optional)</span></p>
            <div className="grid grid-cols-3 gap-3 items-end">
              {[
                { label:'Infant',  sub:'Rear-facing · 0–6 months',   value:infantSeats,  set:setInfantSeats },
                { label:'Toddler', sub:'Forward-facing · 0–4 yrs',   value:toddlerSeats, set:setToddlerSeats },
                { label:'Booster', sub:'4–8 years old',               value:boosterSeats, set:setBoosterSeats },
              ].map(({label,sub,value,set})=>(
                <div key={label} className="flex flex-col">
                  <p className="text-[11px] font-medium text-gray-600 mb-0.5">{label}</p>
                  <p className="text-[10px] text-gray-400 mb-1.5 leading-tight flex-1">{sub}</p>
                  <LuxSelect value={value} onChange={v=>{set(v);clearQuote();}}>
                    {[0,1,2,3].map(n=><option key={n} value={String(n)} style={{ backgroundColor: "hsl(var(--card))", color: "hsl(var(--foreground))" }}>{n}</option>)}
                  </LuxSelect>
                </div>
              ))}
            </div>
            {seatError && <p className="text-xs text-red-400">Baby seats ({totalSeats}) must be less than total passengers ({passengers}) — at least 1 adult required.</p>}
          </div>

          {/* Auto-discount banner */}
          {autoDiscount && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-emerald-400/8 border border-emerald-400/20">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400/15 shrink-0">
                <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-300">{autoDiscount.rate}% {autoDiscount.name}</p>
                <p className="text-[11px] text-emerald-400/70 mt-0.5">Applied automatically — no code needed</p>
              </div>
            </div>
          )}

          {/* Get Quote CTA */}
          <button onClick={handleGetQuote} disabled={quoting||seatError||!pickup||!date||!time}
            className={cn('w-full h-12 rounded-lg font-semibold text-base tracking-wide transition-all duration-300 flex items-center justify-center gap-2',
              'bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.8)] text-[hsl(var(--primary-foreground))]',
              'hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed')}>
            {quoting ? <><Loader2 className="h-4 w-4 animate-spin"/> Calculating...</> : <>{quoteResults.length>0?'↻ Recalculate':'Get Instant Quote'} <ChevronRight className="h-4 w-4"/></>}
          </button>
        </div>

        {/* Car Type Cards */}
        {quoteResults.length > 0 && (
          <div ref={resultsRef} className="mt-6 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 text-center">Select Your Vehicle</p>
            <div className="space-y-3">
              {quoteResults.map(result => {
                const carType   = carTypes.find(c => c.id === result.service_class_id);
                const isSelected = selectedCarTypeId === result.service_class_id;
                const preview   = result.pricing_snapshot_preview ?? {};
                const hasDiscount = (preview.discount_amount_minor ?? 0) > 0;
                const totalMinor = typeof preview.final_fare_minor === 'number' ? preview.final_fare_minor : 0;
                return (
                  <div key={result.service_class_id} onClick={()=>setSelectedCarTypeId(result.service_class_id)}
                    className={cn('cursor-pointer rounded-2xl border transition-all duration-200 overflow-hidden',
                      isSelected ? 'border-[hsl(var(--primary)/0.7)] bg-[hsl(39,46%,60%,0.06)] shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_8px_24px_rgba(200,169,107,0.12)]'
                                 : 'border-white/10 bg-white/2 hover:border-[hsl(var(--primary)/0.3)] hover:bg-white/4')}>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {carType?.vehicle_class && <span className="inline-block mb-1 text-[9px] font-semibold tracking-widest uppercase text-[hsl(var(--primary)/0.6)] border border-[hsl(var(--primary)/0.2)] rounded px-1.5 py-0.5">{carType.vehicle_class}</span>}
                          <p className="font-serif font-semibold text-white text-[15px] leading-snug">{result.service_class_name}</p>
                        </div>
                        <div className="flex items-start gap-2.5 shrink-0">
                          <div className="text-right">
                            <p className={cn('text-xl font-bold leading-none', isSelected?'text-gradient-gold':'text-white')}>{fmtMoney(totalMinor, currency)}</p>
                            {hasDiscount ? <p className="text-[10px] text-emerald-400 font-semibold mt-0.5">-{fmtMoney(preview.discount_amount_minor ?? 0, currency)} off</p> : <p className="text-[10px] text-gray-400 mt-0.5">{currency} incl. GST</p>}
                          </div>
                          <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all',isSelected?'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]':'border-white/10')}>
                            {isSelected && <svg className="w-3 h-3 text-[hsl(var(--primary-foreground))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                          </div>
                        </div>
                      </div>
                        {/* Specs row */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[11px] text-gray-400">
                          {(carType?.max_passengers??0)>0 && <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>Up to {carType!.max_passengers} passengers</span>}
                          {(carType?.luggage_capacity??0)>0 && <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>{carType!.luggage_capacity} bags</span>}

                          {(() => {
                            const leg1 = typeof preview.leg1_minor === 'number' ? preview.leg1_minor : 0;
                            const leg2 = typeof preview.leg2_minor === 'number' ? preview.leg2_minor : null;
                            const hasReturn = typeof leg2 === 'number' && leg2 > 0;
                            const leg1S = typeof preview.leg1_surcharge_minor === 'number' ? preview.leg1_surcharge_minor : 0;
                            const leg2S = typeof preview.leg2_surcharge_minor === 'number' ? preview.leg2_surcharge_minor : 0;
                            const toll = typeof preview.toll_minor === 'number' ? preview.toll_minor : 0;
                            const parking = typeof preview.parking_minor === 'number' ? preview.parking_minor : 0;
                            const discount = typeof preview.discount_amount_minor === 'number' ? preview.discount_amount_minor : 0;
                            const total = typeof preview.final_fare_minor === 'number' ? preview.final_fare_minor : 0;
                            const isReturn = hasReturn;
                            return (
                              <>
                                {leg1 > 0 && <span className="text-gray-500">Outbound price: {fmtMoney(leg1, currency)}</span>}
                                {(() => {
                                  const items = preview.surcharge_items ?? [];
                                  const labels = preview.surcharge_labels ?? [];
                                  const label = items[0]?.label || labels[0] || 'Surcharge';
                                  if (leg1S > 0 || leg2S > 0) {
                                    return (
                                      <>
                                        {leg1S > 0 && <span className="text-amber-400/80">Outbound {label}: +{fmtMoney(leg1S, currency)}</span>}
                                        {leg2S > 0 && <span className="text-amber-400/80">Return {label}: +{fmtMoney(leg2S, currency)}</span>}
                                      </>
                                    );
                                  }
                                  const total = (preview as any)?.surcharge_minor ?? 0;
                                  return total > 0 ? <span className="text-amber-400/80">{label}: +{fmtMoney(total, currency)}</span> : null;
                                })()}
                                {isReturn && (
                                  <>
                                    {leg2 > 0 && <span className="text-gray-500">Return price: {fmtMoney(leg2, currency)}</span>}
                                  </>
                                )}
                                {(() => {
                                  const leg1Toll = preview.leg1_toll_minor ?? 0;
                                  const leg2Toll = preview.leg2_toll_minor ?? 0;
                                  const hasSplit = leg1Toll > 0 || leg2Toll > 0;
                                  if (!hasSplit) return toll > 0 ? <span className="text-gray-500">Toll: +{fmtMoney(toll, currency)}</span> : null;
                                  return (
                                    <>
                                      {leg1Toll > 0 && <span className="text-gray-500">Outbound toll: +{fmtMoney(leg1Toll, currency)}</span>}
                                      {leg2Toll > 0 && <span className="text-gray-500">Return toll: +{fmtMoney(leg2Toll, currency)}</span>}
                                    </>
                                  );
                                })()}
                                {parking > 0 && <span className="text-gray-500">Parking: +{fmtMoney(parking, currency)}</span>}
                                {discount > 0 && <span className="text-emerald-400">Discount: -{fmtMoney(discount, currency)}</span>}
                                {total > 0 && <span className="text-gray-500">Total: {fmtMoney(total, currency)}</span>}
                              </>
                            );
                          })()}
                        </div>
                      {carType?.description && <p className="mt-2 text-[11px] text-gray-400 line-clamp-1">{carType.description}</p>}
                    </div>
                    {isSelected && <div className="h-px bg-gradient-to-r from-transparent via-[hsl(var(--primary)/0.6)] to-transparent"/>}
                  </div>
                );
              })}
            </div>

            {/* Book Now */}
            <button disabled={!selectedCarTypeId||!quoteId}
              onClick={()=>{ if(!selectedCarTypeId||!quoteId) return; router.push(`/book?quote_id=${quoteId}&car_type_id=${selectedCarTypeId}`); }}
              className={cn('w-full rounded-xl font-semibold text-base tracking-wide transition-all duration-300 flex items-center justify-center gap-2 py-3.5',
                'bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.8)] text-[hsl(var(--primary-foreground))]',
                'hover:opacity-90 hover:shadow-[0_8px_24px_rgba(200,169,107,0.25)]',
                'disabled:opacity-40 disabled:cursor-not-allowed')}>
              {selectedCarTypeId ? (()=>{
                const r=quoteResults.find(q=>q.service_class_id===selectedCarTypeId);
                if(!r) return 'Book Now';
                const snap = r.pricing_snapshot_preview ?? {};
                const hasD = (snap.discount_amount_minor ?? 0) > 0;
                const total = typeof snap.final_fare_minor === 'number' ? snap.final_fare_minor : 0;
                return <>Book Now — <span className="flex items-center gap-1.5"><span className={hasD?'text-emerald-300':''}>{fmtMoney(total, currency)}</span></span><ArrowRight className="h-4 w-4 ml-1"/></>;
              })() : 'Select a vehicle to continue'}
            </button>

            <p className="text-center text-xs text-gray-400 leading-relaxed">
              Fare is an estimate. Final price confirmed at booking.{' '}
              <span className="text-[hsl(var(--primary)/0.7)]">Quote valid for 30 minutes.</span>
            </p>

            {lastQuoteDebug && (
              <details className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-xs">
                <summary className="cursor-pointer font-semibold text-gray-300">Debug · Quote Inputs + Snapshot</summary>
                <div className="mt-3 grid gap-3">
                  <div>
                    <div className="font-semibold text-gray-400 mb-1">Quote Payload</div>
                    <pre className="whitespace-pre-wrap break-all text-gray-300">{JSON.stringify(lastQuoteDebug, null, 2)}</pre>
                  </div>
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>

    {/* Urgent Booking Modal */}
    {showUrgentModal && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={()=>setShowUrgentModal(false)}>
        <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[hsl(228,10%,8%)] p-7 shadow-2xl text-center" onClick={e=>e.stopPropagation()}>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--primary)/0.15)] border border-[hsl(var(--primary)/0.3)]">
            <svg className="h-7 w-7 text-[hsl(var(--primary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"/></svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Short Notice Booking</h3>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">Bookings require at least <strong className="text-white">12 hours' notice</strong> for online reservations. For urgent requests, please call us directly.</p>
          <a href="tel:+61280091008" className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-semibold text-sm hover:opacity-90 transition-all mb-3">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"/></svg>
            Call Now: +61 2 8009 1008
          </a>
          <button onClick={()=>setShowUrgentModal(false)} className="w-full py-2.5 rounded-xl border border-white/10 text-sm text-gray-400 hover:text-white hover:border-white/10 transition-colors">Change Date & Time</button>
        </div>
      </div>
    )}
    </>
  );
}
