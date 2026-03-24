'use client';

import { useEffect, useRef, useState } from 'react';

// ── helpers ───────────────────────────────────────────────────────────────────

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** Snap a Date to nearest 5-min interval */
function snap5(d: Date): Date {
  const out = new Date(d);
  out.setMinutes(Math.round(out.getMinutes() / 5) * 5, 0, 0);
  return out;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfWeek(year: number, month: number) {
  // 0=Sun…6=Sat → convert to Mon-first (0=Mon…6=Sun)
  const d = new Date(year, month, 1).getDay();
  return (d + 6) % 7;
}

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const DOW = ['M','T','W','T','F','S','S'];
const MINUTES_5 = [0,5,10,15,20,25,30,35,40,45,50,55];

// ── props ─────────────────────────────────────────────────────────────────────

interface Props {
  value: string;           // ISO / datetime-local string
  onChange: (iso: string) => void;
  label?: string;
  error?: string;
  minDate?: string;        // optional min ISO
  placeholder?: string;
}

// ── component ─────────────────────────────────────────────────────────────────

export function DateTimePicker({ value, onChange, label, error, minDate, placeholder = 'Select date & time' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // parse current value
  const parsed = value ? new Date(value) : null;
  const snapped = parsed ? snap5(parsed) : null;

  // working state (before confirm)
  const now = snap5(new Date());
  const [draft, setDraft] = useState<Date>(snapped ?? now);

  // calendar nav
  const [calYear, setCalYear] = useState(draft.getFullYear());
  const [calMonth, setCalMonth] = useState(draft.getMonth());

  // sync when external value changes
  useEffect(() => {
    if (parsed) {
      const s = snap5(parsed);
      setDraft(s);
      setCalYear(s.getFullYear());
      setCalMonth(s.getMonth());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── draft helpers ──────────────────────────────────────────────────────────

  function setDraftDate(year: number, month: number, day: number) {
    setDraft((prev) => {
      const d = new Date(prev);
      d.setFullYear(year, month, day);
      return d;
    });
  }

  function setDraftHour(h12: number, isPm: boolean) {
    setDraft((prev) => {
      const d = new Date(prev);
      let h = h12 % 12;
      if (isPm) h += 12;
      d.setHours(h);
      return d;
    });
  }

  function setDraftMinute(m: number) {
    setDraft((prev) => {
      const d = new Date(prev); d.setMinutes(m); return d;
    });
  }

  function toggleAmPm() {
    setDraft((prev) => {
      const d = new Date(prev);
      d.setHours((d.getHours() + 12) % 24);
      return d;
    });
  }

  function handleConfirm() {
    // emit as UTC ISO string (so display + backend remain consistent)
    const iso = new Date(draft.getTime() - draft.getTimezoneOffset() * 60000).toISOString();
    onChange(iso);
    setOpen(false);
  }

  // ── calendar grid ──────────────────────────────────────────────────────────

  const totalDays = daysInMonth(calYear, calMonth);
  const startOffset = firstDayOfWeek(calYear, calMonth);
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];

  const draftHours24 = draft.getHours();
  const draftH12 = draftHours24 % 12 === 0 ? 12 : draftHours24 % 12;
  const isPm = draftHours24 >= 12;
  const draftMin = draft.getMinutes();
  const isToday = (day: number) =>
    calYear === new Date().getFullYear() &&
    calMonth === new Date().getMonth() &&
    day === new Date().getDate();
  const isSelected = (day: number) =>
    calYear === draft.getFullYear() &&
    calMonth === draft.getMonth() &&
    day === draft.getDate();

  // ── display label ──────────────────────────────────────────────────────────

  const displayValue = snapped
    ? snapped.toLocaleString('en-AU', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
      }).replace(',', '').replace(/\bam\b/, 'AM').replace(/\bpm\b/, 'PM')
    : '';

  return (
    <div className="relative" ref={ref}>
      {label && <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm text-left transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? 'border-red-400' : 'border-gray-200 hover:border-gray-300'
        } ${displayValue ? 'text-gray-900' : 'text-gray-400'}`}
      >
        <span>{displayValue || placeholder}</span>
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}

      {/* Popup */}
      {open && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl p-4 min-w-[340px]">
          <div className="flex gap-4">

            {/* ── Left: Calendar ──────────────────────────────────────── */}
            <div className="flex-1">
              {/* Month nav */}
              <div className="flex items-center justify-between mb-3">
                <button type="button" onClick={() => {
                  if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
                  else setCalMonth(m => m - 1);
                }} className="p-1 hover:bg-gray-100 rounded">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-sm font-semibold">{MONTHS[calMonth]} {calYear}</span>
                <button type="button" onClick={() => {
                  if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
                  else setCalMonth(m => m + 1);
                }} className="p-1 hover:bg-gray-100 rounded">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 mb-1">
                {DOW.map((d, i) => (
                  <div key={i} className="text-center text-xs text-gray-400 font-medium py-0.5">{d}</div>
                ))}
              </div>

              {/* Day grid */}
              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((day, i) => (
                  <button
                    key={i}
                    type="button"
                    disabled={!day}
                    onClick={() => day && setDraftDate(calYear, calMonth, day)}
                    className={`h-7 w-7 mx-auto rounded-full text-xs font-medium transition-colors ${
                      !day ? 'invisible' :
                      isSelected(day) ? 'bg-blue-600 text-white' :
                      isToday(day) ? 'border border-blue-400 text-blue-600' :
                      'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>

              {/* Today shortcut */}
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const t = snap5(new Date());
                    setDraft(t);
                    setCalYear(t.getFullYear());
                    setCalMonth(t.getMonth());
                  }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Today
                </button>
              </div>
            </div>

            {/* ── Right: Time ─────────────────────────────────────────── */}
            <div className="flex flex-col items-center gap-2 pt-1 min-w-[120px]">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Time</span>

              <div className="flex items-start gap-1">
                {/* Hour scroll */}
                <div className="flex flex-col items-center">
                  <button type="button" onClick={() => setDraftHour(draftH12 === 12 ? 1 : draftH12 + 1, isPm)}
                    className="p-0.5 hover:bg-gray-100 rounded">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <div className="w-10 h-8 flex items-center justify-center bg-blue-600 text-white font-bold rounded text-sm">
                    {pad(draftH12)}
                  </div>
                  <button type="button" onClick={() => setDraftHour(draftH12 === 1 ? 12 : draftH12 - 1, isPm)}
                    className="p-0.5 hover:bg-gray-100 rounded">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                <span className="text-lg font-bold text-gray-400 mt-1.5">:</span>

                {/* Minute — 5-min intervals */}
                <div className="flex flex-col items-center">
                  <button type="button"
                    onClick={() => setDraftMinute(MINUTES_5[(MINUTES_5.indexOf(draftMin) + 1) % MINUTES_5.length])}
                    className="p-0.5 hover:bg-gray-100 rounded">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <div className="w-10 h-8 flex items-center justify-center bg-blue-600 text-white font-bold rounded text-sm">
                    {pad(draftMin)}
                  </div>
                  <button type="button"
                    onClick={() => setDraftMinute(MINUTES_5[(MINUTES_5.indexOf(draftMin) - 1 + MINUTES_5.length) % MINUTES_5.length])}
                    className="p-0.5 hover:bg-gray-100 rounded">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* AM/PM */}
                <div className="flex flex-col gap-1 ml-1 mt-0.5">
                  <button
                    type="button"
                    onClick={() => { if (isPm) toggleAmPm(); }}
                    className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                      !isPm ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    am
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (!isPm) toggleAmPm(); }}
                    className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                      isPm ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    pm
                  </button>
                </div>
              </div>

              {/* Minutes quick-select */}
              <div className="grid grid-cols-3 gap-1 mt-1 w-full">
                {MINUTES_5.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDraftMinute(m)}
                    className={`py-1 rounded text-xs font-medium transition-colors ${
                      draftMin === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    :{pad(m)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Confirm footer ────────────────────────────────────────── */}
          <div className="mt-4 pt-3 border-t flex items-center justify-between gap-3">
            <span className="text-sm text-gray-500">
              {draft.toLocaleString('en-AU', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: 'numeric', minute: '2-digit', hour12: true,
              }).replace(',', '').replace(/\bam\b/, 'AM').replace(/\bpm\b/, 'PM')}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
