'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { PageHeader } from '@/components/admin/PageHeader';
import { PageToolbar } from '@/components/admin/PageToolbar';
import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { getBookingStatusBadge } from '@/lib/ui/statusBadge';

interface Booking {
  id: string;
  booking_reference: string;
  customer_first_name: string;
  customer_last_name: string;
  passenger_name?: string | null;
  pickup_address_text?: string | null;
  dropoff_address_text?: string | null;
  pickup_at_utc?: string | null;
  operational_status: string;
  payment_status?: string | null;
  total_price_minor: number;
  currency: string;
}

const PAY_BADGE: Record<string, 'neutral' | 'warning' | 'success' | 'danger'> = {
  UNPAID: 'warning',
  AUTHORIZED: 'warning',
  PAID: 'success',
  REFUNDED: 'neutral',
  PARTIALLY_REFUNDED: 'neutral',
  FAILED: 'danger',
};

function formatTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function shortAddress(value?: string | null) {
  if (!value) return '—';
  return value.length > 36 ? `${value.slice(0, 36)}…` : value;
}

export default function BookingsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handle);
  }, [search]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['bookings', { statusFilter, debouncedSearch, page, limit }],
    queryFn: async () => {
      const res = await api.get('/bookings', {
        params: {
          operational_status: statusFilter || undefined,
          search: debouncedSearch || undefined,
          page,
          limit,
        },
      });
      return res.data ?? { data: [], meta: {} };
    },
  });

  const bookings: Booking[] = data?.data ?? [];
  const meta = data?.meta ?? {};
  const hasNext = meta?.has_next ?? false;

  const handleReset = () => {
    setStatusFilter('');
    setSearch('');
    setPage(1);
  };

  if (error) {
    return <ErrorAlert message="Unable to load bookings" onRetry={refetch} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        description="Manage and dispatch current bookings"
        actions={
          <Link href="/bookings/new">
            <Button>New Booking</Button>
          </Link>
        }
      />

      <PageToolbar
        left={
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search booking reference or customer"
            className="max-w-sm"
          />
        }
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Status</option>
              {['DRAFT','PENDING','CONFIRMED','ASSIGNED','IN_PROGRESS','JOB_STARTED','COMPLETED','JOB_COMPLETED','CANCELLED','NO_SHOW'].map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
            <Input type="date" disabled title="Coming soon" className="text-gray-400" />
            <Input type="date" disabled title="Coming soon" className="text-gray-400" />
            <Button variant="secondary" onClick={handleReset}>Reset</Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <LoadingSpinner />
        </div>
      ) : bookings.length === 0 ? (
        <EmptyState
          title="No bookings yet"
          description="Create your first booking to get started."
          action={
            <Link href="/bookings/new">
              <Button>New Booking</Button>
            </Link>
          }
        />
      ) : (
        <Table
          headers={['Reference', 'Customer', 'Route', 'Pickup Time', 'Status', 'Payment', 'Total']}
        >
          {bookings.map((booking) => {
            const customerName = booking.passenger_name || `${booking.customer_first_name ?? ''} ${booking.customer_last_name ?? ''}`.trim();
            return (
              <tr
                key={booking.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => router.push(`/bookings/${booking.id}`)}
              >
                <td className="px-6 py-4 font-medium text-gray-900">{booking.booking_reference}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{customerName || '—'}</td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {shortAddress(booking.pickup_address_text)} → {shortAddress(booking.dropoff_address_text)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">{formatTime(booking.pickup_at_utc)}</td>
                <td className="px-6 py-4 text-sm">
                  <Badge variant={getBookingStatusBadge(booking.operational_status)}>
                    {booking.operational_status}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-sm">
                  <Badge variant={PAY_BADGE[booking.payment_status ?? ''] ?? 'neutral'}>
                    {booking.payment_status ?? '—'}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {booking.currency} {(booking.total_price_minor / 100).toFixed(2)}
                </td>
              </tr>
            );
          })}
        </Table>
      )}

      <div className="flex items-center justify-between">
        <Button
          variant="secondary"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Prev
        </Button>
        <div className="text-sm text-gray-500">Page {page}</div>
        <Button
          variant="secondary"
          disabled={!hasNext}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
