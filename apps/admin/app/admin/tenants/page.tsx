'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

function StatusBadge({ status }: { status: string }) {
  const color = status === 'active' ? 'bg-green-100 text-green-800' : status === 'suspended' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-200 text-gray-700';
  return <span className={`px-2 py-1 rounded text-xs ${color}`}>{status}</span>;
}

export default function TenantsPage() {
  const { data = [], refetch } = useQuery({
    queryKey: ['platform-tenants'],
    queryFn: async () => {
      const res = await api.get('/platform/tenants');
      return res.data ?? [];
    },
  });

  const [form, setForm] = useState({ name: '', slug: '', timezone: 'UTC', currency: 'AUD' });

  async function handleCreate() {
    await api.post('/platform/tenants', form);
    setForm({ name: '', slug: '', timezone: 'UTC', currency: 'AUD' });
    await refetch();
  }

  async function handleStatus(id: string, status: string) {
    await api.patch(`/platform/tenants/${id}/status`, { status });
    await refetch();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-white border rounded">
        <div className="p-6 border-b">
          <h1 className="text-xl font-semibold">Tenants</h1>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Name', 'Slug', 'Status', 'Timezone', 'Currency', 'Created', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map((t: any) => (
              <tr key={t.id}>
                <td className="px-4 py-3 font-medium">{t.name}</td>
                <td className="px-4 py-3">{t.slug}</td>
                <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                <td className="px-4 py-3">{t.timezone}</td>
                <td className="px-4 py-3">{t.currency}</td>
                <td className="px-4 py-3 text-gray-600">{t.created_at ? new Date(t.created_at).toLocaleString() : '-'}</td>
                <td className="px-4 py-3">
                  <select
                    className="border rounded px-2 py-1 text-sm"
                    value={t.status}
                    onChange={(e) => handleStatus(t.id, e.target.value)}
                  >
                    <option value="active">active</option>
                    <option value="suspended">suspended</option>
                    <option value="archived">archived</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white border rounded p-6 space-y-4">
        <h2 className="text-lg font-semibold">Create Tenant</h2>
        <div className="space-y-3">
          <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Name" className="border rounded px-3 py-2 text-sm w-full" />
          <input value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} placeholder="Slug" className="border rounded px-3 py-2 text-sm w-full" />
          <input value={form.timezone} onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))} placeholder="Timezone" className="border rounded px-3 py-2 text-sm w-full" />
          <input value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))} placeholder="Currency" className="border rounded px-3 py-2 text-sm w-full" />
        </div>
        <button onClick={handleCreate} className="px-4 py-2 rounded bg-blue-600 text-white text-sm">Create Tenant</button>
      </div>
    </div>
  );
}
