'use client';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ListPage } from '@/components/patterns/ListPage';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Table } from '@/components/ui/Table';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorAlert } from '@/components/ui/ErrorAlert';

export default function DriversPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const res = await api.get('/drivers');
      const d = res.data;
      return Array.isArray(d) ? d : (d?.data ?? []);
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

  if (error) return <ErrorAlert message="Unable to load drivers" onRetry={refetch} />;

  return (
    <ListPage
      title="Drivers"
      subtitle="Manage drivers and availability"
      actions={
        <Button onClick={() => setForm({ id: '', full_name: '', email: '', phone: '', status: 'ACTIVE' })}>
          Add Driver
        </Button>
      }
      table={
        isLoading ? (
          <div className="flex items-center justify-center h-32"><LoadingSpinner /></div>
        ) : (data ?? []).length === 0 ? (
          <EmptyState title="No drivers yet" description="Add your first driver to get started." />
        ) : (
          <div className="p-6 space-y-4">
            <div className="bg-gray-50 p-4 rounded border">
              <h3 className="text-sm font-semibold mb-2">{form.id ? 'Edit Driver' : 'Add Driver'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input placeholder="Full Name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </Select>
              </div>
              <div className="flex gap-2 mt-3">
                {form.id ? (
                  <Button onClick={handleUpdate}>Update Driver</Button>
                ) : (
                  <Button onClick={handleCreate}>Create Driver</Button>
                )}
              </div>
            </div>

            <Table headers={['Name', 'Email', 'Phone', 'Status', '']}>
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
            </Table>
          </div>
        )
      }
    />
  );
}
