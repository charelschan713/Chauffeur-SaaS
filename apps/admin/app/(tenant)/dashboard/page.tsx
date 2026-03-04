'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/admin/PageHeader';
import { KpiCard } from '@/components/admin/KpiCard';
import { Card } from '@/components/ui/Card';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import {PageLoader, InlineSpinner} from '@/components/ui/LoadingSpinner';

export default function DashboardPage() {
  const router = useRouter();
  const { data: bookingsData, isLoading, error, refetch } = useQuery({
    queryKey: ['bookings-summary'],
    queryFn: async () => {
      const res = await api.get('/bookings');
      return res.data?.data ?? [];
    },
  });

  const { data: driversData } = useQuery({
    queryKey: ['drivers-summary'],
    queryFn: async () => {
      const res = await api.get('/drivers');
      return res.data ?? [];
    },
  });

  const bookings = Array.isArray(bookingsData) ? bookingsData : (bookingsData?.data ?? []);
  const drivers = Array.isArray(driversData) ? driversData : (driversData?.data ?? []);

  const today = new Date().toDateString();
  const todayBookings = bookings.filter((b: any) =>
    b.pickup_at_utc ? new Date(b.pickup_at_utc).toDateString() === today : false,
  );

  const inProgress = bookings.filter((b: any) =>
    ['JOB_STARTED', 'ASSIGNED', 'ACCEPTED'].includes(b.operational_status),
  );

  const completedToday = bookings.filter((b: any) =>
    b.operational_status === 'COMPLETED' || b.operational_status === 'JOB_COMPLETED',
  );

  const revenueToday = todayBookings.reduce((sum: number, b: any) => sum + (b.total_price_minor ?? 0), 0);

  const recentBookings = bookings.slice(0, 5);

  const driverAvailable = drivers.filter((d: any) => d.status === 'ACTIVE').length;
  const driverOffline = drivers.filter((d: any) => d.status === 'INACTIVE').length;
  const driverOnTrip = Math.max(drivers.length - driverAvailable - driverOffline, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Operational overview" />

      {error && <ErrorAlert message="Unable to load dashboard data" onRetry={refetch} />}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard title="Today's Bookings" value={todayBookings.length} />
        <KpiCard title="In Progress" value={inProgress.length} />
        <KpiCard title="Completed Today" value={completedToday.length} />
        <KpiCard title="Revenue Today" value={`$${(revenueToday / 100).toFixed(2)}`} />
      </div>

      <Card title="Recent Bookings">
        {isLoading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : (
          <Table
            headers={['Booking Ref', 'Customer', 'Route', 'Pickup Time', 'Status', 'Total']}
            empty={recentBookings.length === 0 ? 'No recent bookings' : undefined}
          >
            {recentBookings.map((booking: any) => (
              <tr
                key={booking.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => router.push(`/bookings/${booking.id}`)}
              >
                <td className="px-6 py-4 font-medium text-gray-900">{booking.booking_reference}</td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {booking.customer_first_name} {booking.customer_last_name}
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {booking.pickup_address_text} → {booking.dropoff_address_text}
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {booking.pickup_at_utc ? new Date(booking.pickup_at_utc).toLocaleString() : '—'}
                </td>
                <td className="px-6 py-4 text-sm">
                  <Badge variant="neutral">{booking.operational_status}</Badge>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">
                  {booking.currency} {(booking.total_price_minor / 100).toFixed(2)}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Driver Status">
          <div className="space-y-2 text-sm text-gray-700">
            <div className="flex items-center justify-between">
              <span>Available</span>
              <Badge variant="success">{driverAvailable}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>On Trip</span>
              <Badge variant="warning">{driverOnTrip}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Offline</span>
              <Badge variant="neutral">{driverOffline}</Badge>
            </div>
          </div>
        </Card>

        <Card title="Quick Actions">
          <div className="space-y-2">
            <Link
              href="/bookings/new"
              className="block px-4 py-2 rounded-md bg-blue-600 text-white text-sm text-center hover:bg-blue-700"
            >
              New Booking
            </Link>
            <Link
              href="/dispatch"
              className="block px-4 py-2 rounded-md border text-sm text-center hover:bg-gray-50"
            >
              Dispatch Board
            </Link>
            <Link
              href="/drivers"
              className="block px-4 py-2 rounded-md border text-sm text-center hover:bg-gray-50"
            >
              Add Driver
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
