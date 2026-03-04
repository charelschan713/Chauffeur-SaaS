'use client';

import { useEffect, useRef, useState } from 'react';
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
}

// Stable session token per component mount (reduces API billing)
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
}: PlacesAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionToken = useSessionToken();

  // Sync external value changes (e.g. form reset)
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Debounced autocomplete fetch
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim() || query.trim().length < 3) {
      setPredictions([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await api.get(
          `/maps/autocomplete?input=${encodeURIComponent(query.trim())}&sessiontoken=${sessionToken}`,
        );
        const preds: Prediction[] = res.data?.predictions ?? [];
        if (res.data?.error) {
          // Surface API config error visually
          console.warn('[PlacesAutocomplete]', res.data.error);
        }
        setPredictions(preds);
        setOpen(preds.length > 0);
        setActiveIdx(-1);
      } catch {
        setPredictions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query, sessionToken]);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  function selectPrediction(p: Prediction) {
    setQuery(p.description);
    setPredictions([]);
    setOpen(false);
    onChange(p.description, p.place_id);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, predictions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      selectPrediction(predictions[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <div className="relative">
        <input
          type="text"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            // If user clears or edits, notify parent immediately
            onChange(e.target.value);
          }}
          onFocus={() => {
            if (predictions.length > 0) setOpen(true);
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
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs animate-pulse">
            …
          </span>
        )}
      </div>

      {open && predictions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
        >
          {predictions.map((p, idx) => (
            <li
              key={p.place_id}
              role="option"
              aria-selected={idx === activeIdx}
              onMouseDown={() => selectPrediction(p)}
              onMouseEnter={() => setActiveIdx(idx)}
              className={[
                'px-4 py-3 cursor-pointer text-sm flex items-start gap-3',
                idx === activeIdx ? 'bg-blue-50' : 'hover:bg-gray-50',
              ].join(' ')}
            >
              {/* Pin icon */}
              <span className="mt-0.5 text-gray-400 shrink-0">📍</span>
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{p.main_text}</p>
                {p.secondary_text && (
                  <p className="text-xs text-gray-500 truncate">{p.secondary_text}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
