'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { ListPage } from '@/components/patterns/ListPage';

interface CarTypeRow {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  active: boolean;
  base_fare_minor: number;
  per_km_minor: number;
  per_min_driving_minor: number;
  per_min_waiting_minor: number;
  minimum_fare_minor: number;
  waypoint_minor: number;
  infant_seat_minor: number;
  toddler_seat_minor: number;
  booster_seat_minor: number;
  hourly_rate_minor: number;
}

const emptyForm = {
  name: '',
  description: '',
  display_order: 0,
  base_fare_minor: '',
  per_km_minor: '',
  per_min_driving_minor: '',
  per_min_waiting_minor: '',
  minimum_fare_minor: '',
  waypoint_minor: '',
  infant_seat_minor: '',
  toddler_seat_minor: '',
  booster_seat_minor: '',
  hourly_rate_minor: '',
};

type FormState = typeof emptyForm;

function toMinor(value: string) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

function toDisplay(minor: number) {
  return (minor / 100).toFixed(2);
}

export default function CarTypesPage() {
  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ['car-types'],
    queryFn: async () => {
      const res = await api.get('/pricing/service-classes');
      return res.data ?? [];
    },
  });

  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const carTypes = data as CarTypeRow[];

  const editing = useMemo(() => {
    if (!editingId) return null;
    return carTypes.find((row) => row.id === editingId) ?? null;
  }, [editingId, carTypes]);

  function loadForm(row: CarTypeRow) {
    setForm({
      name: row.name,
      description: row.description ?? '',
      display_order: row.display_order ?? 0,
      base_fare_minor: toDisplay(row.base_fare_minor ?? 0),
      per_km_minor: toDisplay(row.per_km_minor ?? 0),
      per_min_driving_minor: toDisplay(row.per_min_driving_minor ?? 0),
      per_min_waiting_minor: toDisplay(row.per_min_waiting_minor ?? 0),
      minimum_fare_minor: toDisplay(row.minimum_fare_minor ?? 0),
      waypoint_minor: toDisplay(row.waypoint_minor ?? 0),
      infant_seat_minor: toDisplay(row.infant_seat_minor ?? 0),
      toddler_seat_minor: toDisplay(row.toddler_seat_minor ?? 0),
      booster_seat_minor: toDisplay(row.booster_seat_minor ?? 0),
      hourly_rate_minor: toDisplay(row.hourly_rate_minor ?? 0),
    });
  }

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

  return (
    <ListPage
      title="Car Types"
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
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
            <MoneyField label="Base Fare ($)" value={form.base_fare_minor} onChange={(v) => setForm((p) => ({ ...p, base_fare_minor: v }))} />
            <MoneyField label="Per KM ($)" value={form.per_km_minor} onChange={(v) => setForm((p) => ({ ...p, per_km_minor: v }))} />
            <MoneyField label="Per Min Driving ($)" value={form.per_min_driving_minor} onChange={(v) => setForm((p) => ({ ...p, per_min_driving_minor: v }))} />
            <MoneyField label="Per Min Waiting ($)" value={form.per_min_waiting_minor} onChange={(v) => setForm((p) => ({ ...p, per_min_waiting_minor: v }))} />
            <MoneyField label="Minimum Fare ($)" value={form.minimum_fare_minor} onChange={(v) => setForm((p) => ({ ...p, minimum_fare_minor: v }))} />
            <MoneyField label="Waypoint Fee ($)" value={form.waypoint_minor} onChange={(v) => setForm((p) => ({ ...p, waypoint_minor: v }))} />
            <MoneyField label="Infant Seat ($)" value={form.infant_seat_minor} onChange={(v) => setForm((p) => ({ ...p, infant_seat_minor: v }))} />
            <MoneyField label="Toddler Seat ($)" value={form.toddler_seat_minor} onChange={(v) => setForm((p) => ({ ...p, toddler_seat_minor: v }))} />
            <MoneyField label="Booster Seat ($)" value={form.booster_seat_minor} onChange={(v) => setForm((p) => ({ ...p, booster_seat_minor: v }))} />
            <MoneyField label="Hourly Rate ($)" value={form.hourly_rate_minor} onChange={(v) => setForm((p) => ({ ...p, hourly_rate_minor: v }))} />
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
                {['Name', 'Base Fare', 'Per KM', 'Hourly Rate', 'Status', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {carTypes.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                  <td className="px-4 py-3">${toDisplay(row.base_fare_minor ?? 0)}</td>
                  <td className="px-4 py-3">${toDisplay(row.per_km_minor ?? 0)}</td>
                  <td className="px-4 py-3">${toDisplay(row.hourly_rate_minor ?? 0)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${row.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {row.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => {
                        setEditingId(row.id);
                        loadForm(row);
                      }}
                      className="text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeactivate(row.id)}
                      className="text-red-600 hover:underline"
                    >
                      Deactivate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-sm font-medium text-gray-700 space-y-1">
      <span>{label}</span>
      {children}
    </label>
  );
}

function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded px-3 py-2 text-sm"
      />
    </Field>
  );
}
