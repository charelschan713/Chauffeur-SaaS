import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const DAYS   = ['SU','MO','TU','WE','TH','FR','SA'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

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
    <div className="cw-calendar" style={{minWidth:264}}>
      <div className="cw-calendar-header">
        <button type="button" onClick={()=>setView(v=>new Date(v.getFullYear(),v.getMonth()-1,1))} className="cw-calendar-nav">
          <svg className="cw-dt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span className="cw-calendar-title">{MONTHS[month]} {year}</span>
        <button type="button" onClick={()=>setView(v=>new Date(v.getFullYear(),v.getMonth()+1,1))} className="cw-calendar-nav">
          <svg className="cw-dt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
      <div className="cw-calendar-dow">{DAYS.map(d=><div key={d} className="cw-calendar-dow-cell">{d}</div>)}</div>
      <div className="cw-calendar-grid">
        {cells.map((day,i)=>{
          if(!day) return <div key={i}/>;
          const cellDate=new Date(year,month,day); const iso=dateToIso(cellDate);
          const isDisabled=minD?cellDate<minD:false; const isSelected=value===iso; const isToday=dateToIso(today)===iso;
          return <button type="button" key={i} disabled={isDisabled} onMouseDown={e=>e.preventDefault()} onClick={()=>!isDisabled&&onChange(iso)}
            className={cn('cw-calendar-day',
              isDisabled&&'is-disabled',
              !isDisabled&&!isSelected&&'is-available',
              isSelected&&'is-selected',
              isToday&&!isSelected&&'is-today')}>{day}</button>;
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
  const itemCls=(sel:boolean)=>cn('cw-timepicker-item',sel?'is-selected':'');
  return (
    <div className="cw-timepicker" style={{minWidth:200}}>
      <div className="cw-timepicker-header">
        {['Hour','Min','Period'].map(l=><div key={l} className="cw-timepicker-header-cell">{l}</div>)}
      </div>
      <div className="cw-timepicker-cols">
        <div className="cw-timepicker-col">{hours.map(h=><div key={h} data-selected={h===hour} className={itemCls(h===hour)} onMouseDown={e=>e.preventDefault()} onClick={()=>{setHour(h);commit(h,minute,period);}}>{String(h).padStart(2,'0')}</div>)}</div>
        <div className="cw-timepicker-col">{minutes.map(m=><div key={m} data-selected={m===minute} className={itemCls(m===minute)} onMouseDown={e=>e.preventDefault()} onClick={()=>{setMinute(m);commit(hour,m,period);}}>{String(m).padStart(2,'0')}</div>)}</div>
        <div className="cw-timepicker-col">{(['AM','PM'] as const).map(p=><div key={p} data-selected={p===period} className={itemCls(p===period)} onMouseDown={e=>e.preventDefault()} onClick={()=>{setPeriod(p);commit(hour,minute,p);}}>{p}</div>)}</div>
      </div>
      <div className="cw-timepicker-footer"><button type="button" onClick={()=>{commit(hour,minute,period);onConfirm();}} className="cw-timepicker-confirm">Confirm</button></div>
    </div>
  );
}

function DropdownPortal({ anchor, onClose, children }: { anchor: React.RefObject<HTMLElement | null>; onClose: () => void; children: React.ReactNode }) {
  const [pos, setPos] = useState({top:0,left:0,width:0}); const panelRef = useRef<HTMLDivElement>(null);
  const updatePos = useCallback(()=>{
    const el=anchor.current; if(!el) return;
    const r=el.getBoundingClientRect();
    const vw=window.innerWidth; const vh=window.innerHeight; const margin=8;
    const panelW=Math.max(r.width, 264);
    const rawLeft=r.left;
    const clampedLeft=Math.min(rawLeft, vw - panelW - margin);
    const top = r.bottom + 6;
    const panelH = panelRef.current?.getBoundingClientRect().height ?? 0;
    const clampedTop = Math.max(margin, Math.min(top, vh - panelH - margin));
    setPos({top:clampedTop, left:Math.max(margin, clampedLeft), width:panelW});
  },[anchor]);
  useEffect(()=>{ updatePos(); window.addEventListener('scroll',updatePos,true); window.addEventListener('resize',updatePos); return()=>{ window.removeEventListener('scroll',updatePos,true); window.removeEventListener('resize',updatePos); }; },[updatePos]);
  useEffect(()=>{ const h=(e:MouseEvent)=>{ if(!anchor.current?.contains(e.target as Node)&&!panelRef.current?.contains(e.target as Node)) onClose(); }; document.addEventListener('mousedown',h,true); return()=>document.removeEventListener('mousedown',h,true); },[anchor,onClose]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div ref={panelRef} style={{position:'fixed',top:pos.top,left:pos.left,width:pos.width,zIndex:9999}} className="cw-datetime-portal rounded-xl border border-white/10 bg-[hsl(228,10%,8%)] shadow-2xl overflow-hidden" onMouseDown={e=>{e.stopPropagation();e.nativeEvent.stopImmediatePropagation();}}>
      {children}
    </div>, document.body
  );
}

function CalendarIcon({ className='' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="18" rx="3" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
function ClockIcon({ className='' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function LuxDateTimePicker({ dateValue, timeValue, onDateChange, onTimeChange, minDate }: { dateValue:string; timeValue:string; onDateChange:(v:string)=>void; onTimeChange:(v:string)=>void; minDate?:string }) {
  const [openDate, setOpenDate] = useState(false); const [openTime, setOpenTime] = useState(false);
  const dateRef = useRef<HTMLButtonElement>(null); const timeRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="cw-date-row">
      <div>
        <button ref={dateRef} type="button" className="cw-date-btn" onClick={()=>{setOpenDate(v=>!v);setOpenTime(false);}}>
          <CalendarIcon className="cw-dt-icon"/>
          <span className={cn('cw-date-text', dateValue ? 'is-value' : 'is-placeholder')}>{dateValue?fmtDisplayDate(dateValue):'Select date'}</span>
        </button>
        {openDate && <DropdownPortal anchor={dateRef} onClose={()=>setOpenDate(false)}><CalendarPicker value={dateValue} onChange={v=>{onDateChange(v);setOpenDate(false);}} minDate={minDate}/></DropdownPortal>}
      </div>
      <div>
        <button ref={timeRef} type="button" className="cw-date-btn" onClick={()=>{setOpenTime(v=>!v);setOpenDate(false);}}>
          <ClockIcon className="cw-dt-icon"/>
          <span className={cn('cw-date-text', timeValue ? 'is-value' : 'is-placeholder')}>{timeValue?fmtDisplayTime(timeValue):'Select time'}</span>
        </button>
        {openTime && <DropdownPortal anchor={timeRef} onClose={()=>setOpenTime(false)}><TimePicker value={timeValue} onChange={onTimeChange} onConfirm={()=>setOpenTime(false)}/></DropdownPortal>}
      </div>
    </div>
  );
}
