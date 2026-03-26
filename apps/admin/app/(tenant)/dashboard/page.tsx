'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, Car, CheckCircle, DollarSign, Plus, ArrowRight, Clock } from 'lucide-react';
import api from '@/lib/api';
import { PageHeader } from '@/components/admin/PageHeader';
import { KpiCard } from '@/components/admin/KpiCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { Button } from '@/components/ui/Button';
import { formatStatus } from '@/lib/ui/formatStatus';
import { getBookingStatusBadge } from '@/lib/ui/statusBadge';

function formatTime(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  return d.toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function shortAddr(v?: string | null, max = 30) {
  if (!v) return '—';
  return v.length > max ? `${v.slice(0, max)}…` : v;
}

export default function DashboardPage() {
  const router = useRouter();

  const { data: bookingsData, isLoading: bookingsLoading, error, refetch } = useQuery({
    queryKey: ['bookings-summary'],
    queryFn: async () => {
      const res = await api.get('/bookings');
      return res.data?.data ?? [];
    },
  });

  const { data: driversData, isLoading: driversLoading } = useQuery({
    queryKey: ['drivers-summary'],
    queryFn: async () => {
      const res = await api.get('/drivers');
      const d = res.data;
      return Array.isArray(d) ? d : (d?.data ?? []);
    },
  });

  const bookings = Array.isArray(bookingsData) ? bookingsData : [];
  const drivers = Array.isArray(driversData) ? driversData : [];

  const today = new Date().toDateString();
  const todayBookings = bookings.filter((b: any) =>
    b.pickup_at_utc ? new Date(b.pickup_at_utc).toDateString() === today : false,
  );
  const inProgress = bookings.filter((b: any) =>
    ['JOB_STARTED', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'ON_THE_WAY', 'ARRIVED'].includes(b.operational_status),
  );
  const completedToday = bookings.filter((b: any) =>
    ['COMPLETED', 'JOB_COMPLETED'].includes(b.operational_status),
  );
  const revenueToday = todayBookings.reduce((sum: number, b: any) => sum + (b.total_price_minor ?? 0), 0);
  const recentBookings = bookings.slice(0, 8);

  const driverAvailable = drivers.filter((d: any) => d.status === 'active' || d.status === 'ACTIVE').length;
  const driverOnTrip = inProgress.length;
  const driverOffline = Math.max(drivers.length - driverAvailable, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Operational overview · ${new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}`}
        actions={
          <Link href="/bookings/new">
            <Button className="gap-1.5">
              <Plus className="w-4 h-4" />
              New Booking
            </Button>
          </Link>
        }
      />

      {error && <ErrorAlert message="Unable to load dashboard data" onRetry={refetch} />}

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Today's Bookings"
          value={bookingsLoading ? '—' : todayBookings.length}
          icon={<CalendarCheck className="w-5 h-5" />}
          accent="blue"
          loading={bookingsLoading}
        />
        <KpiCard
          title="In Progress"
          value={bookingsLoading ? '—' : inProgress.length}
          icon={<Clock className="w-5 h-5" />}
          accent="orange"
          loading={bookingsLoading}
        />
        <KpiCard
          title="Completed Today"
          value={bookingsLoading ? '—' : completedToday.length}
          icon={<CheckCircle className="w-5 h-5" />}
          accent="green"
          loading={bookingsLoading}
        />
        <KpiCard
          title="Revenue Today"
          value={bookingsLoading ? '—' : `$${(revenueToday / 100).toFixed(2)}`}
          icon={<DollarSign className="w-5 h-5" />}
          accent="purple"
          loading={bookingsLoading}
        />
      </div>

      {/* Recent Bookings */}
      <Card
        title="Recent Bookings"
        actions={
          <Link href="/bookings" className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        }
      >
        {bookingsLoading ? (
          <div className="space-y-2 py-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="h-4 w-24 bg-gray-100 rounded" />
                <div className="h-4 w-32 bg-gray-100 rounded" />
                <div className="h-4 flex-1 bg-gray-100 rounded" />
                <div className="h-4 w-16 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : recentBookings.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No bookings yet</p>
        ) : (
          <div className="overflow-x-auto -mx-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Ref</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Customer</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wide hidden md:table-cell">Route</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wide hidden lg:table-cell">Pickup</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-400 uppercase tracking-wide">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentBookings.map((booking: any) => (
                  <tr
                    key={booking.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/bookings/${booking.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-medium text-gray-900">
                      {booking.booking_reference}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {booking.customer_first_name} {booking.customer_last_name}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell max-w-[220px]">
                      <span className="block truncate">
                        {shortAddr(booking.pickup_address_text)} → {shortAddr(booking.dropoff_address_text)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell whitespace-nowrap">
                      {formatTime(booking.pickup_at_utc)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getBookingStatusBadge(booking.operational_status)}>
                        {formatStatus(booking.operational_status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 tabular-nums">
                      {booking.currency} {(booking.total_price_minor / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Driver Status */}
        <Card title="Fleet Status" actions={
          <Link href="/drivers" className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
            Manage <ArrowRight className="w-3 h-3" />
          </Link>
        }>
          {driversLoading ? (
            <div className="space-y-3 animate-pulse">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="h-4 w-20 bg-gray-100 rounded" />
                  <div className="h-5 w-8 bg-gray-100 rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { label: 'Available', count: driverAvailable, variant: 'success' as const, dot: 'bg-green-400' },
                { label: 'On Trip', count: driverOnTrip, variant: 'warning' as const, dot: 'bg-orange-400' },
                { label: 'Offline', count: driverOffline, variant: 'neutral' as const, dot: 'bg-gray-300' },
              ].map(({ label, count, variant, dot }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${dot}`} />
                    <span className="text-sm text-gray-700">{label}</span>
                  </div>
                  <Badge variant={variant}>{count}</Badge>
                </div>
              ))}
              {drivers.length > 0 && (
                <div className="pt-2 mt-2 border-t border-gray-100">
                  {/* Progress bar */}
                  <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-100">
                    <div className="bg-green-400" style={{ width: `${(driverAvailable / drivers.length) * 100}%` }} />
                    <div className="bg-orange-400" style={{ width: `${(driverOnTrip / drivers.length) * 100}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">{drivers.length} total drivers</p>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Quick Actions */}
        <Card title="Quick Actions">
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: '/bookings/new', label: 'New Booking', icon: Plus, accent: 'blue' },
              { href: '/bookings/new?job_type=DRIVER_JOB', label: 'New Driver Job', icon: Plus, accent: 'blue' },
              { href: '/dispatch', label: 'Dispatch Board', icon: Car, accent: 'gray' },
              { href: '/drivers', label: 'Manage Drivers', icon: Car, accent: 'gray' },
              { href: '/bookings', label: 'All Bookings', icon: CalendarCheck, accent: 'gray' },
            ].map(({ href, label, icon: Icon, accent }) => (
              <Link
                key={label}
                href={href}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  accent === 'blue'
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
