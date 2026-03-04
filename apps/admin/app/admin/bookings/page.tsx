'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { EmptyState } from '@/components/ui/EmptyState';

const statusVariant = (status: string) => {
  const map: Record<string, 'success' | 'danger' | 'warning' | 'neutral' | 'info'> = {
    COMPLETED: 'success',
    JOB_COMPLETED: 'success',
    CANCELLED: 'danger',
    CONFIRMED: 'info',
    ASSIGNED: 'info',
    IN_PROGRESS: 'info',
    PENDING: 'warning',
    DRAFT: 'neutral',
  };
  return map[status] ?? 'neutral';
};

export default function AdminBookingsPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['platform-bookings'],
    queryFn: async () => {
      const res = await api.get('/platform/bookings');
      return res.data ?? [];
    },
  });

  const bookings = Array.isArray(data) ? data : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Bookings" description="All bookings across the platform" />

      {error && <ErrorAlert message="Unable to load bookings" onRetry={refetch} />}

      <Card title={`All Bookings (${bookings.length})`}>
        {isLoading ? (
          <div className="flex items-center justify-center h-40"><LoadingSpinner /></div>
        ) : bookings.length === 0 ? (
          <EmptyState title="No bookings found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                  {['Reference', 'Tenant', 'Customer', 'Status', 'Total', 'Created'].map((h) => (
                    <th key={h} className="pb-2 pr-4 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {bookings.map((b: any) => (
                  <tr key={b.id} className="hover:bg-neutral-50">
                    <td className="py-3 pr-4 font-medium text-gray-900">{b.booking_reference}</td>
                    <td className="py-3 pr-4 text-gray-600">{b.tenant_name ?? '—'}</td>
                    <td className="py-3 pr-4 text-gray-600">{b.customer_first_name} {b.customer_last_name}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={statusVariant(b.operational_status ?? '')}>{b.operational_status ?? 'UNKNOWN'}</Badge>
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      {b.total_price_minor ? `${(b.total_price_minor / 100).toFixed(2)} ${b.currency}` : '—'}
                    </td>
                    <td className="py-3 text-gray-500">
                      {b.created_at ? new Date(b.created_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
