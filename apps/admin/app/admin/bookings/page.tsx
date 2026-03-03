'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export default function BookingsPage() {
  const { data = [] } = useQuery({
    queryKey: ['platform-bookings'],
    queryFn: async () => {
      const res = await api.get('/platform/bookings');
      return res.data ?? [];
    },
  });

  return (
    <div className="bg-white border rounded p-6">
      <h1 className="text-xl font-semibold mb-4">Bookings</h1>
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            {['Ref', 'Tenant', 'Status', 'Pickup Time'].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.map((b: any) => (
            <tr key={b.id}>
              <td className="px-4 py-3">{b.booking_reference}</td>
              <td className="px-4 py-3">{b.tenant_id}</td>
              <td className="px-4 py-3">{b.operational_status}</td>
              <td className="px-4 py-3">{b.pickup_at_utc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
