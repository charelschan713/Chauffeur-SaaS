'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

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
    <div className="space-y-6">
      <div className="bg-white border rounded p-6 space-y-4">
        <h1 className="text-xl font-semibold">Tenants</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Name" className="border rounded px-3 py-2 text-sm" />
          <input value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} placeholder="Slug" className="border rounded px-3 py-2 text-sm" />
          <input value={form.timezone} onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))} placeholder="Timezone" className="border rounded px-3 py-2 text-sm" />
          <input value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))} placeholder="Currency" className="border rounded px-3 py-2 text-sm" />
        </div>
        <button onClick={handleCreate} className="px-4 py-2 rounded bg-blue-600 text-white text-sm">Create Tenant</button>
      </div>

      <div className="bg-white border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Name', 'Slug', 'Status', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map((t: any) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{t.name}</td>
                <td className="px-4 py-3">{t.slug}</td>
                <td className="px-4 py-3">{t.status}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => handleStatus(t.id, 'active')} className="text-blue-600 hover:underline">Activate</button>
                  <button onClick={() => handleStatus(t.id, 'suspended')} className="text-red-600 hover:underline">Suspend</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
