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
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Toast } from '@/components/ui/Toast';

const statusVariant = (status: string) =>
  status === 'active' ? 'success' : status === 'suspended' ? 'warning' : 'neutral';

// Status transitions that require confirmation (destructive or impactful)
const CONFIRM_TRANSITIONS = new Set(['suspended', 'archived']);

type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: string;
  timezone: string;
  currency: string;
  created_at?: string;
};

type Toast = { message: string; tone: 'success' | 'error' };

export default function AdminTenantsPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['platform-tenants'],
    queryFn: async () => {
      const res = await api.get('/platform/tenants');
      return res.data ?? [];
    },
  });

  const tenants = (Array.isArray(data) ? data : []) as Tenant[];

  // Create form
  const [form, setForm] = useState({ name: '', slug: '', timezone: 'Australia/Sydney', currency: 'AUD' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Status change confirm
  const [pendingStatus, setPendingStatus] = useState<{ id: string; name: string; status: string } | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);

  // Toast
  const [toast, setToast] = useState<Toast | null>(null);

  async function handleCreate() {
    setCreating(true);
    setCreateError(null);
    try {
      await api.post('/platform/tenants', form);
      setForm({ name: '', slug: '', timezone: 'Australia/Sydney', currency: 'AUD' });
      await refetch();
      setToast({ message: `Tenant "${form.name}" created`, tone: 'success' });
    } catch {
      setCreateError('Failed to create tenant. Please check your inputs and try again.');
    } finally {
      setCreating(false);
    }
  }

  function requestStatusChange(tenant: Tenant, newStatus: string) {
    if (newStatus === tenant.status) return;
    if (CONFIRM_TRANSITIONS.has(newStatus)) {
      setPendingStatus({ id: tenant.id, name: tenant.name, status: newStatus });
    } else {
      applyStatusChange(tenant.id, newStatus);
    }
  }

  async function applyStatusChange(id: string, status: string) {
    setStatusSaving(true);
    try {
      await api.patch(`/platform/tenants/${id}/status`, { status });
      await refetch();
      setToast({ message: `Tenant status updated to "${status}"`, tone: 'success' });
    } catch {
      setToast({ message: 'Failed to update tenant status', tone: 'error' });
    } finally {
      setStatusSaving(false);
      setPendingStatus(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Tenants" description="Manage platform tenants and their status" />

      {error && <ErrorAlert message="Unable to load tenants" onRetry={refetch} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tenant list */}
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
                    {tenants.map((t) => (
                      <tr key={t.id} className="hover:bg-neutral-50">
                        <td className="py-3 pr-4 font-medium text-gray-900">{t.name}</td>
                        <td className="py-3 pr-4 text-gray-500 font-mono text-xs">{t.slug}</td>
                        <td className="py-3 pr-4">
                          <Badge variant={statusVariant(t.status)}>{t.status}</Badge>
                        </td>
                        <td className="py-3 pr-4 text-gray-600">{t.timezone}</td>
                        <td className="py-3 pr-4 text-gray-600">{t.currency}</td>
                        <td className="py-3 pr-4 text-gray-500">
                          {t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3">
                          <select
                            className="border rounded px-2 py-1 text-xs text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
                            value={t.status}
                            onChange={(e) => requestStatusChange(t, e.target.value)}
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

        {/* Create form */}
        <Card title="Create Tenant">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="AS Concierges"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Slug</label>
              <Input
                value={form.slug}
                onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                placeholder="as-concierges"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Timezone</label>
              <Input
                value={form.timezone}
                onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))}
                placeholder="Australia/Sydney"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Currency</label>
              <select
                value={form.currency}
                onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                <option value="AUD">AUD — Australian Dollar</option>
                <option value="USD">USD — US Dollar</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="EUR">EUR — Euro</option>
                <option value="SGD">SGD — Singapore Dollar</option>
                <option value="HKD">HKD — Hong Kong Dollar</option>
                <option value="NZD">NZD — New Zealand Dollar</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">Cannot be changed after tenant creation.</p>
            </div>
            {createError && <ErrorAlert message={createError} />}
            <Button
              onClick={handleCreate}
              disabled={creating || !form.name || !form.slug}
              className="w-full"
            >
              {creating ? 'Creating…' : 'Create Tenant'}
            </Button>
          </div>
        </Card>
      </div>

      {/* Confirm destructive status change */}
      <ConfirmModal
        title={`${pendingStatus?.status === 'archived' ? 'Archive' : 'Suspend'} tenant?`}
        description={`"${pendingStatus?.name}" will be ${pendingStatus?.status}. This may affect active users and bookings.`}
        isOpen={!!pendingStatus}
        onClose={() => setPendingStatus(null)}
        onConfirm={() => pendingStatus && applyStatusChange(pendingStatus.id, pendingStatus.status)}
        confirmText={statusSaving ? 'Saving…' : `Yes, ${pendingStatus?.status}`}
        confirmTone="danger"
        loading={statusSaving}
      />

      {toast && (
        <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
