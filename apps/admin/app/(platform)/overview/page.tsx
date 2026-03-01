'use client';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface Metrics {
  active_tenants: string;
  bookings_today: string;
  completed_today: string;
}

export default function OverviewPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['platform-metrics'],
    queryFn: async () => {
      const res = await api.get('/platform/metrics');
      return res.data?.data ?? null;
    },
  });

  const metrics = data as Metrics | null;

  if (isLoading || !metrics) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Platform Overview</h2>
      <div className="grid grid-cols-3 gap-6">
        <MetricCard label="Active Tenants" value={metrics.active_tenants} />
        <MetricCard label="Bookings Today" value={metrics.bookings_today} />
        <MetricCard label="Completed Today" value={metrics.completed_today} />
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg p-6 shadow">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-bold mt-2">{value}</p>
    </div>
  );
}
