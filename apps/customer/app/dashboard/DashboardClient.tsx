'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { MapPin, Clock, ChevronRight, Plus, User, FileText, LogOut, Car } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { fmtMoney, fmtDateTime } from '@/lib/utils';
import { useTenant } from '@/components/TenantProvider';

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PENDING_CUSTOMER_CONFIRMATION: { label: 'Awaiting Confirmation', cls: 'bg-amber-400/15 text-amber-400 border-amber-400/30' },
    PENDING:                       { label: 'Pending',               cls: 'bg-amber-400/15 text-amber-400 border-amber-400/30' },
    CONFIRMED:                     { label: 'Confirmed',             cls: 'bg-emerald-400/15 text-emerald-400 border-emerald-400/30' },
    ASSIGNED:                      { label: 'Driver Assigned',       cls: 'bg-blue-400/15 text-blue-400 border-blue-400/30' },
    IN_PROGRESS:                   { label: 'In Progress',           cls: 'bg-purple-400/15 text-purple-400 border-purple-400/30' },
    COMPLETED:                     { label: 'Completed',             cls: 'bg-white/10 text-white/50 border-white/10' },
    CANCELLED:                     { label: 'Cancelled',             cls: 'bg-red-400/10 text-red-400/70 border-red-400/20' },
    NO_SHOW:                       { label: 'No Show',               cls: 'bg-red-400/10 text-red-400/70 border-red-400/20' },
  };
  const { label, cls } = map[status] ?? { label: status.replace(/_/g, ' '), cls: 'bg-white/10 text-white/50 border-white/10' };
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  );
}

// ── Booking card ──────────────────────────────────────────────────────────────
function BookingCard({ booking, upcoming }: { booking: any; upcoming?: boolean }) {
  return (
    <Link
      href={`/bookings/${booking.id}`}
      className={[
        "block rounded-2xl p-4 transition-all duration-200 group",
        upcoming
          ? "bg-gradient-to-br from-[hsl(var(--primary)/0.12)] to-[hsl(var(--primary)/0.05)] border border-[hsl(var(--primary)/0.25)] hover:border-[hsl(var(--primary)/0.5)]"
          : "bg-white/[0.03] border border-white/8 hover:border-white/20",
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="text-[11px] font-mono text-[hsl(var(--muted-foreground))]">
          {booking.booking_reference}
        </span>
        <StatusBadge status={booking.status} />
      </div>

      <div className="space-y-1.5 mb-3">
        <div className="flex items-start gap-2">
          <MapPin className="h-3.5 w-3.5 mt-0.5 text-emerald-400 shrink-0" />
          <span className="text-sm text-white/90 leading-tight line-clamp-1">{booking.pickup_address ?? '—'}</span>
        </div>
        {booking.dropoff_address && (
          <div className="flex items-start gap-2">
            <MapPin className="h-3.5 w-3.5 mt-0.5 text-[hsl(var(--primary))] shrink-0" />
            <span className="text-sm text-white/70 leading-tight line-clamp-1">{booking.dropoff_address}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
          <Clock className="h-3 w-3" />
          {booking.pickup_at_utc ? fmtDateTime(booking.pickup_at_utc) : '—'}
        </div>
        <div className="flex items-center gap-2">
          {booking.total_price_minor > 0 && (
            <span className="text-sm font-bold text-[hsl(var(--primary))]">
              {fmtMoney(booking.total_price_minor, booking.currency ?? 'AUD')}
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-white/50 transition-colors" />
        </div>
      </div>
    </Link>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function DashboardClient() {
  const router   = useRouter();
  const { token, hydrate } = useAuthStore();
  const tenant   = useTenant();

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('customer_token');
    if (!stored) router.push('/login');
  }, [token, router]);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/customer-portal/dashboard').then(r => r.data),
    enabled: typeof window !== 'undefined' && !!localStorage.getItem('customer_token'),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0d0f14] flex items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="w-10 h-10 rounded-full border-2 border-[hsl(var(--primary))] border-t-transparent animate-spin mx-auto" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  const { customer, upcoming = [], past = [] } = data ?? {};
  const firstName = customer?.first_name ?? 'there';

  return (
    <div className="min-h-screen bg-[#0d0f14] text-white">

      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#0d0f14]/95 backdrop-blur-md border-b border-white/8 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            {tenant?.logo_url && (
              <img src={tenant.logo_url} alt={tenant.name} className="h-7 object-contain mb-0.5" />
            )}
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Welcome back, {firstName}</p>
          </div>
          <Link href="/profile"
            className="w-9 h-9 rounded-full bg-[hsl(var(--primary)/0.15)] border border-[hsl(var(--primary)/0.3)] flex items-center justify-center hover:bg-[hsl(var(--primary)/0.25)] transition-colors">
            <User className="h-4 w-4 text-[hsl(var(--primary))]" />
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">

        {/* Book CTA */}
        <Link href="/quote"
          className="flex items-center justify-between w-full px-5 py-4 rounded-2xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary)/0.8)] text-[hsl(var(--primary-foreground))] font-semibold hover:opacity-90 transition-opacity shadow-[0_8px_24px_hsl(var(--primary)/0.25)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center">
              <Plus className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-wide">Book a Ride</p>
              <p className="text-[11px] opacity-70">Get an instant quote</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 opacity-60" />
        </Link>

        {/* Upcoming bookings */}
        {upcoming.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--primary))]">
                Upcoming
              </h2>
              <span className="text-xs bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))] px-2 py-0.5 rounded-full font-medium">
                {upcoming.length}
              </span>
            </div>
            <div className="space-y-3">
              {upcoming.map((b: any) => <BookingCard key={b.id} booking={b} upcoming />)}
            </div>
          </section>
        )}

        {/* Past bookings */}
        {past.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))] mb-3">
              Past Trips
            </h2>
            <div className="space-y-2">
              {past.map((b: any) => <BookingCard key={b.id} booking={b} />)}
            </div>
            <Link href="/bookings"
              className="flex items-center justify-center gap-1.5 mt-3 text-sm text-[hsl(var(--primary))] hover:text-[hsl(var(--primary)/0.8)] transition-colors">
              View all trips <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </section>
        )}

        {/* Empty state */}
        {upcoming.length === 0 && past.length === 0 && (
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 rounded-full bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.2)] flex items-center justify-center mx-auto">
              <Car className="h-7 w-7 text-[hsl(var(--primary)/0.6)]" />
            </div>
            <div>
              <p className="font-serif text-lg text-white/80">No trips yet</p>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">Book your first luxury ride today</p>
            </div>
          </div>
        )}

        {/* Quick nav */}
        <div className="grid grid-cols-3 gap-3 pt-2">
          {[
            { href: '/passengers', icon: <User className="h-5 w-5" />, label: 'Passengers' },
            { href: '/invoices',   icon: <FileText className="h-5 w-5" />, label: 'Invoices' },
            { href: '/profile',    icon: <User className="h-5 w-5" />, label: 'Profile' },
          ].map(({ href, icon, label }) => (
            <Link key={href} href={href}
              className="flex flex-col items-center gap-2 py-4 rounded-2xl bg-white/[0.03] border border-white/8 hover:border-[hsl(var(--primary)/0.3)] hover:bg-[hsl(var(--primary)/0.05)] transition-all">
              <span className="text-[hsl(var(--primary)/0.7)]">{icon}</span>
              <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{label}</span>
            </Link>
          ))}
        </div>

        {/* Sign out */}
        <button
          onClick={() => { localStorage.clear(); router.push('/login'); }}
          className="flex items-center gap-2 mx-auto text-sm text-[hsl(var(--muted-foreground))] hover:text-red-400 transition-colors py-2"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>

      </main>
    </div>
  );
}
