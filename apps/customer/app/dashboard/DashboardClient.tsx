'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import Link from 'next/link';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    CONFIRMED: 'bg-green-100 text-green-800',
    AWAITING_CONFIRMATION: 'bg-amber-100 text-amber-800',
    PAYMENT_FAILED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-600',
    COMPLETED: 'bg-blue-100 text-blue-800',
    ASSIGNED: 'bg-purple-100 text-purple-800',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function BookingCard({ booking }: { booking: any }) {
  return (
    <Link href={`/bookings/${booking.id}`} className="block border border-gray-200 rounded-xl p-4 hover:border-blue-400 transition-colors bg-white">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-gray-500 font-mono">{booking.booking_reference}</span>
        <StatusBadge status={booking.status} />
      </div>
      <p className="text-sm font-medium text-gray-900 mb-1 truncate">{booking.pickup_address}</p>
      <p className="text-xs text-gray-500 truncate">→ {booking.dropoff_address}</p>
      <p className="text-xs text-gray-400 mt-2">
        {booking.pickup_at_utc ? new Date(booking.pickup_at_utc).toLocaleString() : ''}
      </p>
    </Link>
  );
}

export function DashboardClient() {
  const router = useRouter();
  const { token, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (token === null && typeof window !== 'undefined') {
      const stored = localStorage.getItem('customer_token');
      if (!stored) router.push('/login');
    }
  }, [token, router]);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/customer-portal/dashboard').then((r) => r.data),
    enabled: !!token || (typeof window !== 'undefined' && !!localStorage.getItem('customer_token')),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const { customer, upcoming = [], past = [] } = data ?? {};

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              Hi, {customer?.first_name ?? 'there'} 👋
            </h1>
            <p className="text-xs text-gray-500">{customer?.email}</p>
          </div>
          <Link href="/profile" className="text-sm text-blue-600 hover:underline">Profile</Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <Link
          href="/book"
          className="block w-full py-3 text-center bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          + Book a ride
        </Link>

        {upcoming.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Upcoming</h2>
            <div className="space-y-3">
              {upcoming.map((b: any) => <BookingCard key={b.id} booking={b} />)}
            </div>
          </section>
        )}

        {past.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Past</h2>
            <div className="space-y-3">
              {past.map((b: any) => <BookingCard key={b.id} booking={b} />)}
            </div>
            <Link href="/bookings" className="block text-center text-sm text-blue-600 mt-3 hover:underline">
              View all bookings →
            </Link>
          </section>
        )}

        {upcoming.length === 0 && past.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">🚗</p>
            <p>No bookings yet. Book your first ride!</p>
          </div>
        )}

        <nav className="grid grid-cols-3 gap-3 pt-2">
          <Link href="/invoices" className="flex flex-col items-center py-3 px-2 bg-white rounded-xl border border-gray-200 text-xs text-gray-600 hover:border-blue-400">
            <span className="text-xl mb-1">🧾</span>Invoices
          </Link>
          <Link href="/profile" className="flex flex-col items-center py-3 px-2 bg-white rounded-xl border border-gray-200 text-xs text-gray-600 hover:border-blue-400">
            <span className="text-xl mb-1">👤</span>Profile
          </Link>
          <button
            onClick={() => { localStorage.clear(); router.push('/login'); }}
            className="flex flex-col items-center py-3 px-2 bg-white rounded-xl border border-gray-200 text-xs text-gray-600 hover:border-red-400"
          >
            <span className="text-xl mb-1">🚪</span>Sign out
          </button>
        </nav>
      </main>
    </div>
  );
}
