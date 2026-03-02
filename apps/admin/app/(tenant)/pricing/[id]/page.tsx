'use client';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { DetailPage, DetailSection } from '@/components/patterns/DetailPage';
import api from '@/lib/api';

export default function ServiceClassDetailPage() {
  const params = useParams();
  const serviceClassId = String(params?.id || '');

  const classQuery = useQuery({
    queryKey: ['service-class', serviceClassId],
    queryFn: async () => {
      const res = await api.get(`/pricing/service-classes/${serviceClassId}`);
      return res.data;
    },
    enabled: !!serviceClassId,
  });

  const itemsQuery = useQuery({
    queryKey: ['pricing-items', serviceClassId],
    queryFn: async () => {
      const res = await api.get(`/pricing/items?serviceClassId=${serviceClassId}`);
      return res.data ?? [];
    },
    enabled: !!serviceClassId,
  });

  if (classQuery.isLoading) return <div className="text-gray-500">Loading...</div>;
  const serviceClass = classQuery.data;
  const items = itemsQuery.data ?? [];

  return (
    <DetailPage
      title={serviceClass?.name ?? 'Service Class'}
      subtitle={serviceClass?.description ?? 'Pricing details'}
      primary={
        <DetailSection title="Pricing Items">
          <div className="overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {['Type', 'Unit', 'Amount', 'Active'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item: any) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">{item.item_type}</td>
                    <td className="px-4 py-2 text-sm">{item.unit}</td>
                    <td className="px-4 py-2 text-sm">{item.amount_minor}</td>
                    <td className="px-4 py-2 text-sm">
                      {item.active ? 'Yes' : 'No'}
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-gray-500">
                      No pricing items
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DetailSection>
      }
      secondary={
        <DetailSection title="Service Class Details">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Currency</p>
              <p className="text-sm font-medium">{serviceClass?.currency ?? 'AUD'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Surge</p>
              <p className="text-sm font-medium">{serviceClass?.surge_multiplier}x</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Status</p>
              <p className="text-sm font-medium">{serviceClass?.active ? 'Active' : 'Inactive'}</p>
            </div>
          </div>
        </DetailSection>
      }
    />
  );
}
