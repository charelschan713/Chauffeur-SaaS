'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

interface Booking {
  id: string;
  booking_reference: string;
  customer_first_name: string;
  customer_last_name: string;
  operational_status: string;
  payment_status: string;
  pickup_at_utc: string;
  total_price_minor: number;
  currency: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  ASSIGNED: 'bg-purple-100 text-purple-800',
  IN_PROGRESS: 'bg-orange-100 text-orange-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  NO_SHOW: 'bg-red-100 text-red-800',
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/bookings')
      .then((r) => setBookings(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Bookings</h2>
        <Link
          href="/tenant/bookings/new"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          New Booking
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {['Reference', 'Customer', 'Status', 'Payment', 'Pickup', 'Amount', ''].map((h) => (
                <th
                  key={h}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {bookings.map((b) => (
              <tr key={b.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-mono text-sm">{b.booking_reference}</td>
                <td className="px-6 py-4">
                  {b.customer_first_name} {b.customer_last_name}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      STATUS_COLORS[b.operational_status] ?? 'bg-gray-100'
                    }`}
                  >
                    {b.operational_status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs text-gray-500">{b.payment_status}</span>
                </td>
                <td className="px-6 py-4 text-sm">
                  {new Date(b.pickup_at_utc).toLocaleString()}
                </td>
                <td className="px-6 py-4 text-sm font-medium">
                  {b.currency} {(b.total_price_minor / 100).toFixed(2)}
                </td>
                <td className="px-6 py-4">
                  <Link href={`/tenant/bookings/${b.id}`} className="text-blue-600 hover:underline text-sm">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {bookings.length === 0 && (
          <div className="text-center py-12 text-gray-500">No bookings yet</div>
        )}
      </div>
    </div>
  );
}
