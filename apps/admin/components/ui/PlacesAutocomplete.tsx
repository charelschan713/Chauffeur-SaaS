'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import api from '@/lib/api';

interface Prediction {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
}

interface RecentPick {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
}

interface PlacesAutocompleteProps {
  value: string;
  onChange: (value: string, placeId?: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  cityLat?: number | null;
  cityLng?: number | null;
  cityName?: string | null;
}

const RECENT_KEY = 'asc_recent_places';
const RECENT_MAX = 3;

function getRecent(): RecentPick[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveRecent(pick: RecentPick) {
  const existing = getRecent().filter((r) => r.place_id !== pick.place_id);
  const next = [pick, ...existing].slice(0, RECENT_MAX);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

function generateToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Wrap matched parts of `text` with <strong> */
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const regex = new RegExp(`(${query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <strong key={i} className="font-semibold text-blue-700">{part}</strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export function PlacesAutocomplete({
  value,
  onChange,
  placeholder = 'Start typing an address…',
  error,
  disabled,
  className,
  cityLat,
  cityLng,
  cityName,
}: PlacesAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [showRecent, setShowRecent] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);
  const [recentPicks, setRecentPicks] = useState<RecentPick[]>([]);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [mounted, setMounted] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Session token — reset after each selection (Google billing best practice)
  const sessionTokenRef = useRef<string>(generateToken());

  useEffect(() => { setMounted(true); setRecentPicks(getRecent()); }, []);

  // Sync external value (form reset)
  useEffect(() => { setQuery(value); }, [value]);

  function updateDropdownPosition() {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    });
  }

  // Debounced fetch — 400ms
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim() || query.trim().length < 2) {
      setPredictions([]);
      setOpen(false);
      setHasQueried(false);
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const biasParams = cityLat != null && cityLng != null
          ? `&lat=${cityLat}&lng=${cityLng}`
          : '';
        const cityParam = cityName ? `&city=${encodeURIComponent(cityName)}` : '';
        const res = await api.get(
          `/maps/autocomplete?input=${encodeURIComponent(query.trim())}&sessiontoken=${sessionTokenRef.current}${biasParams}${cityParam}`,
        );
        const preds: Prediction[] = res.data?.predictions ?? [];
        setPredictions(preds);
        setHasQueried(true);
        updateDropdownPosition();
        setOpen(true);
        setShowRecent(false);
        setActiveIdx(-1);
      } catch {
        setPredictions([]);
        setHasQueried(true);
        setOpen(true); // show "no results" panel even on error
      } finally {
        setLoading(false);
      }
    }, 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, cityLat, cityLng, cityName]);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      const target = e.target as Node;
      const portalEl = document.getElementById('places-portal');
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        !(portalEl && portalEl.contains(target))
      ) {
        setOpen(false);
        setShowRecent(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open && !showRecent) return;
    const handleScroll = () => updateDropdownPosition();
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [open, showRecent]);

  const selectPrediction = useCallback((p: Prediction) => {
    setQuery(p.description);
    setPredictions([]);
    setOpen(false);
    setShowRecent(false);
    setHasQueried(false);
    // Reset session token after selection
    sessionTokenRef.current = generateToken();
    // Save to recent
    saveRecent(p);
    setRecentPicks(getRecent());
    onChange(p.description, p.place_id);
  }, [onChange]);

  function selectRecent(r: RecentPick) {
    setQuery(r.description);
    setShowRecent(false);
    setOpen(false);
    sessionTokenRef.current = generateToken();
    onChange(r.description, r.place_id);
  }

  function clearInput() {
    setQuery('');
    setPredictions([]);
    setOpen(false);
    setShowRecent(false);
    onChange('', undefined);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const list = predictions;
    const listLen = list.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, listLen - 1));
      if (!open && listLen > 0) { updateDropdownPosition(); setOpen(true); }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && list[activeIdx]) {
        selectPrediction(list[activeIdx]);
      } else if (list.length > 0) {
        // Enter with no highlight → pick top result
        selectPrediction(list[0]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setShowRecent(false);
    }
  }

  // Determine what to show in dropdown
  const showRecentPanel = showRecent && recentPicks.length > 0 && !open;
  const showPredictions = open && predictions.length > 0;
  const showNoResults = open && predictions.length === 0 && !loading && hasQueried && query.trim().length >= 2;

  const showLoadingPanel = open && loading && query.trim().length >= 2;
  const dropdownContent = (showRecentPanel || showPredictions || showNoResults || showLoadingPanel) && (
    <div
      id="places-portal"
      style={dropdownStyle}
      className="bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden"
    >
      {/* Recent picks */}
      {showRecentPanel && (
        <>
          <div className="px-3 pt-2 pb-1">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Recent</p>
          </div>
          <ul role="listbox">
            {recentPicks.map((r, idx) => (
              <li
                key={r.place_id}
                role="option"
                aria-selected={false}
                onMouseDown={(e) => { e.preventDefault(); selectRecent(r); }}
                className="px-4 py-3 cursor-pointer text-sm flex items-start gap-3 hover:bg-gray-50"
              >
                <span className="mt-0.5 text-gray-400 shrink-0 text-base">🕐</span>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{r.main_text}</p>
                  {r.secondary_text && <p className="text-xs text-gray-500 truncate">{r.secondary_text}</p>}
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-gray-100" />
        </>
      )}

      {/* Predictions */}
      {showPredictions && (
        <ul role="listbox">
          {predictions.map((p, idx) => (
            <li
              key={p.place_id}
              role="option"
              aria-selected={idx === activeIdx}
              onMouseDown={(e) => { e.preventDefault(); selectPrediction(p); }}
              onMouseEnter={() => setActiveIdx(idx)}
              className={[
                'px-4 py-3 cursor-pointer text-sm flex items-start gap-3',
                idx === activeIdx ? 'bg-blue-50' : 'hover:bg-gray-50',
              ].join(' ')}
            >
              <span className="mt-0.5 text-gray-400 shrink-0 text-base">📍</span>
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  <HighlightText text={p.main_text} query={query} />
                </p>
                {p.secondary_text && (
                  <p className="text-xs text-gray-500 truncate">
                    <HighlightText text={p.secondary_text} query={query} />
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Loading */}
      {showLoadingPanel && (
        <div className="px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
          <span className="animate-spin text-base">⌛</span> Searching…
        </div>
      )}

      {/* No results */}
      {showNoResults && (
        <div className="px-4 py-3 text-sm text-gray-400 italic">
          No results — try a more specific address or type manually
        </div>
      )}

      {/* Google attribution (required by ToS) */}
      <div className="px-3 py-1.5 border-t border-gray-100 flex justify-end">
        <span className="text-[10px] text-gray-400">Powered by Google</span>
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
          }}
          onFocus={() => {
            updateDropdownPosition();
            if (predictions.length > 0) {
              setOpen(true);
            } else if (!query.trim() && recentPicks.length > 0) {
              setShowRecent(true);
            }
          }}
          onBlur={() => {
            setTimeout(() => {
              if (predictions.length > 0 && query.trim() && query !== predictions[0]?.description) {
                selectPrediction(predictions[0]);
              }
              setOpen(false);
              setShowRecent(false);
            }, 150);
          }}
          onKeyDown={handleKeyDown}
          className={[
            'w-full border rounded-md px-3 py-2 text-sm pr-8',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            error ? 'border-red-400' : 'border-gray-300',
            disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'bg-white',
          ].join(' ')}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
        />
        {/* Clear button or loading indicator */}
        {loading ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs animate-pulse">…</span>
        ) : query ? (
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => { e.preventDefault(); clearInput(); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Clear"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        ) : null}
      </div>

      {mounted && dropdownContent && createPortal(dropdownContent, document.body)}

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
