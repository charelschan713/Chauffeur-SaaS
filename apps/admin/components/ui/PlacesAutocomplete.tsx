'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '@/lib/api';

interface Prediction {
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

function useSessionToken() {
  const ref = useRef<string>(Math.random().toString(36).slice(2));
  return ref.current;
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
  // Dropdown portal position
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [mounted, setMounted] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionToken = useSessionToken();

  useEffect(() => { setMounted(true); }, []);

  // Sync external value changes (form reset)
  useEffect(() => { setQuery(value); }, [value]);

  // Position the portal dropdown relative to the input
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

  // Debounced fetch
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim() || query.trim().length < 2) {
      setPredictions([]);
      setOpen(false);
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
          `/maps/autocomplete?input=${encodeURIComponent(query.trim())}&sessiontoken=${sessionToken}${biasParams}${cityParam}`,
        );
        if (res.data?.error) console.warn('[PlacesAutocomplete]', res.data.error);
        const preds: Prediction[] = res.data?.predictions ?? [];
        setPredictions(preds);
        if (preds.length > 0) {
          updateDropdownPosition();
          setOpen(true);
        } else {
          setOpen(false);
        }
        setActiveIdx(-1);
      } catch {
        setPredictions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, sessionToken]);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      const target = e.target as Node;
      // Close if click is outside the input container AND outside the portal dropdown
      const portalEl = document.getElementById('places-portal');
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        !(portalEl && portalEl.contains(target))
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open) return;
    const handleScroll = () => { if (open) updateDropdownPosition(); };
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function selectPrediction(p: Prediction) {
    setQuery(p.description);
    setPredictions([]);
    setOpen(false);
    onChange(p.description, p.place_id);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, predictions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); selectPrediction(predictions[activeIdx]); }
    else if (e.key === 'Escape') { setOpen(false); }
  }

  const dropdown = open && predictions.length > 0 && (
    <ul
      id="places-portal"
      role="listbox"
      style={dropdownStyle}
      className="bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden"
    >
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
          <span className="mt-0.5 text-gray-400 shrink-0">📍</span>
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate">{p.main_text}</p>
            {p.secondary_text && <p className="text-xs text-gray-500 truncate">{p.secondary_text}</p>}
          </div>
        </li>
      ))}
    </ul>
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
          onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); }}
          onFocus={() => {
            if (predictions.length > 0) { updateDropdownPosition(); setOpen(true); }
          }}
          onKeyDown={handleKeyDown}
          className={[
            'w-full border rounded-md px-3 py-2 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            error ? 'border-red-400' : 'border-gray-300',
            disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'bg-white',
          ].join(' ')}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs animate-pulse">…</span>
        )}
      </div>

      {/* Render dropdown in a portal so it escapes overflow:hidden parents */}
      {mounted && dropdown && createPortal(dropdown, document.body)}

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
