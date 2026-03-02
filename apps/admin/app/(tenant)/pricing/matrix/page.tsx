'use client';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { ListPage } from '@/components/patterns/ListPage';

interface ServiceType {
  id: string;
  code: string;
  display_name: string;
}

interface ServiceClass {
  id: string;
  name: string;
}

interface PricingProfile {
  id: string;
  service_type_id: string;
  service_class_id: string;
  active: boolean;
}

export default function PricingMatrixPage() {
  const router = useRouter();
  const { data: serviceTypes = [], isLoading: loadingTypes } = useQuery({
    queryKey: ['service-types'],
    queryFn: async () => {
      const res = await api.get('/service-types');
      return res.data ?? [];
    },
  });
  const { data: serviceClasses = [], isLoading: loadingClasses } = useQuery({
    queryKey: ['pricing-service-classes'],
    queryFn: async () => {
      const res = await api.get('/pricing/service-classes');
      return res.data ?? [];
    },
  });
  const { data: pricingProfiles = [], refetch } = useQuery({
    queryKey: ['pricing-profiles'],
    queryFn: async () => {
      const res = await api.get('/pricing-profiles');
      return res.data ?? [];
    },
  });

  const profileMap = useMemo(() => {
    const map = new Map<string, PricingProfile>();
    for (const profile of pricingProfiles as PricingProfile[]) {
      map.set(`${profile.service_class_id}:${profile.service_type_id}`, profile);
    }
    return map;
  }, [pricingProfiles]);

  async function handleConfigure(serviceClassId: string, serviceTypeId: string) {
    const key = `${serviceClassId}:${serviceTypeId}`;
    const existing = profileMap.get(key);
    if (existing) {
      router.push(`/pricing/matrix/${existing.id}`);
      return;
    }
    const res = await api.post('/pricing-profiles', {
      service_type_id: serviceTypeId,
      service_class_id: serviceClassId,
    });
    await refetch();
    router.push(`/pricing/matrix/${res.data.id}`);
  }

  const loading = loadingTypes || loadingClasses;

  return (
    <ListPage
      title="Pricing Matrix"
      subtitle="Configure pricing profiles by service type and service class"
      table={
        loading ? (
          <div className="p-6 text-sm text-gray-500">Loading...</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Service Class
                </th>
                {(serviceTypes as ServiceType[]).map((type) => (
                  <th
                    key={type.id}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                  >
                    {type.display_name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(serviceClasses as ServiceClass[]).map((serviceClass) => (
                <tr key={serviceClass.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {serviceClass.name}
                  </td>
                  {(serviceTypes as ServiceType[]).map((type) => {
                    const key = `${serviceClass.id}:${type.id}`;
                    const profile = profileMap.get(key);
                    return (
                      <td key={type.id} className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-3">
                          {profile?.active ? (
                            <span className="text-green-700 text-xs font-medium">✅ Configured</span>
                          ) : (
                            <span className="text-gray-400 text-xs">Not configured</span>
                          )}
                          <button
                            onClick={() => handleConfigure(serviceClass.id, type.id)}
                            className="text-blue-600 hover:underline"
                          >
                            Configure
                          </button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {(serviceClasses as ServiceClass[]).length === 0 && (
                <tr>
                  <td
                    colSpan={(serviceTypes as ServiceType[]).length + 1}
                    className="text-center py-10 text-gray-500"
                  >
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
