'use client';
import { useMemo, useRef, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { ListPage } from '@/components/patterns/ListPage';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Table } from '@/components/ui/Table';
import {LoadingSpinner, PageLoader, InlineSpinner} from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Toast } from '@/components/ui/Toast';
import { formatStatus } from '@/lib/ui/formatStatus';

interface ServiceClassRow {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  base_fare_minor: number | null;
  per_km_minor: number | null;
  per_min_driving_minor: number | null;
  per_min_waiting_minor: number | null;
  minimum_fare_minor: number | null;
  waypoint_minor: number | null;
  infant_seat_minor: number | null;
  toddler_seat_minor: number | null;
  booster_seat_minor: number | null;
  hourly_rate_minor: number | null;
  passenger_capacity: number | null;
  luggage_capacity: number | null;
  active: boolean;
}

interface PlatformVehicle {
  id: string;
  make: string;
  model: string;
}

const emptyForm = {
  name: '',
  description: '',
  display_order: 0,
  base_fare_minor: '0',
  per_km_minor: '0',
  per_min_driving_minor: '0',
  per_min_waiting_minor: '0',
  minimum_fare_minor: '0',
  waypoint_minor: '0',
  infant_seat_minor: '0',
  toddler_seat_minor: '0',
  booster_seat_minor: '0',
  hourly_rate_minor: '0',
  passenger_capacity: '4',
  luggage_capacity: '2',
};

function toMinor(value: string) {
  return Math.round(Number(value) * 100);
}

function toMoney(minor: number | null) {
  return ((minor ?? 0) / 100).toFixed(2);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

export default function CarTypesPage() {
  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ['service-classes'],
    queryFn: async () => {
      const res = await api.get('/pricing/car-types');
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

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>([]);
  const [pvSaving, setPvSaving] = useState(false);

  // Filter out blank/ghost rows (name is empty or null)
  const items = (data as ServiceClassRow[]).filter((i) => i?.name?.trim());

  // Load existing platform vehicle selections whenever editing car type changes
  useEffect(() => {
    if (!editingId) { setSelectedPlatformIds([]); return; }
    api.get(`/pricing/service-classes/${editingId}/platform-vehicles`)
      .then(res => {
        const ids = (res.data ?? []).map((pv: any) => pv.id ?? pv.platform_vehicle_id);
        setSelectedPlatformIds(ids);
      })
      .catch(() => setSelectedPlatformIds([]));
  }, [editingId]);
  const editing = useMemo(() => items.find((i) => i.id === editingId) ?? null, [items, editingId]);

  function buildPayload() {
    return {
      name: form.name,
      description: form.description || null,
      base_fare_minor: toMinor(form.base_fare_minor),
      per_km_minor: toMinor(form.per_km_minor),
      per_min_driving_minor: toMinor(form.per_min_driving_minor),
      per_min_waiting_minor: toMinor(form.per_min_waiting_minor),
      minimum_fare_minor: toMinor(form.minimum_fare_minor),
      waypoint_minor: toMinor(form.waypoint_minor),
      infant_seat_minor: toMinor(form.infant_seat_minor),
      toddler_seat_minor: toMinor(form.toddler_seat_minor),
      booster_seat_minor: toMinor(form.booster_seat_minor),
      hourly_rate_minor: toMinor(form.hourly_rate_minor),
      passenger_capacity: Number(form.passenger_capacity) || 0,
      luggage_capacity: Number(form.luggage_capacity) || 0,
    };
  }

  async function handleCreate() {
    setFormSaving(true);
    try {
      await api.post('/pricing/service-classes', buildPayload());
      setForm(emptyForm);
      await refetch();
    } finally {
      setFormSaving(false);
    }
  }

  async function handleUpdate() {
    if (!editingId) return;
    setFormSaving(true);
    try {
      await api.patch(`/pricing/service-classes/${editingId}`, buildPayload());
      setEditingId(null);
      setForm(emptyForm);
      await refetch();
    } finally {
      setFormSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!deactivateId) return;
    try {
      await api.delete(`/pricing/car-types/${deactivateId}`);
      setToast({ message: 'Car type deactivated', tone: 'success' });
      await refetch();
    } catch {
      setToast({ message: 'Failed to deactivate car type', tone: 'error' });
    } finally {
      setDeactivateId(null);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await api.delete(`/pricing/car-types/${deleteId}/hard`);
      setToast({ message: 'Car type deleted', tone: 'success' });
      await refetch();
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message ?? 'Failed to delete car type', tone: 'error' });
    } finally {
      setDeleteId(null);
    }
  }

  async function handleSavePlatformVehicles() {
    if (!editingId) return;
    setPvSaving(true);
    try {
      await api.post('/pricing/service-classes/platform-vehicles', {
        service_class_id: editingId,
        platform_vehicle_ids: selectedPlatformIds,
      });
      setToast({ message: `Platform vehicles saved for "${editing?.name}"`, tone: 'success' });
    } catch {
      setToast({ message: 'Failed to save platform vehicles', tone: 'error' });
    } finally {
      setPvSaving(false);
    }
  }

  if (error) return <ErrorAlert message="Unable to load car types" onRetry={refetch} />;

  return (
    <>
    <ListPage
      title="Car Types"
      subtitle="Configure car types and base pricing"
      actions={
        <Button
          onClick={() => {
            setEditingId(null);
            setForm(emptyForm);
          }}
        >
          New Car Type
        </Button>
      }
      filters={
        <div ref={formRef} className="space-y-5">
          {editingId && editing && (
            <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700 font-medium">
              ✏️ Editing: {editing.name}
            </div>
          )}

          {/* ── Identity ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Car Type Name *">
              <Input
                value={form.name}
                placeholder="e.g. Luxury Sedan"
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </Field>
            <Field label="Description">
              <Input
                value={form.description}
                placeholder="Brief description shown to customers"
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </Field>
          </div>

          {/* ── Point-to-Point Pricing ───────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Point-to-Point Pricing</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Base Fare ($)">
                <Input
                  type="number" min="0" step="0.01"
                  value={form.base_fare_minor}
                  onChange={(e) => setForm((prev) => ({ ...prev, base_fare_minor: e.target.value }))}
                />
              </Field>
              <Field label="Per Km ($)">
                <Input
                  type="number" min="0" step="0.01"
                  value={form.per_km_minor}
                  onChange={(e) => setForm((prev) => ({ ...prev, per_km_minor: e.target.value }))}
                />
              </Field>
              <Field label="Per Min Driving ($)">
                <Input
                  type="number" min="0" step="0.01"
                  value={form.per_min_driving_minor}
                  onChange={(e) => setForm((prev) => ({ ...prev, per_min_driving_minor: e.target.value }))}
                />
              </Field>
              <Field label="Per Min Waiting ($)">
                <Input
                  type="number" min="0" step="0.01"
                  value={form.per_min_waiting_minor}
                  onChange={(e) => setForm((prev) => ({ ...prev, per_min_waiting_minor: e.target.value }))}
                />
              </Field>
              <Field label="Minimum Fare ($)">
                <Input
                  type="number" min="0" step="0.01"
                  value={form.minimum_fare_minor}
                  onChange={(e) => setForm((prev) => ({ ...prev, minimum_fare_minor: e.target.value }))}
                />
              </Field>
              <Field label="Waypoint Surcharge ($)">
                <Input
                  type="number" min="0" step="0.01"
                  value={form.waypoint_minor}
                  onChange={(e) => setForm((prev) => ({ ...prev, waypoint_minor: e.target.value }))}
                />
              </Field>
            </div>
          </div>

          {/* ── Hourly Pricing ───────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Hourly Charter Pricing</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Hourly Rate ($)">
                <Input
                  type="number" min="0" step="0.01"
                  value={form.hourly_rate_minor}
                  onChange={(e) => setForm((prev) => ({ ...prev, hourly_rate_minor: e.target.value }))}
                />
              </Field>
            </div>
          </div>

          {/* ── Capacity ─────────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Capacity</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Passenger Capacity">
                <Input
                  type="number" min="1" max="20" step="1"
                  value={form.passenger_capacity}
                  onChange={(e) => setForm((prev) => ({ ...prev, passenger_capacity: e.target.value }))}
                />
              </Field>
              <Field label="Luggage Capacity">
                <Input
                  type="number" min="0" max="20" step="1"
                  value={form.luggage_capacity}
                  onChange={(e) => setForm((prev) => ({ ...prev, luggage_capacity: e.target.value }))}
                />
              </Field>
            </div>
          </div>

          {/* ── Seat Surcharges ──────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Child Seat Surcharges</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Infant Seat 0–6 months ($)">
                <Input
                  type="number" min="0" step="0.01"
                  value={form.infant_seat_minor}
                  onChange={(e) => setForm((prev) => ({ ...prev, infant_seat_minor: e.target.value }))}
                />
              </Field>
              <Field label="Toddler Seat 0–4 yrs ($)">
                <Input
                  type="number" min="0" step="0.01"
                  value={form.toddler_seat_minor}
                  onChange={(e) => setForm((prev) => ({ ...prev, toddler_seat_minor: e.target.value }))}
                />
              </Field>
              <Field label="Booster Seat 4–8 yrs ($)">
                <Input
                  type="number" min="0" step="0.01"
                  value={form.booster_seat_minor}
                  onChange={(e) => setForm((prev) => ({ ...prev, booster_seat_minor: e.target.value }))}
                />
              </Field>
            </div>
          </div>

          {/* ── Actions ──────────────────────────────────────── */}
          <div className="flex items-center gap-2 pt-1">
            <Button onClick={editingId ? handleUpdate : handleCreate} disabled={formSaving || !form.name.trim()}>
              {formSaving
                ? <><InlineSpinner />{editingId ? 'Updating...' : 'Creating...'}</>
                : editingId ? 'Update Car Type' : 'Create Car Type'}
            </Button>
            {editingId && (
              <Button variant="secondary" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      }
      table={
        isLoading ? (
          <div className="flex items-center justify-center h-32"><LoadingSpinner /></div>
        ) : items.length === 0 ? (
          <EmptyState title="No car types yet" description="Create your first car type to get started." />
        ) : (
          <Table headers={['Name', 'Pax', 'Bags', 'Base Fare', 'Per Km', 'Minimum', 'Active', 'Vehicles', '']}>
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
                <td className="px-6 py-4 text-sm text-center">🧍 {item.passenger_capacity ?? 0}</td>
                <td className="px-6 py-4 text-sm text-center">🧳 {item.luggage_capacity ?? 0}</td>
                <td className="px-6 py-4 text-sm">${toMoney(item.base_fare_minor)}</td>
                <td className="px-6 py-4 text-sm">${toMoney(item.per_km_minor)}</td>
                <td className="px-6 py-4 text-sm">${toMoney(item.minimum_fare_minor)}</td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 py-1 rounded text-xs ${item.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                    {item.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {Number((item as any).vehicle_count) > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                      🚗 {(item as any).vehicle_count} linked
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs text-gray-400 bg-gray-50 border border-gray-200">
                      No vehicles
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-right space-x-2">
                  <button
                    className="text-blue-600 hover:underline"
                    onClick={() => {
                      setEditingId(item.id);
                      setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                      setForm({
                        name: item.name,
                        description: item.description ?? '',
                        display_order: item.display_order ?? 0,
                        base_fare_minor: toMoney(item.base_fare_minor),
                        per_km_minor: toMoney(item.per_km_minor),
                        per_min_driving_minor: toMoney(item.per_min_driving_minor),
                        per_min_waiting_minor: toMoney(item.per_min_waiting_minor),
                        minimum_fare_minor: toMoney(item.minimum_fare_minor),
                        waypoint_minor: toMoney(item.waypoint_minor),
                        infant_seat_minor: toMoney(item.infant_seat_minor),
                        toddler_seat_minor: toMoney(item.toddler_seat_minor),
                        booster_seat_minor: toMoney(item.booster_seat_minor),
                        hourly_rate_minor: toMoney(item.hourly_rate_minor),
                        passenger_capacity: String(item.passenger_capacity ?? 4),
                        luggage_capacity: String(item.luggage_capacity ?? 2),
                      });
                    }}
                  >
                    Edit
                  </button>
                  <button className="text-orange-600 hover:underline" onClick={() => setDeactivateId(item.id)}>
                    Deactivate
                  </button>
                  <button className="text-red-700 hover:underline font-medium" onClick={() => setDeleteId(item.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        )
      }
      footer={
        editing && (
          <div className="bg-white border rounded p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold">Platform Vehicles</h3>
                <p className="text-xs text-gray-400">for <span className="font-medium text-gray-600">{editing?.name}</span></p>
              </div>
              <Button onClick={handleSavePlatformVehicles} disabled={pvSaving} size="sm">
                {pvSaving ? <><InlineSpinner /> Saving…</> : `Save (${selectedPlatformIds.length} selected)`}
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {(platformVehicles as PlatformVehicle[]).map((pv) => (
                <label key={pv.id} className="flex items-center gap-2 text-sm cursor-pointer hover:text-blue-600">
                  <input
                    type="checkbox"
                    checked={selectedPlatformIds.includes(pv.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPlatformIds((prev) => [...prev, pv.id]);
                      } else {
                        setSelectedPlatformIds((prev) => prev.filter((id) => id !== pv.id));
                      }
                    }}
                  />
                  {pv.make} {pv.model}
                </label>
              ))}
            </div>
          </div>
        )
      }
    />

    <ConfirmModal
      isOpen={!!deactivateId}
      title="Deactivate Car Type"
      description={`Deactivate "${items.find(i => i.id === deactivateId)?.name ?? 'this car type'}"? It will be hidden from bookings and vehicle selection.`}
      confirmText="Deactivate"
      confirmTone="danger"
      onConfirm={() => { void handleDeactivate(); }}
      onClose={() => setDeactivateId(null)}
    />

    <ConfirmModal
      isOpen={!!deleteId}
      title="Delete Car Type"
      description={`Permanently delete "${items.find(i => i.id === deleteId)?.name ?? 'this car type'}"? This cannot be undone. Car types with active bookings cannot be deleted.`}
      confirmText="Delete"
      confirmTone="danger"
      onConfirm={() => { void handleDelete(); }}
      onClose={() => setDeleteId(null)}
    />

    {toast && (
      <Toast
        message={toast.message}
        tone={toast.tone}
        onClose={() => setToast(null)}
      />
    )}
    </>
  );
}
