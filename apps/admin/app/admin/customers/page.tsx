'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

function TierBadge({ tier }: { tier: string }) {
  const color = tier === 'VIP' ? 'bg-purple-100 text-purple-800' : tier === 'PLATINUM' ? 'bg-gray-200 text-gray-800' : tier === 'GOLD' ? 'bg-yellow-100 text-yellow-800' : tier === 'SILVER' ? 'bg-gray-100 text-gray-700' : 'bg-green-100 text-green-800';
  return <span className={`px-2 py-1 rounded text-xs ${color}`}>{tier ?? 'STANDARD'}</span>;
}

export default function CustomersPage() {
  const { data = [] } = useQuery({
    queryKey: ['platform-customers'],
    queryFn: async () => {
      const res = await api.get('/platform/customers');
      return res.data ?? [];
    },
  });

  return (
    <div className="bg-white border rounded p-6">
      <h1 className="text-xl font-semibold mb-4">Customers</h1>
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            {['Name', 'Email', 'Tier', 'Tenant', 'Created'].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.map((c: any) => (
            <tr key={c.id}>
              <td className="px-4 py-3">{c.first_name} {c.last_name}</td>
              <td className="px-4 py-3">{c.email}</td>
              <td className="px-4 py-3"><TierBadge tier={c.tier ?? 'STANDARD'} /></td>
              <td className="px-4 py-3">{c.tenant_name ?? '-'}</td>
              <td className="px-4 py-3 text-gray-600">{c.created_at ? new Date(c.created_at).toLocaleString() : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
