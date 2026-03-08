'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Clock, ChevronRight, User } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { fmtMoney, fmtDateTime } from '@/lib/utils';
import { useTenant } from '@/components/TenantProvider';

// ── Status badge (light theme) ────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; text: string }> = {
    PENDING_CUSTOMER_CONFIRMATION: { label: 'Awaiting Payment', bg: '#fef3c7', text: '#92400e' },
    PENDING:                       { label: 'Pending',          bg: '#fef3c7', text: '#92400e' },
    CONFIRMED:                     { label: 'Confirmed',        bg: '#dcfce7', text: '#166534' },
    ASSIGNED:                      { label: 'Driver Assigned',  bg: '#dbeafe', text: '#1e40af' },
    IN_PROGRESS:                   { label: 'In Progress',      bg: '#ede9fe', text: '#5b21b6' },
    COMPLETED:                     { label: 'Completed',        bg: '#f3f4f6', text: '#6b7280' },
    CANCELLED:                     { label: 'Cancelled',        bg: '#fee2e2', text: '#991b1b' },
    NO_SHOW:                       { label: 'No Show',          bg: '#fee2e2', text: '#991b1b' },
  };
  const { label, bg, text } = map[status] ?? { label: status.replace(/_/g, ' '), bg: '#f3f4f6', text: '#6b7280' };
  return (
    <span
      className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
      style={{ backgroundColor: bg, color: text }}
    >
      {label}
    </span>
  );
}

// ── Dark booking card (upcoming) — 1:1 ASDriver activeJobCard ────────────────
function DarkBookingCard({ booking }: { booking: any }) {
  return (
    <Link
      href={`/bookings/${booking.id}`}
      className="block rounded-2xl p-4 transition-all duration-200 active:scale-[0.98]"
      style={{ backgroundColor: '#1a1a1a' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-bold font-mono text-white">{booking.booking_reference}</span>
        <StatusBadge status={booking.operational_status ?? booking.status} />
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-start gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
          <span className="text-[13px] text-white/75 leading-snug line-clamp-1">{booking.pickup_address ?? booking.pickup_address_text ?? '—'}</span>
        </div>
        {(booking.dropoff_address ?? booking.dropoff_address_text) && (
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-red-400 mt-1.5 shrink-0" />
            <span className="text-[13px] text-white/75 leading-snug line-clamp-1">{booking.dropoff_address ?? booking.dropoff_address_text}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
          <Clock className="h-3 w-3" />
          {booking.pickup_at_utc ? fmtDateTime(booking.pickup_at_utc) : '—'}
        </div>
        <div className="flex items-center gap-1.5">
          {booking.total_price_minor > 0 && (
            <span className="text-[15px] font-bold" style={{ color: '#c8a96b' }}>
              {fmtMoney(booking.total_price_minor, booking.currency ?? 'AUD')}
            </span>
          )}
          <ChevronRight className="h-4 w-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
        </div>
      </div>
    </Link>
  );
}

// ── Light booking card (past) — 1:1 ASDriver pendingCard ─────────────────────
function LightBookingCard({ booking }: { booking: any }) {
  return (
    <Link
      href={`/bookings/${booking.id}`}
      className="block bg-white rounded-2xl p-4 transition-all duration-200 active:scale-[0.98]"
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-bold font-mono text-[#1a1a1a]">{booking.booking_reference}</span>
        <StatusBadge status={booking.operational_status ?? booking.status} />
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-start gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
          <span className="text-[13px] text-gray-500 leading-snug line-clamp-1">{booking.pickup_address ?? booking.pickup_address_text ?? '—'}</span>
        </div>
        {(booking.dropoff_address ?? booking.dropoff_address_text) && (
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-red-400 mt-1.5 shrink-0" />
            <span className="text-[13px] text-gray-500 leading-snug line-clamp-1">{booking.dropoff_address ?? booking.dropoff_address_text}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Clock className="h-3 w-3" />
          {booking.pickup_at_utc ? fmtDateTime(booking.pickup_at_utc) : '—'}
        </div>
        <div className="flex items-center gap-1.5">
          {booking.total_price_minor > 0 && (
            <span className="text-[15px] font-bold text-[#1a1a1a]">
              {fmtMoney(booking.total_price_minor, booking.currency ?? 'AUD')}
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-gray-300" />
        </div>
      </div>
    </Link>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function DashboardClient() {
  const router  = useRouter();
  const { token, hydrate } = useAuthStore();
  const tenant  = useTenant();

  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem('customer_token')) router.push('/login');
  }, [token, router]);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/customer-portal/dashboard').then(r => r.data),
    enabled: typeof window !== 'undefined' && !!localStorage.getItem('customer_token'),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f5f5f5' }}>
        <div className="w-8 h-8 rounded-full border-2 border-[#1a1a1a] border-t-transparent animate-spin" />
      </div>
    );
  }

  const { customer, upcoming = [], past = [] } = data ?? {};
  const firstName = customer?.first_name ?? 'there';

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5f5f5', color: '#1a1a1a' }}>

      {/* ── Header — Logo + Welcome + badges + avatar (1:1 ASDriver) ── */}
      <header
        className="sticky top-0 z-10 bg-white border-b"
        style={{
          borderBottomColor: '#f0f0f0',
          paddingTop: 'max(12px, env(safe-area-inset-top))',
        }}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 pb-3">
          <div>
            {tenant?.logo_url
              ? <img src={tenant.logo_url} alt={tenant.name} className="h-7 object-contain mb-1" />
              : <p className="font-bold text-base text-[#1a1a1a]">{tenant?.name ?? 'Portal'}</p>
            }
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              <p className="text-[12px]" style={{ color: '#666' }}>Welcome back, {firstName}</p>
              {customer?.tier && customer.tier !== 'STANDARD' && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: '#1a1a1a' }}>
                  {customer.tier}
                </span>
              )}
              {customer?.discount_rate > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                  {Number(customer.discount_rate).toFixed(0)}% OFF
                </span>
              )}
            </div>
          </div>
          <Link
            href="/profile"
            className="w-9 h-9 rounded-full flex items-center justify-center transition-transform active:scale-95"
            style={{ backgroundColor: '#f0f0f0' }}
          >
            <User className="h-4 w-4" style={{ color: '#1a1a1a' }} />
          </Link>
        </div>
      </header>

      <main
        className="max-w-2xl mx-auto px-4 pt-4 space-y-4"
        style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* ── Upcoming trips (dark cards) ── */}
        {upcoming.length > 0 && (
          <section className="space-y-3">
            {upcoming.map((b: any) => <DarkBookingCard key={b.id} booking={b} />)}
          </section>
        )}

        {/* ── Past trips section ── */}
        {past.length > 0 && (
          <section className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#999' }}>
              Past Trips
            </p>
            {past.map((b: any) => <LightBookingCard key={b.id} booking={b} />)}
          </section>
        )}

        {/* ── Empty state ── */}
        {upcoming.length === 0 && past.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <span className="text-5xl">🛣️</span>
            <p className="text-lg font-bold" style={{ color: '#1a1a1a' }}>No trips yet</p>
            <p className="text-sm" style={{ color: '#666' }}>Tap + to book your first luxury ride</p>
          </div>
        )}
      </main>
    </div>
  );
}
