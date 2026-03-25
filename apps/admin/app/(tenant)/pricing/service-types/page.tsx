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
  toll_enabled: boolean;
  waypoint_charge_enabled: boolean;
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
  toll_enabled: boolean;
  waypoint_charge_enabled: boolean;
  surge_enabled: boolean;
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
  toll_enabled: false,
  waypoint_charge_enabled: false,
  surge_enabled: true,
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
  const [tierError, setTierError] = useState<string | null>(null);

  const items = data as ServiceTypeRow[];

  const editing = useMemo(() => items.find((row) => row.id === editingId) ?? null, [items, editingId]);

  function normalizeTiers(input: HourlyTier[]) {
    const clean = (Array.isArray(input) ? input : []).map((t) => ({
      from_hours: typeof t.from_hours === 'number' ? t.from_hours : undefined,
      to_hours: typeof t.to_hours === 'number' ? t.to_hours : undefined,
      type: t.type ?? 'PERCENTAGE',
      value: typeof t.value === 'number' ? t.value : undefined,
      surcharge_minor: typeof t.surcharge_minor === 'number' ? t.surcharge_minor : 0,
    }));
    clean.sort((a, b) => (a.from_hours ?? 0) - (b.from_hours ?? 0));
    return clean;
  }

  function validateTiers(input: HourlyTier[]) {
    const tiersSorted = normalizeTiers(input);
    for (let i = 0; i < tiersSorted.length; i++) {
      const t = tiersSorted[i];
      if (!Number.isFinite(t.from_hours) || (t.from_hours as number) <= 0) return 'Each tier must have a valid From (hours) > 0.';
      if (t.to_hours !== undefined && (!Number.isFinite(t.to_hours) || (t.to_hours as number) < (t.from_hours as number))) {
        return 'Tier To (hours) must be blank or >= From (hours).';
      }
      if (t.type === 'PERCENTAGE') {
        if (!Number.isFinite(t.value)) return 'Percentage tiers must have a Value (e.g. 100, 95, 90).';
      }
      if (!Number.isFinite(t.surcharge_minor) || (t.surcharge_minor as number) < 0) return 'Surcharge must be >= 0.';
    }

    // overlap check
    for (let i = 0; i < tiersSorted.length - 1; i++) {
      const a = tiersSorted[i];
      const b = tiersSorted[i + 1];
      const aEnd = a.to_hours === undefined ? Infinity : a.to_hours;
      const bStart = b.from_hours as number;
      if (aEnd >= bStart) {
        return 'Hourly tiers overlap. Please ensure each tier range does not overlap the next one.';
      }
    }

    return null;
  }

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
      toll_enabled: row.toll_enabled ?? false,
      waypoint_charge_enabled: row.waypoint_charge_enabled ?? false,
      surge_enabled: row.surge_enabled ?? true,
    });
    const next = normalizeTiers(row.hourly_tiers ?? []);
    setTiers(next);
    setTierError(validateTiers(next));
  }

  async function handleCreate() {
    const nextTiers = normalizeTiers(tiers);
    const err = form.calculation_type === 'HOURLY_CHARTER' ? validateTiers(nextTiers) : null;
    setTierError(err);
    if (err) return;

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
      toll_enabled: form.toll_enabled,
      waypoint_charge_enabled: form.waypoint_charge_enabled,
      surge_enabled: form.surge_enabled,
      hourly_tiers: nextTiers,
    });
    setForm(emptyForm);
    setTiers([]);
    setTierError(null);
    await refetch();
  }

  async function handleUpdate() {
    if (!editingId) return;

    const nextTiers = normalizeTiers(tiers);
    const err = form.calculation_type === 'HOURLY_CHARTER' ? validateTiers(nextTiers) : null;
    setTierError(err);
    if (err) return;

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
      toll_enabled: form.toll_enabled,
      waypoint_charge_enabled: form.waypoint_charge_enabled,
      surge_enabled: form.surge_enabled,
      hourly_tiers: nextTiers,
    });
    setEditingId(null);
    setForm(emptyForm);
    setTiers([]);
    setTierError(null);
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
          {/* Point to Point: one-way + return pricing */}
          {form.calculation_type === 'POINT_TO_POINT' && (<>
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
          </>)}

          {/* Hourly Charter: min hours + km included + tiers */}
          {form.calculation_type === 'HOURLY_CHARTER' && (<>
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

            {/* Hourly tiers (discount / surcharge table) */}
            <div className="md:col-span-2 border border-gray-200 rounded-xl p-4 bg-white">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Hourly Tiers</div>
                  <div className="text-xs text-gray-500">Optional. Applied by booked hours (e.g. 2–3h, 4–6h).</div>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setTiers((prev) => {
                      const next: HourlyTier[] = [...prev, { from_hours: Number(form.minimum_hours) || 2, to_hours: undefined, type: 'PERCENTAGE' as const, value: 100, surcharge_minor: 0 }];
                      const normalized = normalizeTiers(next);
                      setTierError(validateTiers(normalized));
                      return normalized;
                    });
                  }}
                >
                  Add Tier
                </Button>
              </div>

              {tierError && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {tierError}
                </div>
              )}

              {tiers.length === 0 ? (
                <div className="text-sm text-gray-500">No tiers configured. Pricing will use base hourly calculation only.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b">
                        <th className="py-2 pr-3">From (h)</th>
                        <th className="py-2 pr-3">To (h)</th>
                        <th className="py-2 pr-3">Type</th>
                        <th className="py-2 pr-3">Value</th>
                        <th className="py-2 pr-3">Surcharge (AUD)</th>
                        <th className="py-2 pr-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {tiers.map((t, idx) => (
                        <tr key={idx} className="border-b last:border-b-0">
                          <td className="py-2 pr-3">
                            <Input
                              type="number"
                              value={t.from_hours ?? ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                setTiers((prev) => {
                                  const next = prev.map((x, i) => i === idx ? { ...x, from_hours: v === '' ? undefined : Number(v) } : x);
                                  const normalized = normalizeTiers(next);
                                  setTierError(validateTiers(normalized));
                                  return normalized;
                                });
                              }}
                            />
                          </td>
                          <td className="py-2 pr-3">
                            <Input
                              type="number"
                              value={t.to_hours ?? ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                setTiers((prev) => {
                                  const next = prev.map((x, i) => i === idx ? { ...x, to_hours: v === '' ? undefined : Number(v) } : x);
                                  const normalized = normalizeTiers(next);
                                  setTierError(validateTiers(normalized));
                                  return normalized;
                                });
                              }}
                            />
                          </td>
                          <td className="py-2 pr-3">
                            <Select
                              value={t.type ?? 'PERCENTAGE'}
                              onChange={(e) => {
                                const v = e.target.value as any;
                                setTiers((prev) => {
                                  const next = prev.map((x, i) => i === idx ? { ...x, type: v } : x);
                                  const normalized = normalizeTiers(next);
                                  setTierError(validateTiers(normalized));
                                  return normalized;
                                });
                              }}
                            >
                              <option value="PERCENTAGE">Percentage</option>
                              <option value="FIXED_SURCHARGE">Fixed Surcharge</option>
                            </Select>
                          </td>
                          <td className="py-2 pr-3">
                            <Input
                              type="number"
                              value={t.value ?? ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                setTiers((prev) => {
                                  const next = prev.map((x, i) => i === idx ? { ...x, value: v === '' ? undefined : Number(v) } : x);
                                  const normalized = normalizeTiers(next);
                                  setTierError(validateTiers(normalized));
                                  return normalized;
                                });
                              }}
                            />
                            <div className="text-[11px] text-gray-400 mt-1">
                              {t.type === 'PERCENTAGE' ? '100 = no change, 90 = 10% off' : 'Ignored for fixed surcharge'}
                            </div>
                          </td>
                          <td className="py-2 pr-3">
                            <Input
                              type="number"
                              value={toMoney(t.surcharge_minor ?? 0)}
                              onChange={(e) => {
                                const v = e.target.value;
                                const minor = Math.round(Number(v || 0) * 100);
                                setTiers((prev) => {
                                  const next = prev.map((x, i) => i === idx ? { ...x, surcharge_minor: Number.isFinite(minor) ? minor : 0 } : x);
                                  const normalized = normalizeTiers(next);
                                  setTierError(validateTiers(normalized));
                                  return normalized;
                                });
                              }}
                            />
                          </td>
                          <td className="py-2 pr-3 text-right">
                            <button
                              className="text-red-600 hover:underline"
                              onClick={() => {
                                setTiers((prev) => {
                                  const next = prev.filter((_, i) => i !== idx);
                                  const normalized = normalizeTiers(next);
                                  setTierError(validateTiers(normalized));
                                  return normalized;
                                });
                              }}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <Field label="Hourly Rate Type (legacy)">
              <Select
                value={form.one_way_type}
                onChange={(e) => setForm((prev) => ({ ...prev, one_way_type: e.target.value as any }))}
              >
                <option value="PERCENTAGE">Percentage</option>
                <option value="FIXED_SURCHARGE">Fixed Amount</option>
              </Select>
            </Field>
            <Field label="Hourly Rate Value (legacy)">
              <Input
                type="number"
                value={form.one_way_value}
                onChange={(e) => setForm((prev) => ({ ...prev, one_way_value: e.target.value }))}
              />
            </Field>
          </>)}
          {/* Toll enabled toggle */}
          <div className="flex items-center gap-3 py-1">
            <button
              type="button"
              role="switch"
              aria-checked={form.toll_enabled}
              onClick={() => setForm((prev) => ({ ...prev, toll_enabled: !prev.toll_enabled }))}
              className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${form.toll_enabled ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.toll_enabled ? 'translate-x-5' : ''}`} />
            </button>
            <span className="text-sm font-medium text-gray-700">
              {form.toll_enabled ? '🛣️ Charge Toll / Parking' : 'No Toll Charging'}
            </span>
          </div>

          {/* Waypoint charge toggle */}
          <div className="flex items-center gap-3 py-1">
            <button
              type="button"
              role="switch"
              aria-checked={form.waypoint_charge_enabled}
              onClick={() => setForm((prev) => ({ ...prev, waypoint_charge_enabled: !prev.waypoint_charge_enabled }))}
              className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${form.waypoint_charge_enabled ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.waypoint_charge_enabled ? 'translate-x-5' : ''}`} />
            </button>
            <span className="text-sm font-medium text-gray-700">
              {form.waypoint_charge_enabled ? '📍 Charge for Waypoint Stops' : 'No Waypoint Stop Charge'}
            </span>
          </div>

          {/* Surge toggle */}
          <div className="flex items-center gap-3 py-1">
            <button
              type="button"
              role="switch"
              aria-checked={form.surge_enabled}
              onClick={() => setForm((prev) => ({ ...prev, surge_enabled: !prev.surge_enabled }))}
              className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${form.surge_enabled ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.surge_enabled ? 'translate-x-5' : ''}`} />
            </button>
            <span className="text-sm font-medium text-gray-700">
              {form.surge_enabled ? '⚡ Surge Enabled' : 'No Surge Applied'}
            </span>
          </div>

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
          <Table headers={['Name', 'Calculation', 'One Way', 'Return', 'Min Hours', 'Toll', 'Waypoints', 'Surge', 'Active', '']}>
            {items.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">{row.display_name}</td>
                <td className="px-6 py-4 text-sm">{row.calculation_type}</td>
                <td className="px-6 py-4 text-sm">{row.one_way_type} {row.one_way_value}</td>
                <td className="px-6 py-4 text-sm text-gray-400">
                  {row.calculation_type === 'HOURLY_CHARTER' ? '—' : `${row.return_type} ${row.return_value}`}
                </td>
                <td className="px-6 py-4 text-sm">{row.minimum_hours}</td>
                <td className="px-6 py-4 text-sm">
                  {row.toll_enabled && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                      🛣️ Toll ✓
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm">
                  {row.waypoint_charge_enabled && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                      📍 Charged ✓
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm">
                  {row.surge_enabled && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                      ⚡ Surge ✓
                    </span>
                  )}
                </td>
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
