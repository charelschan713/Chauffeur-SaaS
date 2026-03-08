'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import api from '@/lib/api';
import BottomNav from '@/components/BottomNav';

const GOLD = '#C8A870';
const CARD = '#222236';
const MUTED = '#9CA3AF';

function fmtMoney(minor: number, currency = 'AUD') {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(minor / 100);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Australia/Sydney' });
}
function statusColor(s: string) {
  if (s === 'accepted' || s === 'on_the_way') return '#60A5FA';
  if (s === 'arrived' || s === 'passenger_on_board') return '#A78BFA';
  if (s === 'job_done') return '#9CA3AF';
  return GOLD;
}

export default function DashboardPage() {
  const router = useRouter();
  const { token, driverName, clearAuth } = useAuthStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { router.replace('/login'); return; }
    api.get('/driver-app/dashboard').then(r => { setData(r.data); setLoading(false); })
      .catch(() => { clearAuth(); router.replace('/login'); });
  }, [token]);

  if (loading) return <LoadingScreen />;

  const stats = data?.stats ?? {};
  const todayJobs: any[] = data?.today_jobs ?? [];
  const upcomingJobs: any[] = data?.upcoming_jobs ?? [];

  return (
    <div style={{ minHeight: '100vh', background: '#1A1A2E', paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: '48px 16px 20px', background: '#16162A' }}>
        <p style={{ color: MUTED, fontSize: 12, margin: '0 0 2px' }}>Welcome back</p>
        <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 700, margin: 0 }}>{driverName ?? 'Driver'}</h1>
      </div>

      <div style={{ padding: '0 16px' }}>
        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, margin: '16px 0' }}>
          {[
            { label: "Today's Jobs", val: stats.today_count ?? 0 },
            { label: 'This Week', val: stats.week_count ?? 0 },
            { label: 'Month Earnings', val: stats.month_earnings ? fmtMoney(stats.month_earnings * 100) : '$0.00' },
          ].map(s => (
            <div key={s.label} style={{ background: CARD, borderRadius: 12, padding: 14, border: '0.5px solid #333355' }}>
              <p style={{ color: GOLD, fontSize: 18, fontWeight: 700, margin: '0 0 4px' }}>{s.val}</p>
              <p style={{ color: MUTED, fontSize: 11, margin: 0 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Today's jobs */}
        {todayJobs.length > 0 && (
          <>
            <h2 style={{ color: '#fff', fontSize: 15, fontWeight: 600, margin: '20px 0 10px' }}>Today</h2>
            {todayJobs.map((j: any) => <JobCard key={j.id} job={j} onClick={() => router.push(`/jobs/${j.id}`)} />)}
          </>
        )}

        {/* Upcoming */}
        {upcomingJobs.length > 0 && (
          <>
            <h2 style={{ color: '#fff', fontSize: 15, fontWeight: 600, margin: '20px 0 10px' }}>Upcoming</h2>
            {upcomingJobs.map((j: any) => <JobCard key={j.id} job={j} onClick={() => router.push(`/jobs/${j.id}`)} />)}
          </>
        )}

        {todayJobs.length === 0 && upcomingJobs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: MUTED }}>
            <p style={{ fontSize: 32, margin: '0 0 8px' }}>🚗</p>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>No jobs today</p>
            <p style={{ fontSize: 13 }}>Your upcoming jobs will appear here</p>
          </div>
        )}
      </div>

      <BottomNav active="dashboard" />
    </div>
  );
}

function JobCard({ job, onClick }: { job: any; onClick: () => void }) {
  const s = job.driver_execution_status ?? 'assigned';
  return (
    <div onClick={onClick} style={{ background: CARD, borderRadius: 12, padding: 14, marginBottom: 10, cursor: 'pointer', border: '0.5px solid #333355' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ color: '#fff', fontSize: 12, fontFamily: 'monospace', opacity: 0.5 }}>{job.booking_number}</span>
        <span style={{ background: statusColor(s) + '22', color: statusColor(s), fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 999 }}>
          {s.replace(/_/g, ' ').toUpperCase()}
        </span>
      </div>
      {job.pickup_at && <p style={{ color: MUTED, fontSize: 12, margin: '0 0 6px' }}>📅 {fmtDate(job.pickup_at)}</p>}
      {job.pickup_location && <p style={{ color: MUTED, fontSize: 12, margin: 0 }}>📍 {job.pickup_location}</p>}
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: '#1A1A2E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: GOLD, fontSize: 14 }}>Loading...</div>
    </div>
  );
}
