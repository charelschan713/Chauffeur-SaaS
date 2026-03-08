'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import api from '@/lib/api';
import BottomNav from '@/components/BottomNav';

const GOLD = '#C8A870', CARD = '#222236', MUTED = '#9CA3AF';
const TABS = ['upcoming', 'active', 'completed'] as const;
type Tab = typeof TABS[number];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Australia/Sydney' });
}

export default function JobsPage() {
  const router = useRouter();
  const { token } = useAuthStore();
  const [tab, setTab] = useState<Tab>('upcoming');
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { router.replace('/login'); return; }
    setLoading(true);
    api.get('/driver-app/assignments', { params: { filter: tab } })
      .then(r => { setJobs(r.data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token, tab]);

  return (
    <div style={{ minHeight: '100vh', background: '#1A1A2E', paddingBottom: 100 }}>
      <div style={{ padding: '48px 16px 16px', background: '#16162A' }}>
        <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: 0 }}>My Jobs</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '0.5px solid #333355', padding: '0 16px', background: '#16162A' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
              color: tab === t ? GOLD : MUTED, fontWeight: tab === t ? 600 : 400, fontSize: 13,
              borderBottom: tab === t ? `2px solid ${GOLD}` : '2px solid transparent', textTransform: 'capitalize' }}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {loading && <p style={{ color: MUTED, textAlign: 'center', padding: 40 }}>Loading...</p>}
        {!loading && jobs.length === 0 && (
          <p style={{ color: MUTED, textAlign: 'center', padding: 40 }}>No {tab} jobs</p>
        )}
        {jobs.map((a: any) => {
          const b = a.booking ?? {};
          const s = a.driver_execution_status ?? 'assigned';
          return (
            <div key={a.id} onClick={() => router.push(`/jobs/${a.id}`)}
              style={{ background: CARD, borderRadius: 12, padding: 14, marginBottom: 10, cursor: 'pointer', border: '0.5px solid #333355' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#ffffff55', fontSize: 11, fontFamily: 'monospace' }}>{b.booking_number}</span>
                <span style={{ color: GOLD, fontWeight: 700, fontSize: 13 }}>
                  {a.driver_pay_amount ? `$${a.driver_pay_amount.toFixed(2)}` : '—'}
                </span>
              </div>
              {b.pickup_at && <p style={{ color: MUTED, fontSize: 12, margin: '0 0 4px' }}>📅 {fmtDate(b.pickup_at)}</p>}
              {b.pickup_location && <p style={{ color: MUTED, fontSize: 12, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 {b.pickup_location}</p>}
            </div>
          );
        })}
      </div>

      <BottomNav active="jobs" />
    </div>
  );
}
