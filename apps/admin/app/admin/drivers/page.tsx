'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { EmptyState } from '@/components/ui/EmptyState';

const statusVariant = (status: string) =>
  status === 'active' ? 'success' : status === 'inactive' ? 'neutral' : 'warning';

export default function AdminDriversPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['platform-drivers'],
    queryFn: async () => {
      const res = await api.get('/platform/drivers');
      return res.data ?? [];
    },
  });

  const drivers = Array.isArray(data) ? data : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Drivers" description="All drivers across the platform" />

      {error && <ErrorAlert message="Unable to load drivers" onRetry={refetch} />}

      <Card title={`All Drivers (${drivers.length})`}>
        {isLoading ? (
          <div className="flex items-center justify-center h-40"><LoadingSpinner /></div>
        ) : drivers.length === 0 ? (
          <EmptyState title="No drivers found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                  {['Name', 'Email', 'Status', 'Tenant', 'Created'].map((h) => (
                    <th key={h} className="pb-2 pr-4 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {drivers.map((d: any) => (
                  <tr key={d.id} className="hover:bg-neutral-50">
                    <td className="py-3 pr-4 font-medium text-gray-900">{d.first_name} {d.last_name}</td>
                    <td className="py-3 pr-4 text-gray-600">{d.email ?? '—'}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={statusVariant(d.status ?? '')}>{d.status ?? 'unknown'}</Badge>
                    </td>
                    <td className="py-3 pr-4 text-gray-600">{d.tenant_name ?? '—'}</td>
                    <td className="py-3 text-gray-500">
                      {d.created_at ? new Date(d.created_at).toLocaleDateString() : '—'}
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
