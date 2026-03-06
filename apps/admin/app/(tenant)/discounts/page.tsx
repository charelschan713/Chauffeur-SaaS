'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { Badge } from '@/components/ui/Badge';

type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';
type AppliesTo   = 'ALL' | 'NEW_CLIENTS' | 'SPECIFIC_CLIENTS';

interface Discount {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  type: DiscountType;
  value: number;
  max_discount_minor: number | null;
  applies_to: AppliesTo;
  min_fare_minor: number;
  start_at: string | null;
  end_at: string | null;
  active: boolean;
  max_uses: number | null;
  max_uses_per_customer: number;
  used_count: number;
}

const emptyForm = (): Partial<Discount> & { maxDiscountDollars: string; minFareDollars: string; fixedAmountDollars: string } => ({
  name:                  '',
  code:                  '',
  description:           '',
  type:                  'PERCENTAGE',
  value:                 10,
  max_discount_minor:    null,
  applies_to:            'ALL',
  min_fare_minor:        0,
  start_at:              null,
  end_at:                null,
  active:                true,
  max_uses:              null,
  max_uses_per_customer: 1,
  maxDiscountDollars:    '20',
  minFareDollars:        '0',
  fixedAmountDollars:    '10',
});

function fmtDiscount(d: Discount) {
  if (d.type === 'PERCENTAGE') {
    const max = d.max_discount_minor ? ` (max $${(d.max_discount_minor / 100).toFixed(0)})` : '';
    return `${d.value}%${max}`;
  }
  return `$${(d.value / 100).toFixed(2)} off`;
}

function appliesLabel(a: AppliesTo) {
  return a === 'ALL' ? 'All clients' : a === 'NEW_CLIENTS' ? 'New clients only' : 'Specific clients';
}

export default function DiscountsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<Discount | null>(null);
  const [form, setForm]         = useState(emptyForm());
  const [toast, setToast]       = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  const { data: discounts = [], isLoading } = useQuery<Discount[]>({
    queryKey: ['discounts'],
    queryFn: () => api.get('/discounts').then(r => r.data),
  });

  const { data: serviceTypes = [] } = useQuery<any[]>({
    queryKey: ['service-types'],
    queryFn: () => api.get('/service-types').then(r => r.data),
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        name:                form.name,
        code:                form.code || null,
        description:         form.description || null,
        type:                form.type,
        value:               form.type === 'PERCENTAGE'
                               ? Number(form.value)
                               : Math.round(Number(form.fixedAmountDollars) * 100),
        maxDiscountMinor:    form.type === 'PERCENTAGE' && form.maxDiscountDollars
                               ? Math.round(Number(form.maxDiscountDollars) * 100)
                               : null,
        appliesTo:           form.applies_to,
        minFareMinor:        Math.round(Number(form.minFareDollars) * 100),
        startAt:             form.start_at || null,
        endAt:               form.end_at || null,
        active:              form.active,
        maxUses:             form.max_uses || null,
        maxUsesPerCustomer:  Number(form.max_uses_per_customer),
      };
      if (editing) return api.put(`/discounts/${editing.id}`, payload);
      return api.post('/discounts', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discounts'] });
      setToast({ message: editing ? 'Discount updated' : 'Discount created', tone: 'success' });
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm());
    },
    onError: (e: any) => setToast({ message: e.response?.data?.message ?? 'Failed to save', tone: 'error' }),
  });

  const toggleMut = useMutation({
    mutationFn: (d: Discount) => api.put(`/discounts/${d.id}`, { active: !d.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['discounts'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/discounts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discounts'] });
      setToast({ message: 'Discount deleted', tone: 'success' });
    },
  });

  const openEdit = (d: Discount) => {
    setEditing(d);
    setForm({
      ...d,
      maxDiscountDollars: d.max_discount_minor ? String(d.max_discount_minor / 100) : '20',
      minFareDollars:     String(d.min_fare_minor / 100),
      fixedAmountDollars: d.type === 'FIXED_AMOUNT' ? String(d.value / 100) : '10',
    });
    setShowForm(true);
  };

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Discounts & Promos"
        description="Create discount rules and promo codes for your customers"
        actions={
          <Button onClick={() => { setShowForm(true); setEditing(null); setForm(emptyForm()); }}>
            + New Discount
          </Button>
        }
      />

      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}

      {/* ── Create / Edit form ── */}
      {showForm && (
        <Card title={editing ? 'Edit Discount' : 'New Discount'}>
          <div className="space-y-5 max-w-2xl">

            {/* Name + Code */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Discount Name *</label>
                <input className={inputCls} value={form.name} onChange={f('name')} placeholder="e.g. Spring Promo" required />
              </div>
              <div>
                <label className={labelCls}>
                  Promo Code
                  <span className="ml-1 text-xs text-gray-400 font-normal">(leave blank to auto-apply)</span>
                </label>
                <input className={inputCls + " uppercase"} value={form.code ?? ''} onChange={f('code')}
                  placeholder="e.g. SAVE10" style={{ textTransform: 'uppercase' }} />
              </div>
            </div>

            {/* Type + Value */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Discount Type</label>
                <select className={inputCls} value={form.type} onChange={f('type')}>
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED_AMOUNT">Fixed Amount ($)</option>
                </select>
              </div>
              {form.type === 'PERCENTAGE' ? (
                <>
                  <div>
                    <label className={labelCls}>Discount %</label>
                    <div className="relative">
                      <input type="number" min={1} max={100} className={inputCls + " pr-6"}
                        value={form.value} onChange={f('value')} />
                      <span className="absolute right-3 top-2 text-gray-400 text-sm">%</span>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Max Discount ($) <span className="text-gray-400 font-normal text-xs">cap</span></label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-400 text-sm">$</span>
                      <input type="number" min={0} className={inputCls + " pl-6"}
                        value={form.maxDiscountDollars} onChange={f('maxDiscountDollars')}
                        placeholder="e.g. 20" />
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label className={labelCls}>Amount Off ($)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-400 text-sm">$</span>
                    <input type="number" min={0} step={0.5} className={inputCls + " pl-6"}
                      value={form.fixedAmountDollars} onChange={f('fixedAmountDollars')} />
                  </div>
                </div>
              )}
            </div>

            {/* Applies to + Min Fare */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Applies To</label>
                <select className={inputCls} value={form.applies_to} onChange={f('applies_to')}>
                  <option value="ALL">All Clients</option>
                  <option value="NEW_CLIENTS">New Clients Only</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Minimum Fare ($) <span className="text-gray-400 font-normal text-xs">to qualify</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-400 text-sm">$</span>
                  <input type="number" min={0} className={inputCls + " pl-6"}
                    value={form.minFareDollars} onChange={f('minFareDollars')} placeholder="0 = no minimum" />
                </div>
              </div>
            </div>

            {/* Service type restriction */}
            <div>
              <label className={labelCls}>
                Restrict to Service Types
                <span className="ml-1 text-xs text-gray-400 font-normal">(none selected = applies to all)</span>
              </label>
              <div className="flex flex-wrap gap-2 mt-1">
                {serviceTypes.map((st: any) => {
                  const ids: string[] = (form as any).service_type_ids ?? [];
                  const checked = ids.includes(st.id);
                  return (
                    <label key={st.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition-colors ${
                      checked ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-300 text-gray-600 hover:border-blue-300'
                    }`}>
                      <input type="checkbox" className="sr-only" checked={checked} onChange={() => {
                        const next = checked ? ids.filter(i => i !== st.id) : [...ids, st.id];
                        setForm(p => ({ ...p, service_type_ids: next.length ? next : null } as any));
                      }} />
                      {st.display_name ?? st.name}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Validity dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Valid From <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
                <input type="datetime-local" className={inputCls}
                  value={form.start_at ? form.start_at.slice(0, 16) : ''}
                  onChange={e => setForm(p => ({ ...p, start_at: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
              </div>
              <div>
                <label className={labelCls}>Valid Until <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
                <input type="datetime-local" className={inputCls}
                  value={form.end_at ? form.end_at.slice(0, 16) : ''}
                  onChange={e => setForm(p => ({ ...p, end_at: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
              </div>
            </div>

            {/* Usage limits */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Total Use Limit <span className="text-gray-400 font-normal text-xs">(blank = unlimited)</span></label>
                <input type="number" min={1} className={inputCls}
                  value={form.max_uses ?? ''} onChange={e => setForm(p => ({ ...p, max_uses: e.target.value ? Number(e.target.value) : null }))}
                  placeholder="Unlimited" />
              </div>
              <div>
                <label className={labelCls}>Per Customer Limit</label>
                <input type="number" min={1} className={inputCls}
                  value={form.max_uses_per_customer ?? 1} onChange={f('max_uses_per_customer')} />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className={labelCls}>Internal Notes <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
              <textarea className={inputCls + " h-16 resize-none"} value={form.description ?? ''} onChange={f('description')} />
            </div>

            {/* Active toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.active !== false}
                onChange={e => setForm(p => ({ ...p, active: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded" />
              <span className="text-sm font-medium text-gray-700">Active (discount is live)</span>
            </label>

            <div className="flex gap-3">
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.name}>
                {saveMut.isPending ? 'Saving...' : editing ? 'Update Discount' : 'Create Discount'}
              </Button>
              <Button variant="secondary" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {/* ── Discounts list ── */}
      <Card title={`Discounts (${discounts.length})`}>
        {isLoading ? (
          <p className="text-sm text-gray-400 py-4">Loading...</p>
        ) : discounts.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-gray-400 text-sm">No discounts yet.</p>
            <p className="text-gray-300 text-xs mt-1">Create your first discount to offer savings to customers.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="py-2 pr-4">Name / Code</th>
                  <th className="py-2 pr-4">Discount</th>
                  <th className="py-2 pr-4">Applies To</th>
                  <th className="py-2 pr-4">Validity</th>
                  <th className="py-2 pr-4">Uses</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {discounts.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-gray-900">{d.name}</p>
                      {d.code ? (
                        <span className="inline-block mt-0.5 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-mono rounded">
                          {d.code}
                        </span>
                      ) : (
                        <span className="text-xs text-blue-500 italic">Auto-apply</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 font-semibold text-green-600">{fmtDiscount(d)}</td>
                    <td className="py-3 pr-4 text-gray-600">{appliesLabel(d.applies_to)}</td>
                    <td className="py-3 pr-4 text-gray-500 text-xs">
                      {d.start_at || d.end_at ? (
                        <>
                          {d.start_at ? new Date(d.start_at).toLocaleDateString('en-AU') : '∞'}
                          {' — '}
                          {d.end_at   ? new Date(d.end_at).toLocaleDateString('en-AU')   : '∞'}
                        </>
                      ) : (
                        <span className="text-gray-300">No expiry</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      {d.used_count}{d.max_uses ? ` / ${d.max_uses}` : ''}
                    </td>
                    <td className="py-3 pr-4">
                      <button onClick={() => toggleMut.mutate(d)}>
                        <Badge variant={d.active ? 'success' : 'neutral'}>
                          {d.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </button>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(d)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                        <button onClick={() => { if (confirm(`Delete "${d.name}"?`)) deleteMut.mutate(d.id); }}
                          className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
