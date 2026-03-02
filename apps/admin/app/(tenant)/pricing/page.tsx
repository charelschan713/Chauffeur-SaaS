'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ListPage } from '@/components/patterns/ListPage';
import api from '@/lib/api';

interface ServiceClass {
  id: string;
  name: string;
  description?: string;
  surge_multiplier: string;
  currency: string;
  active: boolean;
  created_at: string;
}

export default function PricingServiceClassesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['service-classes'],
    queryFn: async () => {
      const res = await api.get('/pricing/service-classes');
      return res.data ?? [];
    },
  });

  const classes: ServiceClass[] = data ?? [];

  return (
    <ListPage
      title="Service Classes"
      subtitle="Manage pricing service classes for your tenant"
      actions={
        <Link
          href="/pricing/new"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          New Service Class
        </Link>
      }
      table={
        isLoading ? (
          <div className="p-6 text-sm text-gray-500">Loading...</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Currency', 'Surge', 'Status', 'Created', ''].map((h) => (
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
              {classes.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{c.name}</div>
                    {c.description && (
                      <div className="text-xs text-gray-500">{c.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">{c.currency}</td>
                  <td className="px-6 py-4 text-sm">{c.surge_multiplier}x</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        c.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {c.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`/pricing/${c.id}`} className="text-blue-600 hover:underline text-sm">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {classes.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-500">
                    No service classes yet
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
