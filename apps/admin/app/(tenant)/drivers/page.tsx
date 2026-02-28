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

  const list = (
    <div className="divide-y divide-gray-100">
      {drivers.map((driver) => (
        <div key={driver.driver_id} className="flex flex-col md:flex-row md:items-center justify-between p-4 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-900">{driver.full_name}</p>
            <p className="text-sm text-gray-500">{driver.email}</p>
          </div>
          <div className="flex items-center gap-4">
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
