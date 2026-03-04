'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { EmptyState } from '@/components/ui/EmptyState';

const statusVariant = (status: string) =>
  status === 'active' ? 'success' : status === 'suspended' ? 'warning' : 'neutral';

export default function AdminTenantsPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['platform-tenants'],
    queryFn: async () => {
      const res = await api.get('/platform/tenants');
      return res.data ?? [];
    },
  });

  const tenants = Array.isArray(data) ? data : [];

  const [form, setForm] = useState({ name: '', slug: '', timezone: 'UTC', currency: 'AUD' });
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    setCreating(true);
    try {
      await api.post('/platform/tenants', form);
      setForm({ name: '', slug: '', timezone: 'UTC', currency: 'AUD' });
      await refetch();
    } finally {
      setCreating(false);
    }
  }

  async function handleStatus(id: string, status: string) {
    await api.patch(`/platform/tenants/${id}/status`, { status });
    await refetch();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Tenants" description="Manage platform tenants and their status" />

      {error && <ErrorAlert message="Unable to load tenants" onRetry={refetch} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card title={`All Tenants (${tenants.length})`}>
            {isLoading ? (
              <div className="flex items-center justify-center h-40"><LoadingSpinner /></div>
            ) : tenants.length === 0 ? (
              <EmptyState title="No tenants yet" description="Create your first tenant using the form." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                      {['Name', 'Slug', 'Status', 'Timezone', 'Currency', 'Created', ''].map((h) => (
                        <th key={h} className="pb-2 pr-4 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {tenants.map((t: any) => (
                      <tr key={t.id} className="hover:bg-neutral-50">
                        <td className="py-3 pr-4 font-medium text-gray-900">{t.name}</td>
                        <td className="py-3 pr-4 text-gray-600">{t.slug}</td>
                        <td className="py-3 pr-4"><Badge variant={statusVariant(t.status)}>{t.status}</Badge></td>
                        <td className="py-3 pr-4 text-gray-600">{t.timezone}</td>
                        <td className="py-3 pr-4 text-gray-600">{t.currency}</td>
                        <td className="py-3 pr-4 text-gray-500">{t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}</td>
                        <td className="py-3">
                          <select
                            className="border rounded px-2 py-1 text-xs text-gray-700"
                            value={t.status}
                            onChange={(e) => handleStatus(t.id, e.target.value)}
                          >
                            <option value="active">active</option>
                            <option value="suspended">suspended</option>
                            <option value="archived">archived</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <Card title="Create Tenant">
          <div className="space-y-3">
            <Input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Name"
            />
            <Input
              value={form.slug}
              onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
              placeholder="Slug"
            />
            <Input
              value={form.timezone}
              onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))}
              placeholder="Timezone"
            />
            <Input
              value={form.currency}
              onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
              placeholder="Currency"
            />
            <Button onClick={handleCreate} disabled={creating || !form.name || !form.slug} className="w-full">
              {creating ? 'Creating…' : 'Create Tenant'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
