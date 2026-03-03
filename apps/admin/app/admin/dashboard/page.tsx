'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

function StatusBadge({ status }: { status: string }) {
  const color = status === 'active' ? 'bg-green-100 text-green-800' : status === 'suspended' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-200 text-gray-700';
  return <span className={`px-2 py-1 rounded text-xs ${color}`}>{status}</span>;
}

export default function DashboardPage() {
  const { data: metrics } = useQuery({
    queryKey: ['platform-metrics'],
    queryFn: async () => {
      const res = await api.get('/platform/metrics');
      return res.data;
    },
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['platform-tenants'],
    queryFn: async () => {
      const res = await api.get('/platform/tenants');
      return res.data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard label="Active Tenants" value={Number(metrics?.active_tenants ?? 0)} />
        <MetricCard label="Bookings Today" value={Number(metrics?.bookings_today ?? 0)} />
        <MetricCard label="Completed Today" value={Number(metrics?.completed_today ?? 0)} />
      </div>

      <div className="bg-white border rounded p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Tenants</h2>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Name', 'Slug', 'Status', 'Created'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {tenants.slice(0, 5).map((t: any) => (
              <tr key={t.id}>
                <td className="px-4 py-3 font-medium">{t.name}</td>
                <td className="px-4 py-3">{t.slug}</td>
                <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                <td className="px-4 py-3 text-gray-600">{t.created_at ? new Date(t.created_at).toLocaleString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border rounded p-6">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-semibold mt-2">{value}</p>
    </div>
  );
}
