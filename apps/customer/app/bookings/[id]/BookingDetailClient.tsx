'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import Link from 'next/link';

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: 'bg-green-100 text-green-800',
  AWAITING_CONFIRMATION: 'bg-amber-100 text-amber-800',
  PAYMENT_FAILED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
  COMPLETED: 'bg-blue-100 text-blue-800',
};

export function BookingDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => api.get(`/customer-portal/bookings/${id}`).then((r) => r.data),
  });

  const cancelMut = useMutation({
    mutationFn: () => api.post(`/customer-portal/bookings/${id}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['booking', id] }),
  });

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>;
  }

  if (!booking) return <div className="min-h-screen flex items-center justify-center text-gray-500">Booking not found</div>;

  const canCancel = ['DRAFT', 'PENDING', 'CONFIRMED', 'AWAITING_CONFIRMATION'].includes(booking.status);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Booking details</h1>
            <p className="text-xs font-mono text-gray-500">{booking.booking_reference}</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {booking.status === 'AWAITING_CONFIRMATION' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            ⏳ Your booking is awaiting confirmation. We&apos;ll charge your saved card once confirmed.
          </div>
        )}
        {booking.status === 'PAYMENT_FAILED' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
            ❌ Payment failed. Please contact us to resolve.
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
          <div className="flex items-start justify-between">
            <span className="text-sm font-medium text-gray-700">Status</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[booking.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {booking.status.replace(/_/g, ' ')}
            </span>
          </div>
          <hr className="border-gray-100" />
          <Row label="Pickup" value={booking.pickup_address} />
          <Row label="Drop-off" value={booking.dropoff_address} />
          <Row label="Date" value={new Date(booking.pickup_at_utc).toLocaleString()} />
          {booking.flight_number && <Row label="Flight" value={booking.flight_number} />}
          <Row label="Passengers" value={String(booking.passenger_count ?? 1)} />
          {booking.total_price_minor > 0 && (
            <Row label="Price" value={`${(booking.total_price_minor / 100).toFixed(2)} ${booking.currency}`} />
          )}
          <Row label="Payment" value={booking.payment_status ?? 'UNPAID'} />
        </div>

        {canCancel && (
          <button
            onClick={() => {
              if (confirm('Cancel this booking?')) cancelMut.mutate();
            }}
            disabled={cancelMut.isPending}
            className="w-full py-3 border border-red-300 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 disabled:opacity-50"
          >
            {cancelMut.isPending ? 'Cancelling...' : 'Cancel booking'}
          </button>
        )}
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 text-right max-w-[60%]">{value}</span>
    </div>
  );
}
