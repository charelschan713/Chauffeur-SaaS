'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    total: 0,
    confirmed: 0,
    completed: 0,
    pending: 0,
  });

  useEffect(() => {
    api.get('/bookings').then((r) => {
      const bookings = r.data;
      setStats({
        total: bookings.length,
        confirmed: bookings.filter((b: any) => b.operational_status === 'CONFIRMED').length,
        completed: bookings.filter((b: any) => b.operational_status === 'COMPLETED').length,
        pending: bookings.filter((b: any) => b.operational_status === 'PENDING').length,
      });
    });
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Bookings" value={stats.total} color="blue" />
        <StatCard label="Pending" value={stats.pending} color="yellow" />
        <StatCard label="Confirmed" value={stats.confirmed} color="green" />
        <StatCard label="Completed" value={stats.completed} color="gray" />
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'border-blue-500',
    yellow: 'border-yellow-500',
    green: 'border-green-500',
    gray: 'border-gray-500',
  };
  return (
    <div className={`bg-white rounded-lg p-6 shadow border-l-4 ${colors[color]}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-bold mt-2">{value}</p>
    </div>
  );
}
