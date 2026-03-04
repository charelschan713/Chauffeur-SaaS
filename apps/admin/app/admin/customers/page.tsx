'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { EmptyState } from '@/components/ui/EmptyState';

const tierVariant = (tier: string) => {
  const map: Record<string, 'info' | 'neutral' | 'warning' | 'success'> = {
    VIP: 'info',
    PLATINUM: 'neutral',
    GOLD: 'warning',
    SILVER: 'neutral',
    STANDARD: 'success',
  };
  return map[tier] ?? 'neutral';
};

export default function AdminCustomersPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['platform-customers'],
    queryFn: async () => {
      const res = await api.get('/platform/customers');
      return res.data ?? [];
    },
  });

  const customers = Array.isArray(data) ? data : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description="All customers across the platform" />

      {error && <ErrorAlert message="Unable to load customers" onRetry={refetch} />}

      <Card title={`All Customers (${customers.length})`}>
        {isLoading ? (
          <div className="flex items-center justify-center h-40"><LoadingSpinner /></div>
        ) : customers.length === 0 ? (
          <EmptyState title="No customers found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                  {['Name', 'Email', 'Tier', 'Tenant', 'Created'].map((h) => (
                    <th key={h} className="pb-2 pr-4 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {customers.map((c: any) => (
                  <tr key={c.id} className="hover:bg-neutral-50">
                    <td className="py-3 pr-4 font-medium text-gray-900">{c.first_name} {c.last_name}</td>
                    <td className="py-3 pr-4 text-gray-600">{c.email ?? '—'}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={tierVariant(c.tier ?? 'STANDARD')}>{c.tier ?? 'STANDARD'}</Badge>
                    </td>
                    <td className="py-3 pr-4 text-gray-600">{c.tenant_name ?? '—'}</td>
                    <td className="py-3 text-gray-500">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
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
