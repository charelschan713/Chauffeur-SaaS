'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import api from '@/lib/api';
import BottomNav from '@/components/BottomNav';

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
    <div className="min-h-screen bg-[hsl(var(--background))] pb-[100px]">
      <div className="bg-[hsl(var(--popover))] px-4 pt-12 pb-4">
        <h1 className="text-white text-[22px] font-bold">My Jobs</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[hsl(var(--border))] bg-[hsl(var(--popover))] px-4">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              `border-b-2 px-4 py-3 text-[13px] capitalize transition-colors ` +
              (tab === t
                ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))] font-semibold'
                : 'border-transparent text-[hsl(var(--muted-foreground))]')
            }
          >
            {t}
          </button>
        ))}
      </div>

      <div className="px-4 pt-4">
        {loading && <p className="py-10 text-center text-[hsl(var(--muted-foreground))]">Loading...</p>}
        {!loading && jobs.length === 0 && (
          <p className="py-10 text-center text-[hsl(var(--muted-foreground))]">No {tab} jobs</p>
        )}
        {jobs.map((a: any) => {
          const b = a.booking ?? {};
          return (
            <div
              key={a.id}
              onClick={() => router.push(`/jobs/${a.id}`)}
              className="mb-3 cursor-pointer rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3.5 transition-transform active:scale-[0.99]"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[11px] text-white/50">{b.booking_number}</span>
                <span className="text-[13px] font-bold text-[hsl(var(--primary))]">
                  {a.driver_pay_amount ? `$${a.driver_pay_amount.toFixed(2)}` : '—'}
                </span>
              </div>
              {b.pickup_at && (
                <p className="mb-1 text-[12px] text-[hsl(var(--muted-foreground))]">📅 {fmtDate(b.pickup_at)}</p>
              )}
              {b.pickup_location && (
                <p className="truncate text-[12px] text-[hsl(var(--muted-foreground))]">📍 {b.pickup_location}</p>
              )}
            </div>
          );
        })}
      </div>

      <BottomNav active="jobs" />
    </div>
  );
}
