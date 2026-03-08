'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { cn, fmtMoney } from '@/lib/utils';
import { ChevronRight, Plus, CalendarDays, MapPin, Car } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  PENDING_CUSTOMER_CONFIRMATION: { label: 'Confirming', color: 'bg-amber-500/15 text-amber-400 border-amber-500/25',    dot: 'bg-amber-400' },
  AWAITING_CONFIRMATION:         { label: 'Confirming', color: 'bg-amber-500/15 text-amber-400 border-amber-500/25',    dot: 'bg-amber-400' },
  CONFIRMED:                     { label: 'Confirmed',  color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', dot: 'bg-emerald-400' },
  ASSIGNED:                      { label: 'Assigned',   color: 'bg-blue-500/15 text-blue-400 border-blue-500/25',       dot: 'bg-blue-400' },
  IN_PROGRESS:                   { label: 'Ongoing',    color: 'bg-purple-500/15 text-purple-400 border-purple-500/25', dot: 'bg-purple-400 animate-pulse' },
  COMPLETED:                     { label: 'Completed',  color: 'bg-[hsl(var(--muted)/0.2)] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]',              dot: 'bg-[hsl(var(--muted-foreground))]' },
  CANCELLED:                     { label: 'Cancelled',  color: 'bg-red-500/15 text-red-400 border-red-500/25',          dot: 'bg-red-400' },
  PAYMENT_FAILED:                { label: 'Pay Failed', color: 'bg-red-500/15 text-red-400 border-red-500/25',          dot: 'bg-red-400' },
};

const TABS = ['Upcoming', 'Past', 'All'] as const;
type Tab = typeof TABS[number];

function fmtDate(utc: string, tz = 'Australia/Sydney') {
  return new Date(utc).toLocaleString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: tz,
  });
}

export default function BookingsPage() {
  const [tab, setTab] = useState<Tab>('Upcoming');

  const { data, isLoading } = useQuery({
    queryKey: ['bookings', tab],
    queryFn: () => api.get('/customer-portal/bookings', {
      params: {
        status: tab === 'Upcoming' ? 'upcoming' : tab === 'Past' ? 'past' : undefined,
        limit: 50,
      },
    }).then(r => r.data),
  });

  const bookings: any[] = data?.data ?? [];

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-white" style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}>

      {/* Sticky header */}
      <div
        className="sticky top-0 z-20 border-b border-[hsl(var(--border))]"
        style={{
          background: 'hsl(var(--background))',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          paddingTop: 'max(16px, env(safe-area-inset-top))',
        }}
      >
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-semibold text-white">My Bookings</h1>
            <Link
              href="/quote"
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-[hsl(var(--primary)/0.12)] border border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))] text-xs font-semibold active:scale-95 transition-transform"
            >
              <Plus className="h-3.5 w-3.5" /> New Booking
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex gap-0">
            {TABS.map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px min-h-[44px]',
                  tab === t
                    ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]'
                    : 'border-transparent text-white/35 active:text-gray-500',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-4 space-y-2.5">

        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-gray-100 border-t-[hsl(var(--primary))] rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && bookings.length === 0 && (
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 rounded-full bg-[hsl(var(--primary)/0.08)] border border-[hsl(var(--primary)/0.18)] flex items-center justify-center mx-auto">
              <Car className="h-7 w-7 text-[hsl(var(--primary)/0.5)]" />
            </div>
            <div>
              <p className="text-[hsl(var(--muted-foreground))] text-sm font-medium">No {tab.toLowerCase()} bookings</p>
              <p className="text-white/25 text-xs mt-1">Your trips will appear here</p>
            </div>
            <Link
              href="/quote"
              className="inline-flex items-center gap-2 mt-2 px-6 py-3 rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm font-semibold active:scale-95 transition-transform"
            >
              <Plus className="h-4 w-4" /> Book a Ride
            </Link>
          </div>
        )}

        {bookings.map((b: any) => {
          const s = STATUS_CONFIG[b.status] ?? { label: b.status?.replace(/_/g, ' '), color: 'bg-[hsl(var(--muted)/0.2)] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]', dot: 'bg-[hsl(var(--muted-foreground))]' };
          return (
            <Link
              key={b.id}
              href={`/bookings/${b.id}`}
              className="flex items-center gap-3 p-4 rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] active:scale-[0.99] active:bg-[hsl(var(--accent))] transition-all"
            >
              {/* Status dot */}
              <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', s.dot)} />

              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-mono text-white/35">{b.booking_reference}</span>
                  <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold border', s.color)}>
                    {s.label}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                  <CalendarDays className="h-3 w-3 shrink-0" />
                  <span>{fmtDate(b.pickup_at_utc, b.timezone)}</span>
                </div>

                {b.pickup_address && (
                  <div className="flex items-start gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                    <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                    <span className="truncate">{b.pickup_address}</span>
                  </div>
                )}

                <p className="text-sm font-semibold text-[hsl(var(--primary))]">
                  {fmtMoney(b.total_price_minor, b.currency ?? 'AUD')}
                </p>
              </div>

              <ChevronRight className="h-4 w-4 text-[hsl(var(--muted-foreground))/50] shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
