'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { cn, fmtMoney } from '@/lib/utils';
import { ChevronRight, Plus, CalendarDays, MapPin } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  PENDING_CUSTOMER_CONFIRMATION: { label: 'Pending',    color: 'bg-amber-500/15 text-amber-400 border-amber-500/25',   dot: 'bg-amber-400' },
  AWAITING_CONFIRMATION:         { label: 'Confirming', color: 'bg-amber-500/15 text-amber-400 border-amber-500/25',   dot: 'bg-amber-400' },
  CONFIRMED:                     { label: 'Confirmed',  color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', dot: 'bg-emerald-400' },
  IN_PROGRESS:                   { label: 'Ongoing',   color: 'bg-blue-500/15 text-blue-400 border-blue-500/25',      dot: 'bg-blue-400 animate-pulse' },
  COMPLETED:                     { label: 'Completed', color: 'bg-white/8 text-white/40 border-white/10',              dot: 'bg-white/30' },
  CANCELLED:                     { label: 'Cancelled', color: 'bg-red-500/15 text-red-400 border-red-500/25',         dot: 'bg-red-400' },
  PAYMENT_FAILED:                { label: 'Pay Failed', color: 'bg-red-500/15 text-red-400 border-red-500/25',        dot: 'bg-red-400' },
};

const TABS = ['Upcoming', 'Past', 'All'] as const;
type Tab = typeof TABS[number];

function statusForTab(tab: Tab): string | undefined {
  if (tab === 'Upcoming') return 'upcoming';
  if (tab === 'Past')     return 'past';
  return undefined;
}

function fmtDate(utc: string, tz = 'Australia/Sydney') {
  return new Date(utc).toLocaleString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: tz,
  });
}

export default function BookingsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('Upcoming');

  const { data, isLoading } = useQuery({
    queryKey: ['bookings', tab],
    queryFn: () => api.get('/customer-portal/bookings', {
      params: { status: statusForTab(tab), limit: 50 },
    }).then(r => r.data),
  });

  const bookings: any[] = data?.data ?? [];

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[hsl(228,12%,8%)] border-b border-white/8 px-4 pt-12 pb-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold text-white">My Bookings</h1>
          <Link href="/quote" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[hsl(var(--primary)/0.15)] border border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))] text-xs font-semibold">
            <Plus className="h-3.5 w-3.5" /> New Booking
          </Link>
        </div>
        {/* Tabs */}
        <div className="flex gap-0 border-b border-white/8">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px',
                tab === t
                  ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                  : 'border-transparent text-white/40 hover:text-white/60')}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-3">
        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-white/20 border-t-[hsl(var(--primary))] rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && bookings.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <CalendarDays className="h-10 w-10 text-white/20 mx-auto" />
            <p className="text-white/40 text-sm">No {tab.toLowerCase()} bookings</p>
            <Link href="/quote" className="inline-block mt-2 px-5 py-2.5 rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm font-semibold">
              Book a Ride
            </Link>
          </div>
        )}

        {bookings.map((b: any) => {
          const s = STATUS_CONFIG[b.status] ?? { label: b.status, color: 'bg-white/8 text-white/40 border-white/10', dot: 'bg-white/30' };
          return (
            <Link key={b.id} href={`/bookings/${b.id}`}
              className="flex items-center gap-3 p-4 rounded-2xl bg-white/4 border border-white/8 hover:border-white/16 hover:bg-white/6 transition-all group">
              {/* Status dot */}
              <div className={cn('w-2.5 h-2.5 rounded-full shrink-0 mt-0.5', s.dot)} />

              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-white/40">{b.booking_reference}</span>
                  <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold border', s.color)}>{s.label}</span>
                </div>

                <div className="flex items-start gap-1.5 text-xs text-white/60">
                  <CalendarDays className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{fmtDate(b.pickup_at_utc, b.timezone)}</span>
                </div>

                {b.pickup_address && (
                  <div className="flex items-start gap-1.5 text-xs text-white/50 truncate">
                    <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                    <span className="truncate">{b.pickup_address}</span>
                  </div>
                )}

                <div className="text-sm font-semibold text-[hsl(var(--primary))]">
                  {fmtMoney(b.total_price_minor, b.currency ?? 'AUD')}
                </div>
              </div>

              <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-white/40 shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
