'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

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
        <MetricCard label="Active Tenants" value={metrics?.active_tenants ?? 0} />
        <MetricCard label="Bookings Today" value={metrics?.bookings_today ?? 0} />
        <MetricCard label="Completed Today" value={metrics?.completed_today ?? 0} />
      </div>
      <div className="bg-white border rounded p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Tenants</h2>
        <ul className="space-y-2 text-sm">
          {tenants.slice(0, 5).map((t: any) => (
            <li key={t.id} className="flex justify-between">
              <span>{t.name}</span>
              <span className="text-gray-500">{t.status}</span>
            </li>
          ))}
        </ul>
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
