'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

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
            {['Name', 'Email', 'Tenant'].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.map((d: any) => (
            <tr key={d.id}>
              <td className="px-4 py-3">{d.full_name}</td>
              <td className="px-4 py-3">{d.email}</td>
              <td className="px-4 py-3">{d.tenant_id}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
