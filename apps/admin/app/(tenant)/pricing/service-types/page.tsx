'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { ListPage } from '@/components/patterns/ListPage';

interface ServiceTypeRow {
  id: string;
  display_name: string;
  calculation_type: 'POINT_TO_POINT' | 'HOURLY_CHARTER';
  one_way_type: 'PERCENTAGE' | 'FIXED_SURCHARGE';
  one_way_value: number;
  one_way_surcharge_minor: number;
  return_type: 'PERCENTAGE' | 'FIXED_SURCHARGE';
  return_value: number;
  return_surcharge_minor: number;
  minimum_hours: number;
  km_per_hour_included: number;
  hourly_tiers: HourlyTier[];
  active: boolean;
}

type HourlyTier = {
  from_hours?: number;
  to_hours?: number;
  type?: 'PERCENTAGE' | 'FIXED_SURCHARGE';
  value?: number;
  surcharge_minor?: number;
};

const emptyForm = {
  display_name: '',
  calculation_type: 'POINT_TO_POINT' as const,
  one_way_type: 'PERCENTAGE' as const,
  one_way_value: '100',
  one_way_surcharge_minor: '0',
  return_type: 'PERCENTAGE' as const,
  return_value: '100',
  return_surcharge_minor: '0',
  minimum_hours: '2',
  km_per_hour_included: '0',
};

type FormState = typeof emptyForm;

function toMoney(minor: number) {
  return (minor / 100).toFixed(2);
}

export default function ServiceTypesPage() {
  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ['service-types'],
    queryFn: async () => {
      const res = await api.get('/service-types');
      return res.data ?? [];
    },
  });

  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tiers, setTiers] = useState<HourlyTier[]>([]);

  const items = data as ServiceTypeRow[];

  const editing = useMemo(() => items.find((row) => row.id === editingId) ?? null, [items, editingId]);

  function loadForm(row: ServiceTypeRow) {
    setForm({
      display_name: row.display_name,
      calculation_type: row.calculation_type,
      one_way_type: row.one_way_type,
      one_way_value: String(row.one_way_value ?? 100),
      one_way_surcharge_minor: toMoney(row.one_way_surcharge_minor ?? 0),
      return_type: row.return_type,
      return_value: String(row.return_value ?? 100),
      return_surcharge_minor: toMoney(row.return_surcharge_minor ?? 0),
      minimum_hours: String(row.minimum_hours ?? 2),
      km_per_hour_included: String(row.km_per_hour_included ?? 0),
    });
    setTiers(row.hourly_tiers ?? []);
  }

  async function handleCreate() {
    await api.post('/service-types', {
      display_name: form.display_name,
      calculation_type: form.calculation_type,
      one_way_type: form.one_way_type,
      one_way_value: Number(form.one_way_value),
      one_way_surcharge_minor: Math.round(Number(form.one_way_surcharge_minor) * 100),
      return_type: form.return_type,
      return_value: Number(form.return_value),
      return_surcharge_minor: Math.round(Number(form.return_surcharge_minor) * 100),
      minimum_hours: Number(form.minimum_hours),
      km_per_hour_included: Number(form.km_per_hour_included),
      hourly_tiers: tiers,
    });
    setForm(emptyForm);
    setTiers([]);
    await refetch();
  }

  async function handleUpdate() {
    if (!editingId) return;
    await api.patch(`/service-types/${editingId}`, {
      display_name: form.display_name,
      calculation_type: form.calculation_type,
      one_way_type: form.one_way_type,
      one_way_value: Number(form.one_way_value),
      one_way_surcharge_minor: Math.round(Number(form.one_way_surcharge_minor) * 100),
      return_type: form.return_type,
      return_value: Number(form.return_value),
      return_surcharge_minor: Math.round(Number(form.return_surcharge_minor) * 100),
      minimum_hours: Number(form.minimum_hours),
      km_per_hour_included: Number(form.km_per_hour_included),
      hourly_tiers: tiers,
    });
    setEditingId(null);
    setForm(emptyForm);
    setTiers([]);
    await refetch();
  }

  async function handleDeactivate(id: string) {
    await api.delete(`/service-types/${id}`);
    await refetch();
  }

  return (
    <ListPage
      title="Service Types"
      filters={
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Display Name">
            <input
              value={form.display_name}
              onChange={(e) => setForm((prev) => ({ ...prev, display_name: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Calculation Type">
            <select
              value={form.calculation_type}
              onChange={(e) => setForm((prev) => ({ ...prev, calculation_type: e.target.value as any }))}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="POINT_TO_POINT">Point to Point</option>
              <option value="HOURLY_CHARTER">Hourly Charter</option>
            </select>
          </Field>

          {form.calculation_type === 'POINT_TO_POINT' && (
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <MultiplierBlock
                title="One Way"
                type={form.one_way_type}
                value={form.one_way_value}
                surcharge={form.one_way_surcharge_minor}
                onTypeChange={(v) => setForm((prev) => ({ ...prev, one_way_type: v }))}
                onValueChange={(v) => setForm((prev) => ({ ...prev, one_way_value: v }))}
                onSurchargeChange={(v) => setForm((prev) => ({ ...prev, one_way_surcharge_minor: v }))}
              />
              <MultiplierBlock
                title="Return"
                type={form.return_type}
                value={form.return_value}
                surcharge={form.return_surcharge_minor}
                onTypeChange={(v) => setForm((prev) => ({ ...prev, return_type: v }))}
                onValueChange={(v) => setForm((prev) => ({ ...prev, return_value: v }))}
                onSurchargeChange={(v) => setForm((prev) => ({ ...prev, return_surcharge_minor: v }))}
              />
            </div>
          )}

          {form.calculation_type === 'HOURLY_CHARTER' && (
            <div className="md:col-span-2 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Minimum Hours">
                  <input
                    value={form.minimum_hours}
                    onChange={(e) => setForm((prev) => ({ ...prev, minimum_hours: e.target.value }))}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="KM per Hour Included">
                  <input
                    value={form.km_per_hour_included}
                    onChange={(e) => setForm((prev) => ({ ...prev, km_per_hour_included: e.target.value }))}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </Field>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700">Hourly Tiers</h3>
                  <button
                    onClick={() => setTiers((prev) => [...prev, { type: 'PERCENTAGE', value: 100 }])}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Add Tier
                  </button>
                </div>
                {tiers.length === 0 && (
                  <p className="text-xs text-gray-500">No tiers configured.</p>
                )}
                {tiers.map((tier, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-2">
                    <input
                      placeholder="From"
                      value={tier.from_hours ?? ''}
                      onChange={(e) => {
                        const value = e.target.value === '' ? undefined : Number(e.target.value);
                        setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, from_hours: value } : t)));
                      }}
                      className="border rounded px-2 py-1 text-sm"
                    />
                    <input
                      placeholder="To"
                      value={tier.to_hours ?? ''}
                      onChange={(e) => {
                        const value = e.target.value === '' ? undefined : Number(e.target.value);
                        setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, to_hours: value } : t)));
                      }}
                      className="border rounded px-2 py-1 text-sm"
                    />
                    <select
                      value={tier.type ?? 'PERCENTAGE'}
                      onChange={(e) => {
                        const value = e.target.value as 'PERCENTAGE' | 'FIXED_SURCHARGE';
                        setTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, type: value } : t)));
                      }}
                      className="border rounded px-2 py-1 text-sm"
                    >
                      <option value="PERCENTAGE">Percentage</option>
                      <option value="FIXED_SURCHARGE">Fixed Surcharge</option>
                    </select>
                    <input
                      placeholder={tier.type === 'FIXED_SURCHARGE' ? 'Surcharge $' : 'Value %'}
                      value={tier.type === 'FIXED_SURCHARGE' ? toMoney(tier.surcharge_minor ?? 0) : tier.value ?? ''}
                      onChange={(e) => {
                        setTiers((prev) =>
                          prev.map((t, i) => {
                            if (i !== idx) return t;
                            if (t.type === 'FIXED_SURCHARGE') {
                              return { ...t, surcharge_minor: Math.round(Number(e.target.value) * 100) };
                            }
                            return { ...t, value: Number(e.target.value) };
                          }),
                        );
                      }}
                      className="border rounded px-2 py-1 text-sm"
                    />
                    <button
                      onClick={() => setTiers((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-red-600 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                  setTiers([]);
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
                {['Name', 'Calculation Type', 'One Way', 'Status', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.display_name}</td>
                  <td className="px-4 py-3">
                    {row.calculation_type === 'HOURLY_CHARTER' ? 'Hourly Charter' : 'Point to Point'}
                  </td>
                  <td className="px-4 py-3">
                    {row.one_way_type === 'FIXED_SURCHARGE'
                      ? `+$${toMoney(row.one_way_surcharge_minor ?? 0)}`
                      : `${row.one_way_value}%`}
                  </td>
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

function MultiplierBlock({
  title,
  type,
  value,
  surcharge,
  onTypeChange,
  onValueChange,
  onSurchargeChange,
}: {
  title: string;
  type: 'PERCENTAGE' | 'FIXED_SURCHARGE';
  value: string;
  surcharge: string;
  onTypeChange: (value: 'PERCENTAGE' | 'FIXED_SURCHARGE') => void;
  onValueChange: (value: string) => void;
  onSurchargeChange: (value: string) => void;
}) {
  return (
    <div className="bg-white border rounded p-4 space-y-2">
      <p className="text-sm font-medium text-gray-700">{title}</p>
      <select
        value={type}
        onChange={(e) => onTypeChange(e.target.value as 'PERCENTAGE' | 'FIXED_SURCHARGE')}
        className="w-full border rounded px-3 py-2 text-sm"
      >
        <option value="PERCENTAGE">Percentage</option>
        <option value="FIXED_SURCHARGE">Fixed Surcharge</option>
      </select>
      {type === 'PERCENTAGE' ? (
        <input
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="Value %"
        />
      ) : (
        <input
          value={surcharge}
          onChange={(e) => onSurchargeChange(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="Surcharge $"
        />
      )}
    </div>
  );
}
