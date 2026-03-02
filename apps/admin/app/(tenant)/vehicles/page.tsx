'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ListPage } from '@/components/patterns/ListPage';
import api from '@/lib/api';

export default function VehiclesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['tenant-vehicles'],
    queryFn: async () => {
      const res = await api.get('/vehicles');
      return res.data ?? [];
    },
  });

  const vehicles = data ?? [];

  return (
    <ListPage
      title="Fleet Vehicles"
      subtitle="Manage your tenant fleet"
      actions={
        <Link
          href="/vehicles/new"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Claim Vehicle
        </Link>
      }
      table={
        isLoading ? (
          <div className="p-6 text-sm text-gray-500">Loading...</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {['Vehicle', 'Plate', 'Capacity', 'Status'].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {vehicles.map((v: any) => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{v.make} {v.model}</div>
                    <div className="text-xs text-gray-500">{v.vehicle_type_name}</div>
                  </td>
                  <td className="px-6 py-4 text-sm">{v.plate ?? '—'}</td>
                  <td className="px-6 py-4 text-sm">
                    {v.passenger_capacity} pax / {v.luggage_capacity} bags
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        v.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {v.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
              {vehicles.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-gray-500">
                    No vehicles yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )
      }
    />
  );
}
