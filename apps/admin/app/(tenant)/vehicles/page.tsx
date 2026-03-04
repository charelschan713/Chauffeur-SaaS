'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ListPage } from '@/components/patterns/ListPage';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Table } from '@/components/ui/Table';
import {LoadingSpinner, PageLoader, InlineSpinner} from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Toast } from '@/components/ui/Toast';
import { formatStatus } from '@/lib/ui/formatStatus';

export default function VehiclesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tenant-vehicles'],
    queryFn: async () => {
      const res = await api.get('/vehicles');
      return res.data ?? [];
    },
  });

  const { data: platformVehicles = [] } = useQuery({
    queryKey: ['platform-vehicles-public'],
    queryFn: async () => {
      const res = await api.get('/platform/vehicles/public');
      return res.data ?? [];
    },
  });

  const vehicles = data ?? [];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<{ id: string; label: string } | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [form, setForm] = useState({
    platform_vehicle_id: '',
    year: '',
    colour: '',
    plate: '',
    passenger_capacity: 4,
    luggage_capacity: 2,
    notes: '',
  });

  const editing = useMemo(() => vehicles.find((v: any) => v.id === editingId) ?? null, [vehicles, editingId]);

  function loadForm(v: any) {
    setForm({
      platform_vehicle_id: v.platform_vehicle_id ?? '',
      year: v.year ?? '',
      colour: v.colour ?? '',
      plate: v.plate ?? '',
      passenger_capacity: v.passenger_capacity ?? 4,
      luggage_capacity: v.luggage_capacity ?? 2,
      notes: v.notes ?? '',
    });
  }

  async function handleUpdate() {
    if (!editingId) return;
    setFormSaving(true);
    setFormError(null);
    try {
    await api.patch(`/vehicles/${editingId}`, {
      platform_vehicle_id: form.platform_vehicle_id || null,
      year: form.year ? Number(form.year) : null,
      colour: form.colour || null,
      plate: form.plate || null,
      passenger_capacity: Number(form.passenger_capacity) || 4,
      luggage_capacity: Number(form.luggage_capacity) || 2,
      notes: form.notes || null,
    });
    setEditingId(null);
    await queryClient.invalidateQueries({ queryKey: ['tenant-vehicles'] });
    } catch (e: any) { setFormError(e?.response?.data?.message ?? 'Failed to save'); } finally { setFormSaving(false); }
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      await api.delete(`/vehicles/${deactivateTarget.id}`);
      await queryClient.invalidateQueries({ queryKey: ['tenant-vehicles'] });
      setToast({ message: `${deactivateTarget.label} deactivated`, tone: 'success' });
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message ?? 'Failed to deactivate vehicle', tone: 'error' });
    } finally {
      setDeactivating(false);
      setDeactivateTarget(null);
    }
  }

  async function reactivateVehicle(id: string, label: string) {
    try {
      await api.patch(`/vehicles/${id}`, { active: true });
      await queryClient.invalidateQueries({ queryKey: ['tenant-vehicles'] });
      setToast({ message: `${label} reactivated`, tone: 'success' });
    } catch {
      setToast({ message: 'Failed to reactivate vehicle', tone: 'error' });
    }
  }

  if (error) return <ErrorAlert message="Unable to load vehicles" onRetry={refetch} />;

  return (
    <>
    <ListPage
      title="Fleet Vehicles"
      subtitle="Manage your tenant fleet"
      actions={
        <Link href="/vehicles/new">
          <Button>Add Vehicle</Button>
        </Link>
      }
      table={
        isLoading ? (
          <div className="flex items-center justify-center h-32"><LoadingSpinner /></div>
        ) : vehicles.length === 0 ? (
          <EmptyState title="No vehicles yet" description="Add your first vehicle to get started." />
        ) : (
          <div>
            {editingId && (
              <div className="bg-white border rounded p-4 mb-4 space-y-3">
                <h3 className="text-sm font-semibold">Edit Vehicle</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Select
                    value={form.platform_vehicle_id}
                    onChange={(e) => setForm((p) => ({ ...p, platform_vehicle_id: e.target.value }))}
                  >
                    <option value="">Select Platform Vehicle</option>
                    {(platformVehicles as any[]).map((pv) => (
                      <option key={pv.id} value={pv.id}>{pv.make} {pv.model}</option>
                    ))}
                  </Select>
                  <Input placeholder="Year" value={form.year} onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))} />
                  <Input placeholder="Colour" value={form.colour} onChange={(e) => setForm((p) => ({ ...p, colour: e.target.value }))} />
                  <Input placeholder="Plate" value={form.plate} onChange={(e) => setForm((p) => ({ ...p, plate: e.target.value }))} />
                  <Input placeholder="Passenger Capacity" value={form.passenger_capacity} onChange={(e) => setForm((p) => ({ ...p, passenger_capacity: Number(e.target.value) }))} />
                  <Input placeholder="Luggage Capacity" value={form.luggage_capacity} onChange={(e) => setForm((p) => ({ ...p, luggage_capacity: Number(e.target.value) }))} />
                  <Input placeholder="Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleUpdate} disabled={formSaving}>{formSaving ? <><InlineSpinner />Saving...</> : 'Save'}</Button>
                  <Button variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
                </div>
              </div>
            )}
            <Table headers={['Vehicle', 'Year', 'Colour', 'Plate', 'Capacity', 'Status', '']}>
              {vehicles.map((v: any) => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{v.make} {v.model}</div>
                  </td>
                  <td className="px-6 py-4 text-sm">{v.year ?? '—'}</td>
                  <td className="px-6 py-4 text-sm">{v.colour ?? '—'}</td>
                  <td className="px-6 py-4 text-sm">{v.plate ?? '—'}</td>
                  <td className="px-6 py-4 text-sm">
                    {v.passenger_capacity} pax / {v.luggage_capacity} bags
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      v.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {v.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right space-x-2">
                    <button className="text-blue-600 hover:underline" onClick={() => { setEditingId(v.id); loadForm(v); }}>Edit</button>
                    {v.active ? (
                      <button
                        className="text-red-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 rounded text-sm"
                        onClick={() => setDeactivateTarget({ id: v.id, label: `${v.make} ${v.model}` })}
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        className="text-blue-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 rounded text-sm"
                        onClick={() => reactivateVehicle(v.id, `${v.make} ${v.model}`)}
                      >
                        Reactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          </div>
        )
      }
    />

    <ConfirmModal
      title="Deactivate vehicle?"
      description={`${deactivateTarget?.label} will be removed from active assignments.`}
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
    </>
  );
}
