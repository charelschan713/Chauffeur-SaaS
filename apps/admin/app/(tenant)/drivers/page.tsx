'use client';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ListPage } from '@/components/patterns/ListPage';
import api from '@/lib/api';

export default function DriversPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const res = await api.get('/drivers');
      return res.data ?? [];
    },
  });

  const [form, setForm] = useState({
    id: '',
    full_name: '',
    email: '',
    phone: '',
    status: 'ACTIVE',
  });

  async function handleCreate() {
    await api.post('/drivers', {
      full_name: form.full_name,
      email: form.email,
      phone: form.phone,
    });
    setForm({ id: '', full_name: '', email: '', phone: '', status: 'ACTIVE' });
    await refetch();
  }

  async function handleUpdate() {
    if (!form.id) return;
    await api.patch(`/drivers/${form.id}`, {
      full_name: form.full_name,
      email: form.email,
      phone: form.phone,
      status: form.status,
    });
    setForm({ id: '', full_name: '', email: '', phone: '', status: 'ACTIVE' });
    await refetch();
  }

  return (
    <ListPage
      title="Drivers"
      subtitle="Manage drivers and availability"
      actions={
        <button
          onClick={() => setForm({ id: '', full_name: '', email: '', phone: '', status: 'ACTIVE' })}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Add Driver
        </button>
      }
      table={
        isLoading ? (
          <div className="p-6 text-sm text-gray-500">Loading...</div>
        ) : (
          <div className="p-6 space-y-4">
            <div className="bg-gray-50 p-4 rounded border">
              <h3 className="text-sm font-semibold mb-2">{form.id ? 'Edit Driver' : 'Add Driver'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className="border rounded px-3 py-2 text-sm" placeholder="Full Name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                <input className="border rounded px-3 py-2 text-sm" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <input className="border rounded px-3 py-2 text-sm" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                <select className="border rounded px-3 py-2 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
              <div className="flex gap-2 mt-3">
                {form.id ? (
                  <button onClick={handleUpdate} className="px-4 py-2 rounded bg-blue-600 text-white text-sm">Update Driver</button>
                ) : (
                  <button onClick={handleCreate} className="px-4 py-2 rounded bg-blue-600 text-white text-sm">Create Driver</button>
                )}
              </div>
            </div>

            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Name', 'Email', 'Phone', 'Status', ''].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(data ?? []).map((d: any) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{d.full_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{d.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{d.phone ?? '—'}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${d.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      <button
                        className="text-blue-600 hover:underline"
                        onClick={() => setForm({
                          id: d.id,
                          full_name: d.full_name,
                          email: d.email,
                          phone: d.phone ?? '',
                          status: d.status ?? 'ACTIVE',
                        })}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
                {(data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-gray-500">No drivers yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )
      }
    />
  );
}
