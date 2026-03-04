'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { EmptyState } from '@/components/ui/EmptyState';

export default function AdminDashboardPage() {
  const { data: metrics, isLoading: metricsLoading, error: metricsError, refetch: refetchMetrics } = useQuery({
    queryKey: ['platform-metrics'],
    queryFn: async () => {
      const res = await api.get('/platform/metrics');
      return res.data;
    },
  });

  const { data: tenantsData, isLoading: tenantsLoading, error: tenantsError, refetch: refetchTenants } = useQuery({
    queryKey: ['platform-tenants'],
    queryFn: async () => {
      const res = await api.get('/platform/tenants');
      return res.data ?? [];
    },
  });

  const tenants = Array.isArray(tenantsData) ? tenantsData : [];

  const statusVariant = (status: string) =>
    status === 'active' ? 'success' : status === 'suspended' ? 'warning' : 'neutral';

  return (
    <div className="space-y-6">
      <PageHeader title="Platform Dashboard" description="Overview of all tenants and activity" />

      {metricsError && <ErrorAlert message="Unable to load metrics" onRetry={refetchMetrics} />}

      {metricsLoading ? (
        <div className="flex items-center justify-center h-24"><LoadingSpinner /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard label="Active Tenants" value={Number(metrics?.active_tenants ?? 0)} />
          <MetricCard label="Bookings Today" value={Number(metrics?.bookings_today ?? 0)} />
          <MetricCard label="Completed Today" value={Number(metrics?.completed_today ?? 0)} />
        </div>
      )}

      {tenantsError && <ErrorAlert message="Unable to load tenants" onRetry={refetchTenants} />}

      <Card title="Recent Tenants">
        {tenantsLoading ? (
          <div className="flex items-center justify-center h-24"><LoadingSpinner /></div>
        ) : tenants.length === 0 ? (
          <EmptyState title="No tenants yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                  {['Name', 'Slug', 'Status', 'Created'].map((h) => (
                    <th key={h} className="pb-2 pr-4 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {tenants.slice(0, 5).map((t: any) => (
                  <tr key={t.id} className="hover:bg-neutral-50">
                    <td className="py-3 pr-4 font-medium text-gray-900">{t.name}</td>
                    <td className="py-3 pr-4 text-gray-600">{t.slug}</td>
                    <td className="py-3 pr-4"><Badge variant={statusVariant(t.status)}>{t.status}</Badge></td>
                    <td className="py-3 text-gray-500">{t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}</td>
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

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-semibold mt-1 text-gray-900">{value}</p>
    </Card>
  );
}
