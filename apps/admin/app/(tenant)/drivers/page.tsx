'use client';
import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { ListPage } from '@/components/patterns/ListPage';
import { ErrorAlert } from '@/components/ui/ErrorAlert';

interface Driver {
  driver_id: string;
  full_name: string;
  email: string;
  phone?: string;
  availability_status: string;
  last_seen_at?: string;
}

const STATUS_OPTIONS = ['AVAILABLE', 'OFFLINE', 'UNAVAILABLE'];

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-green-100 text-green-700',
  OFFLINE: 'bg-gray-100 text-gray-700',
  UNAVAILABLE: 'bg-yellow-100 text-yellow-800',
  ON_JOB: 'bg-blue-100 text-blue-800',
};

export default function DriversPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '' });
  const [editingId, setEditingId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['drivers', { search, statusFilter }],
    queryFn: async () => {
      const response = await api.get('/drivers', {
        params: {
          search: search || undefined,
          availability_status: statusFilter || undefined,
        },
      });
      return response.data.data as Driver[];
    },
  });

  const drivers = query.data ?? [];

  const statusMutation = useMutation({
    mutationFn: async ({ driverId, status }: { driverId: string; status: string }) => {
      await api.patch(`/drivers/${driverId}/status`, { availability_status: status });
    },
    onMutate: async ({ driverId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['drivers'] });
      const prev = queryClient.getQueryData<Driver[]>(['drivers', { search, statusFilter }]);
      if (prev) {
        queryClient.setQueryData(
          ['drivers', { search, statusFilter }],
          prev.map((driver) =>
            driver.driver_id === driverId ? { ...driver, availability_status: status } : driver,
          ),
        );
      }
      return { prev };
    },
    onError: (_err, _variables, context) => {
      if (context?.prev) {
        queryClient.setQueryData(['drivers', { search, statusFilter }], context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/drivers', form);
    },
    onSuccess: () => {
      setForm({ first_name: '', last_name: '', email: '', phone: '' });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) return;
      await api.patch(`/drivers/${editingId}`, form);
    },
    onSuccess: () => {
      setEditingId(null);
      setForm({ first_name: '', last_name: '', email: '', phone: '' });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
  });

  const list = (
    <div className="divide-y divide-gray-100">
      {drivers.map((driver) => (
        <div key={driver.driver_id} className="flex flex-col md:flex-row md:items-center justify-between p-4 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-900">{driver.full_name}</p>
            <p className="text-sm text-gray-500">{driver.email}</p>
            <p className="text-xs text-gray-400">{driver.phone ?? '—'}</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              className="text-blue-600 hover:underline text-sm"
              onClick={() => {
                setEditingId(driver.driver_id);
                const names = (driver.full_name || '').split(' ');
                setForm({
                  first_name: names[0] ?? '',
                  last_name: names.slice(1).join(' '),
                  email: driver.email ?? '',
                  phone: driver.phone ?? '',
                });
              }}
            >
              Edit
            </button>
            <div className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[driver.availability_status] ?? 'bg-gray-100 text-gray-700'}`}>
              {driver.availability_status}
            </div>
            <div className="text-xs text-gray-500">
              Last seen {driver.last_seen_at ? new Date(driver.last_seen_at).toLocaleString() : '—'}
            </div>
            <select
              value={driver.availability_status}
              onChange={(e) =>
                statusMutation.mutate({
                  driverId: driver.driver_id,
                  status: e.target.value,
                })
              }
              className="border rounded px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}

      {drivers.length === 0 && !query.isLoading && (
        <div className="p-8 text-center text-gray-500 text-sm">No drivers match this filter.</div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {query.isError && <ErrorAlert message="Unable to load drivers" />}
      <ListPage
        title="Drivers"
        subtitle="Manage availability and monitor live status"
        filters={
          <div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email"
                className="border rounded px-3 py-2 text-sm"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border rounded px-3 py-2 text-sm"
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4 p-4 border rounded bg-white">
              <h3 className="text-sm font-semibold mb-3">{editingId ? 'Edit Driver' : 'Add Driver'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input className="border rounded px-3 py-2 text-sm" placeholder="First name" value={form.first_name} onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))} />
                <input className="border rounded px-3 py-2 text-sm" placeholder="Last name" value={form.last_name} onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))} />
                <input className="border rounded px-3 py-2 text-sm" placeholder="Email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
                <input className="border rounded px-3 py-2 text-sm" placeholder="Phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => (editingId ? editMutation.mutate() : createMutation.mutate())}
                  className="px-4 py-2 rounded bg-blue-600 text-white text-sm"
                >
                  {editingId ? 'Save' : 'Create'}
                </button>
                {editingId && (
                  <button
                    onClick={() => { setEditingId(null); setForm({ first_name: '', last_name: '', email: '', phone: '' }); }}
                    className="px-4 py-2 rounded border text-sm"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        }
        table={
          query.isLoading ? (
            <div className="p-6 text-sm text-gray-500">Loading drivers...</div>
          ) : (
            list
          )
        }
      />
    </div>
  );
}
