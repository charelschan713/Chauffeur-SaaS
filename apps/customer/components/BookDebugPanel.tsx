'use client';
import { useEffect, useState } from 'react';

interface BookDebugState {
  step: string;
  sessionLoaded: boolean;
  selectedResultAmount: number | null;
  tokenPresent: boolean;
  guestDataPresent: boolean;
  quoteId: string | null;
  carTypeId: string | null;
  sessionStorageQuoteId: string | null;
  lastRequestId: string | null;
  lastError: string | null;
  timestamp: string;
}

interface Props {
  step: string;
  session: any;
  selectedResult: any;
  token: string | null;
  guestData: any;
  quoteId: string | null;
  carTypeId: string | null;
  submitError: string | null;
}

const DEBUG = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true' || process.env.NODE_ENV === 'development';

export function BookDebugPanel(props: Props) {
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);
  const [sessionStorageQuoteId, setSessionStorageQuoteId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setLastRequestId((window as any).__lastRequestId ?? null);
      setSessionStorageQuoteId(sessionStorage.getItem('book_quote_id'));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Always log state changes to console
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const state: BookDebugState = {
      step: props.step,
      sessionLoaded: !!props.session,
      selectedResultAmount: props.selectedResult?.estimated_total_minor ?? null,
      tokenPresent: !!props.token,
      guestDataPresent: !!props.guestData,
      quoteId: props.quoteId,
      carTypeId: props.carTypeId,
      sessionStorageQuoteId: sessionStorage.getItem('book_quote_id'),
      lastRequestId: (window as any).__lastRequestId ?? null,
      lastError: props.submitError,
      timestamp: new Date().toISOString(),
    };
    console.log('[BOOK_STATE]', state);
  }, [props.step, props.session, props.selectedResult, props.token, props.guestData, props.submitError]);

  if (!DEBUG) return null;

  const state = {
    step: props.step,
    session: props.session ? '✅ loaded' : '❌ null',
    amount: props.selectedResult?.estimated_total_minor != null
      ? `$${(props.selectedResult.estimated_total_minor / 100).toFixed(2)}`
      : '❌ null',
    token: props.token ? '✅ present' : '❌ missing',
    guestData: props.guestData ? '✅ present' : '❌ null',
    quoteId: props.quoteId ?? '❌ null',
    carTypeId: props.carTypeId?.substring(0, 8) ?? '❌ null',
    ssQuoteId: sessionStorageQuoteId ?? '❌ null',
    reqId: lastRequestId?.substring(0, 16) ?? '—',
    error: props.submitError ?? '—',
  };

  return (
    <div style={{
      position: 'fixed', bottom: 80, right: 12, zIndex: 9999,
      fontFamily: 'monospace', fontSize: 11,
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: '#1e293b', color: '#c8a96b', border: '1px solid #c8a96b',
          borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'block',
          marginLeft: 'auto',
        }}
      >
        🐛 DEBUG
      </button>

      {open && (
        <div style={{
          marginTop: 6, background: '#0d0f14', border: '1px solid #334155',
          borderRadius: 8, padding: 12, minWidth: 240, color: '#e2e8f0',
          boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
        }}>
          <div style={{ color: '#c8a96b', fontWeight: 'bold', marginBottom: 8 }}>
            📋 /book State
          </div>
          {Object.entries(state).map(([key, val]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 3 }}>
              <span style={{ color: '#64748b' }}>{key}</span>
              <span style={{
                color: String(val).startsWith('❌') ? '#ef4444'
                  : String(val).startsWith('✅') ? '#22c55e'
                  : '#e2e8f0',
              }}>
                {String(val)}
              </span>
            </div>
          ))}
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #1e293b', color: '#475569', fontSize: 10 }}>
            Only visible in dev/debug mode
          </div>
        </div>
      )}
    </div>
  );
}
