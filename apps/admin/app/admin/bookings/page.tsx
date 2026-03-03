'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

function StatusBadge({ status }: { status: string }) {
  const color = status === 'COMPLETED' ? 'bg-green-100 text-green-800' : status === 'CANCELLED' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800';
  return <span className={`px-2 py-1 rounded text-xs ${color}`}>{status}</span>;
}

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
            {['Reference', 'Tenant', 'Customer', 'Status', 'Total', 'Created'].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.map((b: any) => (
            <tr key={b.id}>
              <td className="px-4 py-3">{b.booking_reference}</td>
              <td className="px-4 py-3">{b.tenant_name ?? '-'}</td>
              <td className="px-4 py-3">{b.customer_first_name} {b.customer_last_name}</td>
              <td className="px-4 py-3"><StatusBadge status={b.operational_status ?? 'UNKNOWN'} /></td>
              <td className="px-4 py-3">{b.total_price_minor ? `${(b.total_price_minor / 100).toFixed(2)} ${b.currency}` : '-'}</td>
              <td className="px-4 py-3 text-gray-600">{b.created_at ? new Date(b.created_at).toLocaleString() : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
