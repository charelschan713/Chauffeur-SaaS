'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

function StatusBadge({ status }: { status: string }) {
  const color = status === 'active' ? 'bg-green-100 text-green-800' : status === 'inactive' ? 'bg-gray-200 text-gray-700' : 'bg-yellow-100 text-yellow-800';
  return <span className={`px-2 py-1 rounded text-xs ${color}`}>{status}</span>;
}

export default function DriversPage() {
  const { data = [] } = useQuery({
    queryKey: ['platform-drivers'],
    queryFn: async () => {
      const res = await api.get('/platform/drivers');
      return res.data ?? [];
    },
  });

  return (
    <div className="bg-white border rounded p-6">
      <h1 className="text-xl font-semibold mb-4">Drivers</h1>
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            {['Name', 'Email', 'Status', 'Tenant', 'Created'].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.map((d: any) => (
            <tr key={d.id}>
              <td className="px-4 py-3">{d.first_name} {d.last_name}</td>
              <td className="px-4 py-3">{d.email}</td>
              <td className="px-4 py-3"><StatusBadge status={d.status ?? 'unknown'} /></td>
              <td className="px-4 py-3">{d.tenant_name ?? '-'}</td>
              <td className="px-4 py-3 text-gray-600">{d.created_at ? new Date(d.created_at).toLocaleString() : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
