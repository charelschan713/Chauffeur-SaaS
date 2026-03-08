'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Clock, ChevronRight, Plus, User, FileText, Car, Users, CreditCard, MapPin } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { fmtMoney, fmtDateTime } from '@/lib/utils';
import { useTenant } from '@/components/TenantProvider';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PENDING_CUSTOMER_CONFIRMATION: { label: 'Awaiting Payment', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    PENDING:                       { label: 'Pending',          cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    CONFIRMED:                     { label: 'Confirmed',        cls: 'bg-green-100 text-green-700 border-green-200' },
    ASSIGNED:                      { label: 'Driver Assigned',  cls: 'bg-blue-100 text-blue-700 border-blue-200' },
    IN_PROGRESS:                   { label: 'In Progress',      cls: 'bg-purple-100 text-purple-700 border-purple-200' },
    COMPLETED:                     { label: 'Completed',        cls: 'bg-gray-100 text-gray-500 border-gray-200' },
    CANCELLED:                     { label: 'Cancelled',        cls: 'bg-red-100 text-red-600 border-red-200' },
    NO_SHOW:                       { label: 'No Show',          cls: 'bg-red-100 text-red-600 border-red-200' },
  };
  const { label, cls } = map[status] ?? { label: status.replace(/_/g, ' '), cls: 'bg-gray-100 text-gray-500 border-gray-200' };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  );
}

function BookingCard({ booking, upcoming }: { booking: any; upcoming?: boolean }) {
  return (
    <Link
      href={`/bookings/${booking.id}`}
      className={[
        'block rounded-2xl p-4 transition-all duration-200 hover:shadow-md active:scale-[0.99]',
        upcoming
          ? 'bg-[#1a1a1a] text-white shadow-sm'
          : 'bg-white border border-gray-100 shadow-sm',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className={`text-[11px] font-mono font-semibold ${upcoming ? 'text-white/50' : 'text-gray-400'}`}>
          {booking.booking_reference}
        </span>
        <StatusBadge status={booking.status} />
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-start gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
          <span className={`text-sm leading-snug line-clamp-1 ${upcoming ? 'text-white/85' : 'text-gray-800'}`}>
            {booking.pickup_address ?? '—'}
          </span>
        </div>
        {booking.dropoff_address && (
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-red-400 mt-1.5 shrink-0" />
            <span className={`text-sm leading-snug line-clamp-1 ${upcoming ? 'text-white/60' : 'text-gray-500'}`}>
              {booking.dropoff_address}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-1.5 text-xs ${upcoming ? 'text-white/40' : 'text-gray-400'}`}>
          <Clock className="h-3 w-3" />
          {booking.pickup_at_utc ? fmtDateTime(booking.pickup_at_utc) : '—'}
        </div>
        <div className="flex items-center gap-2">
          {booking.total_price_minor > 0 && (
            <span className={`text-sm font-bold ${upcoming ? 'text-[#c8a96b]' : 'text-gray-900'}`}>
              {fmtMoney(booking.total_price_minor, booking.currency ?? 'AUD')}
            </span>
          )}
          <ChevronRight className={`h-4 w-4 ${upcoming ? 'text-white/25' : 'text-gray-300'}`} />
        </div>
      </div>
    </Link>
  );
}

export function DashboardClient() {
  const router = useRouter();
  const { token, hydrate } = useAuthStore();
  const tenant = useTenant();

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
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#1a1a1a] border-t-transparent animate-spin" />
      </div>
    );
  }

  const { customer, upcoming = [], past = [] } = data ?? {};
  const firstName = customer?.first_name ?? 'there';

  return (
    <div className="min-h-screen bg-[#f5f5f5]">

      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 pb-4">
          <div>
            {tenant?.logo_url
              ? <img src={tenant.logo_url} alt={tenant.name} className="h-7 object-contain mb-0.5" />
              : <p className="font-bold text-gray-900 text-base">{tenant?.name ?? 'Portal'}</p>
            }
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <p className="text-xs text-gray-400">Welcome back, {firstName}</p>
              {customer?.tier && customer.tier !== 'STANDARD' && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  customer.tier === 'VIP'
                    ? 'bg-[#c8a96b] text-black'
                    : customer.tier === 'PLATINUM'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-gray-900 text-white'
                }`}>{customer.tier}</span>
              )}
              {customer?.discount_rate > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                  {Number(customer.discount_rate).toFixed(0)}% OFF
                </span>
              )}
            </div>
          </div>
          <Link href="/profile"
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
            <User className="h-4.5 w-4.5 text-gray-600" />
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-5 space-y-5"
        style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 24px))' }}>

        {/* Book CTA */}
        <Link href="/quote"
          className="flex items-center justify-between w-full px-5 py-4 rounded-2xl bg-[#1a1a1a] text-white hover:bg-[#2a2a2a] transition-colors shadow-sm active:scale-[0.99]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold">Book a Ride</p>
              <p className="text-xs text-white/50">Get an instant quote</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-white/40" />
        </Link>

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Upcoming</h2>
              <span className="text-xs bg-[#c8a96b] text-black px-2 py-0.5 rounded-full font-bold">
                {upcoming.length}
              </span>
            </div>
            <div className="space-y-3">
              {upcoming.map((b: any) => <BookingCard key={b.id} booking={b} upcoming />)}
            </div>
          </section>
        )}

        {/* Past */}
        {past.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Past Trips</h2>
            <div className="space-y-2">
              {past.map((b: any) => <BookingCard key={b.id} booking={b} />)}
            </div>
            <Link href="/bookings"
              className="flex items-center justify-center gap-1.5 mt-3 text-sm text-[#c8a96b] font-semibold py-2">
              View all trips <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </section>
        )}

        {/* Empty */}
        {upcoming.length === 0 && past.length === 0 && (
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mx-auto">
              <Car className="h-7 w-7 text-gray-400" />
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-lg">No trips yet</p>
              <p className="text-sm text-gray-400 mt-1">Book your first ride today</p>
            </div>
          </div>
        )}

        {/* Quick nav */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { href: '/passengers',      icon: <Users className="h-5 w-5 text-gray-600" />,    label: 'Passengers' },
            { href: '/invoices',        icon: <FileText className="h-5 w-5 text-gray-600" />, label: 'Invoices' },
            { href: '/payment-methods', icon: <CreditCard className="h-5 w-5 text-gray-600" />, label: 'Payments' },
          ].map(({ href, icon, label }) => (
            <Link key={href} href={href}
              className="flex flex-col items-center gap-2 py-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow active:scale-95">
              <span>{icon}</span>
              <span className="text-xs text-gray-500 font-medium">{label}</span>
            </Link>
          ))}
        </div>

      </main>
    </div>
  );
}
