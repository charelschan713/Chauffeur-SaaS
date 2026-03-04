'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/admin/PageHeader';

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
  OFFERED: 'bg-purple-100 text-purple-800',
  ACCEPTED: 'bg-indigo-100 text-indigo-800',
  DECLINED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-700',
  EXPIRED: 'bg-gray-100 text-gray-700',
  JOB_STARTED: 'bg-orange-100 text-orange-800',
  JOB_COMPLETED: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  IN_PROGRESS: 'bg-orange-100 text-orange-800',
  NO_SHOW: 'bg-red-100 text-red-800',
};

export default function BookingsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['bookings', { statusFilter, search }],
    queryFn: async () => {
      const res = await api.get('/bookings', {
        params: {
          operational_status: statusFilter || undefined,
          search: search || undefined,
        },
      });
      return res.data?.data ?? [];
    },
  });

  const bookings: Booking[] = data ?? [];

  const cancelBooking = async (id: string) => {
    await api.patch(`/bookings/${id}/cancel`);
    await queryClient.invalidateQueries({ queryKey: ['bookings'] });
  };

  if (isLoading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        description="Manage and dispatch current bookings"
        actions={
          <Link
            href="/bookings/new"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            New Booking
          </Link>
        }
      />

      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="">All Status</option>
          {Object.keys(STATUS_COLORS).map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search bookings"
          className="border rounded px-3 py-2 text-sm w-full md:max-w-xs"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Reference', 'Customer', 'Pickup Time', 'Status', 'Total', ''].map((h) => (
                <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {bookings.map((booking) => (
              <tr key={booking.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">{booking.booking_reference}</td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {booking.customer_first_name} {booking.customer_last_name}
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {booking.pickup_at_utc ? new Date(booking.pickup_at_utc).toLocaleString() : '—'}
                </td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 py-1 rounded text-xs ${STATUS_COLORS[booking.operational_status] ?? 'bg-gray-100 text-gray-700'}`}>
                    {booking.operational_status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {booking.currency} {(booking.total_price_minor / 100).toFixed(2)}
                </td>
                <td className="px-6 py-4 text-sm text-right space-x-2">
                  <Link className="text-blue-600 hover:underline" href={`/bookings/${booking.id}`}>
                    View
                  </Link>
                  <button className="text-red-600 hover:underline" onClick={() => cancelBooking(booking.id)}>
                    Cancel
                  </button>
                </td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-500">
                  No bookings found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
