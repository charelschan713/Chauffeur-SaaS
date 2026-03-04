'use client';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { ListPage } from '@/components/patterns/ListPage';

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
  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ['service-classes'],
    queryFn: async () => {
      const res = await api.get('/pricing/car-types');
      return res.data ?? [];
    },
  });

  const { data: platformVehicles = [] } = useQuery({
    queryKey: ['platform-vehicles'],
    queryFn: async () => {
      const res = await api.get('/platform/vehicles');
      return res.data ?? [];
    },
  });

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>([]);

  const items = data as ServiceClassRow[];
  const editing = useMemo(() => items.find((i) => i.id === editingId) ?? null, [items, editingId]);

  async function handleCreate() {
    await api.post('/pricing/service-classes', {
      name: form.name,
      description: form.description || null,
      displayOrder: Number(form.display_order) || 0,
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
    });
    setForm(emptyForm);
    await refetch();
  }

  async function handleUpdate() {
    if (!editingId) return;
    await api.patch(`/pricing/service-classes/${editingId}`, {
      name: form.name,
      description: form.description || null,
      displayOrder: Number(form.display_order) || 0,
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
    });
    setEditingId(null);
    setForm(emptyForm);
    await refetch();
  }

  async function handleDeactivate(id: string) {
    await api.delete(`/pricing/service-classes/${id}`);
    await refetch();
  }

  async function handleSavePlatformVehicles() {
    if (!editingId) return;
    await api.post('/pricing/service-classes/platform-vehicles', {
      service_class_id: editingId,
      platform_vehicle_ids: selectedPlatformIds,
    });
  }

  return (
    <ListPage
      title="Car Types"
      subtitle="Configure car types and base pricing"
      actions={
        <button
          onClick={() => {
            setEditingId(null);
            setForm(emptyForm);
          }}
          className="px-4 py-2 rounded bg-blue-600 text-white text-sm"
        >
          New Car Type
        </button>
      }
      filters={
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Name">
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Description">
            <input
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Display Order">
            <input
              type="number"
              value={form.display_order}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, display_order: Number(e.target.value) }))
              }
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </Field>
          <div className="flex items-end gap-2">
            <button
              onClick={editingId ? handleUpdate : handleCreate}
              className="px-4 py-2 rounded bg-blue-600 text-white text-sm"
            >
              {editingId ? 'Update' : 'Create'}
            </button>
            {editingId && (
              <button
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
                className="px-3 py-2 rounded border text-sm"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      }
      table={
        isLoading ? (
          <div className="p-6 text-sm text-gray-500">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Base Fare', 'Per Km', 'Per Min', 'Minimum', 'Active', ''].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
                  <td className="px-6 py-4 text-sm">{toMoney(item.base_fare_minor)}</td>
                  <td className="px-6 py-4 text-sm">{toMoney(item.per_km_minor)}</td>
                  <td className="px-6 py-4 text-sm">{toMoney(item.per_min_driving_minor)}</td>
                  <td className="px-6 py-4 text-sm">{toMoney(item.minimum_fare_minor)}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded text-xs ${item.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                      {item.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right space-x-2">
                    <button
                      className="text-blue-600 hover:underline"
                      onClick={() => {
                        setEditingId(item.id);
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
                        });
                      }}
                    >
                      Edit
                    </button>
                    <button className="text-red-600 hover:underline" onClick={() => handleDeactivate(item.id)}>
                      Deactivate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
      footer={
        editing && (
          <div className="bg-white border rounded p-4">
            <h3 className="text-sm font-semibold mb-2">Platform Vehicles</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {(platformVehicles as PlatformVehicle[]).map((pv) => (
                <label key={pv.id} className="flex items-center gap-2 text-sm">
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
            <div className="mt-3">
              <button onClick={handleSavePlatformVehicles} className="px-4 py-2 rounded bg-blue-600 text-white text-sm">
                Save Platform Vehicles
              </button>
            </div>
          </div>
        )
      }
    />
  );
}
