'use client';
import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

interface Passenger {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  first_name: string;
  last_name: string;
  phone_country_code: string | null;
  phone_number: string | null;
  preferences: Record<string, any>;
  active: boolean;
  created_at: string;
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide';

export default function PassengersPage() {
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Passenger | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Passenger>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/customers/passengers/all');
      setPassengers(res.data ?? []);
    } catch {
      setPassengers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = passengers.filter(p => {
    const q = search.toLowerCase();
    return !q
      || `${p.first_name} ${p.last_name}`.toLowerCase().includes(q)
      || p.customer_name?.toLowerCase().includes(q)
      || p.customer_email?.toLowerCase().includes(q)
      || p.phone_number?.includes(q);
  });

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const openEdit = (p: Passenger) => {
    setEditing(p);
    setForm({ ...p });
    setShowForm(true);
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.patch(`/customers/${editing.customer_id}/passengers/${editing.id}`, {
        first_name: form.first_name,
        last_name: form.last_name,
        phone_country_code: form.phone_country_code || null,
        phone_number: form.phone_number || null,
        active: form.active,
      });
      setShowForm(false);
      load();
    } catch {
      alert('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: Passenger) => {
    try {
      await api.patch(`/customers/${p.customer_id}/passengers/${p.id}`, { active: !p.active });
      load();
    } catch { alert('Failed to update'); }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Passengers</h1>
          <p className="text-sm text-gray-500 mt-1">Saved passenger profiles across all customers</p>
        </div>
        <div className="text-sm text-gray-500">{filtered.length} passengers</div>
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          className={inputCls}
          placeholder="Search by name, customer, email or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <span className="text-3xl mb-2">👤</span>
            <p className="text-sm">No passengers found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Passenger</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Customer</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Phone</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Preferences</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{p.first_name} {p.last_name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">ID: {p.id.slice(0, 8)}…</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-900">{p.customer_name || '—'}</div>
                    <div className="text-xs text-gray-400">{p.customer_email || '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {p.phone_country_code && p.phone_number
                      ? `${p.phone_country_code} ${p.phone_number}`
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs max-w-[180px] truncate">
                    {p.preferences && Object.keys(p.preferences).length > 0
                      ? Object.entries(p.preferences).map(([k, v]) => `${k}: ${v}`).join(', ')
                      : <span className="text-gray-400">None</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(p)}
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        p.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                      {p.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => openEdit(p)}
                      className="text-blue-600 hover:underline text-sm font-medium">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit modal */}
      {showForm && editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Edit Passenger</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                Customer: <span className="font-medium text-gray-700">{editing.customer_name}</span> ({editing.customer_email})
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>First Name</label>
                  <input className={inputCls} value={form.first_name ?? ''} onChange={f('first_name')} />
                </div>
                <div>
                  <label className={labelCls}>Last Name</label>
                  <input className={inputCls} value={form.last_name ?? ''} onChange={f('last_name')} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Country Code</label>
                  <input className={inputCls} value={form.phone_country_code ?? ''} onChange={f('phone_country_code')} placeholder="+61" />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Phone Number</label>
                  <input className={inputCls} value={form.phone_number ?? ''} onChange={f('phone_number')} placeholder="415880519" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="pax-active" checked={!!form.active}
                  onChange={e => setForm(p => ({ ...p, active: e.target.checked }))}
                  className="w-4 h-4 accent-blue-600" />
                <label htmlFor="pax-active" className="text-sm text-gray-700 font-medium">Active</label>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3 justify-end">
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={save} disabled={saving}
                className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
