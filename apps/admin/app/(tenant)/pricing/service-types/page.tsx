'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { ListPage } from '@/components/patterns/ListPage';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Table } from '@/components/ui/Table';
import {LoadingSpinner, PageLoader, InlineSpinner} from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { formatStatus } from '@/lib/ui/formatStatus';

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

type CalcType = 'POINT_TO_POINT' | 'HOURLY_CHARTER';

type FormState = {
  display_name: string;
  calculation_type: CalcType;
  one_way_type: 'PERCENTAGE' | 'FIXED_SURCHARGE';
  one_way_value: string;
  one_way_surcharge_minor: string;
  return_type: 'PERCENTAGE' | 'FIXED_SURCHARGE';
  return_value: string;
  return_surcharge_minor: string;
  minimum_hours: string;
  km_per_hour_included: string;
};

const emptyForm: FormState = {
  display_name: '',
  calculation_type: 'POINT_TO_POINT',
  one_way_type: 'PERCENTAGE',
  one_way_value: '100',
  one_way_surcharge_minor: '0',
  return_type: 'PERCENTAGE',
  return_value: '100',
  return_surcharge_minor: '0',
  minimum_hours: '2',
  km_per_hour_included: '0',
};

function toMoney(minor: number) {
  return (minor / 100).toFixed(2);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

export default function ServiceTypesPage() {
  const { data = [], isLoading, error, refetch } = useQuery({
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
      calculation_type: row.calculation_type as CalcType,
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

  if (error) return <ErrorAlert message="Unable to load service types" onRetry={refetch} />;

  return (
    <ListPage
      title="Service Types"
      subtitle="Configure service types and multipliers"
      actions={
        <Button
          onClick={() => {
            setEditingId(null);
            setForm(emptyForm);
          }}
        >
          New Service Type
        </Button>
      }
      filters={
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Display Name">
            <Input
              value={form.display_name}
              onChange={(e) => setForm((prev) => ({ ...prev, display_name: e.target.value }))}
            />
          </Field>
          <Field label="Calculation Type">
            <Select
              value={form.calculation_type}
              onChange={(e) => setForm((prev) => ({ ...prev, calculation_type: e.target.value as CalcType }))}
            >
              <option value="POINT_TO_POINT">Point to Point</option>
              <option value="HOURLY_CHARTER">Hourly Charter</option>
            </Select>
          </Field>
          <Field label="One Way Type">
            <Select
              value={form.one_way_type}
              onChange={(e) => setForm((prev) => ({ ...prev, one_way_type: e.target.value as any }))}
            >
              <option value="PERCENTAGE">Percentage</option>
              <option value="FIXED_SURCHARGE">Fixed Surcharge</option>
            </Select>
          </Field>
          <Field label="One Way Value">
            <Input
              type="number"
              value={form.one_way_value}
              onChange={(e) => setForm((prev) => ({ ...prev, one_way_value: e.target.value }))}
            />
          </Field>
          <Field label="Return Type">
            <Select
              value={form.return_type}
              onChange={(e) => setForm((prev) => ({ ...prev, return_type: e.target.value as any }))}
            >
              <option value="PERCENTAGE">Percentage</option>
              <option value="FIXED_SURCHARGE">Fixed Surcharge</option>
            </Select>
          </Field>
          <Field label="Return Value">
            <Input
              type="number"
              value={form.return_value}
              onChange={(e) => setForm((prev) => ({ ...prev, return_value: e.target.value }))}
            />
          </Field>
          <Field label="Minimum Hours">
            <Input
              type="number"
              value={form.minimum_hours}
              onChange={(e) => setForm((prev) => ({ ...prev, minimum_hours: e.target.value }))}
            />
          </Field>
          <Field label="KM per Hour Included">
            <Input
              type="number"
              value={form.km_per_hour_included}
              onChange={(e) => setForm((prev) => ({ ...prev, km_per_hour_included: e.target.value }))}
            />
          </Field>
          <div className="flex items-end gap-2">
            <Button onClick={editingId ? handleUpdate : handleCreate}>
              {editingId ? 'Update' : 'Create'}
            </Button>
            {editingId && (
              <Button
                variant="secondary"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
              >
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
          <EmptyState title="No service types yet" description="Create your first service type to get started." />
        ) : (
          <Table headers={['Name', 'Calculation', 'One Way', 'Return', 'Min Hours', 'Active', '']}>
            {items.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">{row.display_name}</td>
                <td className="px-6 py-4 text-sm">{row.calculation_type}</td>
                <td className="px-6 py-4 text-sm">{row.one_way_type} {row.one_way_value}</td>
                <td className="px-6 py-4 text-sm">{row.return_type} {row.return_value}</td>
                <td className="px-6 py-4 text-sm">{row.minimum_hours}</td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 py-1 rounded text-xs ${row.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                    {row.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-right space-x-2">
                  <button
                    className="text-blue-600 hover:underline"
                    onClick={() => {
                      setEditingId(row.id);
                      loadForm(row);
                    }}
                  >
                    Edit
                  </button>
                  <button className="text-red-600 hover:underline" onClick={() => handleDeactivate(row.id)}>
                    Deactivate
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        )
      }
    />
  );
}
