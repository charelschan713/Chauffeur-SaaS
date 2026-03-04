'use client';

import { useMemo, useState } from 'react';
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

interface VehicleRow {
  id: string;
  make: string;
  model: string;
  active: boolean;
}

type ToastState = { message: string; tone: 'success' | 'error' };

export default function AdminVehiclesPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['platform-vehicles'],
    queryFn: async () => {
      const res = await api.get('/platform/vehicles');
      return res.data ?? [];
    },
  });

  const vehicles = (Array.isArray(data) ? data : []) as VehicleRow[];

  // Form state
  const [form, setForm] = useState({ make: '', model: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Deactivate confirm
  const [deactivateTarget, setDeactivateTarget] = useState<VehicleRow | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  // Toast
  const [toast, setToast] = useState<ToastState | null>(null);

  const editing = useMemo(() => vehicles.find((v) => v.id === editingId) ?? null, [vehicles, editingId]);

  function startEdit(row: VehicleRow) {
    setEditingId(row.id);
    setForm({ make: row.make, model: row.model });
    setSaveError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ make: '', model: '' });
    setSaveError(null);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      if (editingId) {
        await api.patch(`/platform/vehicles/${editingId}`, { make: form.make, model: form.model });
        setToast({ message: `${form.make} ${form.model} updated`, tone: 'success' });
        cancelEdit();
      } else {
        await api.post('/platform/vehicles', form);
        setToast({ message: `${form.make} ${form.model} added`, tone: 'success' });
        setForm({ make: '', model: '' });
      }
      await refetch();
    } catch {
      setSaveError(editingId ? 'Failed to update vehicle.' : 'Failed to add vehicle.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      await api.patch(`/platform/vehicles/${deactivateTarget.id}`, { active: false });
      await refetch();
      setToast({ message: `${deactivateTarget.make} ${deactivateTarget.model} deactivated`, tone: 'success' });
    } catch {
      setToast({ message: 'Failed to deactivate vehicle', tone: 'error' });
    } finally {
      setDeactivating(false);
      setDeactivateTarget(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Platform Vehicles" description="Manage vehicle catalogue available to all tenants" />

      {error && <ErrorAlert message="Unable to load vehicles" onRetry={refetch} />}

      {/* Add / Edit form */}
      <Card title={editingId ? `Editing: ${editing?.make} ${editing?.model}` : 'Add Vehicle'}>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            value={form.make}
            onChange={(e) => setForm((p) => ({ ...p, make: e.target.value }))}
            placeholder="Make (e.g. Mercedes-Benz)"
          />
          <Input
            value={form.model}
            onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
            placeholder="Model (e.g. S-Class)"
          />
          <div className="flex gap-2 shrink-0">
            <Button onClick={handleSave} disabled={saving || !form.make || !form.model}>
              {saving ? 'Saving…' : editingId ? 'Update' : 'Add'}
            </Button>
            {editingId && (
              <Button variant="secondary" onClick={cancelEdit}>Cancel</Button>
            )}
          </div>
        </div>
        {saveError && <div className="mt-3"><ErrorAlert message={saveError} /></div>}
      </Card>

      {/* Vehicle list */}
      <Card title={`Vehicles (${vehicles.length})`}>
        {isLoading ? (
          <div className="flex items-center justify-center h-40"><LoadingSpinner /></div>
        ) : vehicles.length === 0 ? (
          <EmptyState title="No vehicles yet" description="Add a vehicle using the form above." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                  {['Make', 'Model', 'Status', ''].map((h) => (
                    <th key={h} className="pb-2 pr-4 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {vehicles.map((row) => (
                  <tr key={row.id} className={`hover:bg-neutral-50 ${!row.active ? 'opacity-50' : ''}`}>
                    <td className="py-3 pr-4 font-medium text-gray-900">{row.make}</td>
                    <td className="py-3 pr-4 text-gray-600">{row.model}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={row.active ? 'success' : 'neutral'}>
                        {row.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="py-3 text-right space-x-2">
                      <Button variant="ghost" onClick={() => startEdit(row)}>
                        Edit
                      </Button>
                      {row.active && (
                        <Button
                          variant="ghost"
                          onClick={() => setDeactivateTarget(row)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Deactivate
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Deactivate confirm */}
      <ConfirmModal
        title="Deactivate vehicle?"
        description={`${deactivateTarget?.make} ${deactivateTarget?.model} will be hidden from all tenant assignments.`}
        isOpen={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={confirmDeactivate}
        confirmText={deactivating ? 'Deactivating…' : 'Yes, deactivate'}
        confirmTone="danger"
        loading={deactivating}
      />

      {toast && (
        <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
