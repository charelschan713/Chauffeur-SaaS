/**
 * PlacesAutocomplete — Custom dropdown via SaaS REST proxy
 *
 * NO Google Maps JS SDK. Calls /public/maps/autocomplete on the SaaS backend.
 * Full control over styling — matches dark luxury theme.
 */
import { useEffect, useRef, useState, useCallback, useId } from 'react';

const SAAS_API =
  import.meta.env.VITE_SAAS_API_URL ??
  'https://chauffeur-saas-production.up.railway.app';

interface Prediction {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
}

export interface CityBias {
  lat: number;
  lng: number;
}

export interface PlacesAutocompleteProps {
  tenantSlug: string;
  id?: string;
  name?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  pinColor?: 'green' | 'gold' | 'muted';
  /** Bias results toward this city (soft bias, not strict — inter-city routes still work) */
  cityBias?: CityBias;
}

function useDebounce<T>(value: T, delay: number): T {
  const [deb, setDeb] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDeb(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return deb;
}

function newSessionToken() {
  return Math.random().toString(36).slice(2);
}

const PIN_COLORS = {
  green: 'text-emerald-400',
  gold: 'text-amber-400',
  muted: 'text-slate-500',
} as const;

export default function PlacesAutocomplete({
  tenantSlug,
  id,
  name,
  placeholder = 'Enter a location',
  value = '',
  onChange,
  className = '',
  pinColor = 'muted',
  cityBias,
}: PlacesAutocompleteProps) {
  const uid = useId();
  const inputId = id ?? uid;

  const [inputValue, setInputValue] = useState(value);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const sessionTokenRef = useRef(newSessionToken());
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fetchIdRef = useRef(0);

  const debouncedInput = useDebounce(inputValue, 280);
  const cityKey = cityBias ? `${cityBias.lat},${cityBias.lng}` : '';

  const justSelectedRef = useRef(false);

  useEffect(() => {
    if (justSelectedRef.current) return;
    if (value !== inputValue) setInputValue(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      setPredictions([]);
      setOpen(false);
      return;
    }

    if (!debouncedInput.trim() || debouncedInput.length < 2) {
      setPredictions([]);
      setOpen(false);
      return;
    }

    const id = ++fetchIdRef.current;
    setLoading(true);

    const params = new URLSearchParams({
      tenant_slug: tenantSlug,
      input: debouncedInput,
      sessiontoken: sessionTokenRef.current,
    });

    if (cityBias) {
      params.set('lat', String(cityBias.lat));
      params.set('lng', String(cityBias.lng));
    }

    fetch(`${SAAS_API}/public/maps/autocomplete?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (id !== fetchIdRef.current) return;
        const preds: Prediction[] = data.predictions ?? [];
        setPredictions(preds);
        setOpen(preds.length > 0);
        setActiveIdx(-1);
      })
      .catch(() => {
        if (id !== fetchIdRef.current) return;
        setPredictions([]);
        setOpen(false);
      })
      .finally(() => {
        if (id === fetchIdRef.current) setLoading(false);
      });
  }, [debouncedInput, cityKey, tenantSlug]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIdx(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectPrediction = useCallback(
    (pred: Prediction) => {
      const val = pred.description || pred.main_text;
      justSelectedRef.current = true;
      setInputValue(val);
      setPredictions([]);
      setOpen(false);
      setActiveIdx(-1);
      sessionTokenRef.current = newSessionToken();
      onChange?.(val);
      inputRef.current?.blur();
    },
    [onChange],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInputValue(v);
    if (!v) onChange?.('');
  };

  const handleClear = () => {
    setInputValue('');
    setPredictions([]);
    setOpen(false);
    onChange?.('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || predictions.length === 0) return;
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
      setActiveIdx(-1);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative group">
        <span
          aria-hidden="true"
          className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none ${PIN_COLORS[pinColor]} transition-colors group-focus-within:${PIN_COLORS.gold}`}
          style={{ fontSize: 14, lineHeight: '16px' }}
        >
          ⌖
        </span>

        <input
          ref={inputRef}
          id={inputId}
          name={name}
          type="text"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (predictions.length > 0) setOpen(true);
          }}
          placeholder={placeholder}
          className="cw-input"
          style={{ paddingLeft: 36, paddingRight: 44 }}
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
          {loading ? (
            <span className="cw-muted" style={{ fontSize: 14 }} aria-hidden="true">⟳</span>
          ) : inputValue ? (
            <button
              type="button"
              onClick={handleClear}
              className="cw-muted"
              aria-label="Clear"
              style={{
                background: 'transparent',
                border: 0,
                cursor: 'pointer',
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span aria-hidden="true">×</span>
            </button>
          ) : null}
        </div>
      </div>

      {open && predictions.length > 0 && (
        <ul
          role="listbox"
          className="cw-ac-list"
        >
          {predictions.map((pred, idx) => (
            <li
              key={pred.place_id}
              role="option"
              aria-selected={idx === activeIdx}
              onMouseDown={(e) => {
                e.preventDefault();
                selectPrediction(pred);
              }}
              onMouseEnter={() => setActiveIdx(idx)}
              className={
                `cw-ac-item ${idx === activeIdx ? 'cw-ac-item-active' : ''}`
              }
            >
              <span
                aria-hidden="true"
                className={`h-4 w-4 mt-0.5 shrink-0 ${idx === activeIdx ? 'text-amber-400' : 'text-white/25'}`}
                style={{ fontSize: 14, lineHeight: '16px' }}
              >
                ⌖
              </span>
              <div className="min-w-0">
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,.92)', lineHeight: '18px' }}>
                  {pred.description || pred.main_text}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
