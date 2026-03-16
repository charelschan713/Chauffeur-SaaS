'use client';

import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import Link from 'next/link';
import TenantStatusActions from '@/components/platform/TenantStatusActions';

export default function PlatformTenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['platform-tenant', id],
    queryFn: async () => {
      const { data } = await api.get(`/platform/tenants/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const statusMut = useMutation({
    mutationFn: async (status: string) => {
      await api.patch(`/platform/tenants/${id}/status`, { status });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-tenant', id] });
      qc.invalidateQueries({ queryKey: ['platform-tenants'] });
    },
  });

  if (isLoading) return <div className="text-sm text-gray-500">Loading tenant details…</div>;
  if (!data) return <div className="text-sm text-red-600">Tenant not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{data.business_name || data.slug}</h1>
          <p className="text-sm text-gray-500">Platform tenant detail</p>
        </div>
        <Link href="/tenants" className="text-sm text-indigo-600 hover:underline">Back to list</Link>
      </div>

      <div className="rounded-lg border bg-white p-4 space-y-3">
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          <Info label="Tenant ID" value={data.id} mono />
          <Info label="Slug" value={data.slug} mono />
          <Info label="Status" value={data.status} />
          <Info label="Created" value={data.created_at ? new Date(data.created_at).toLocaleString() : '—'} />
          <Info label="Business Name" value={data.business_name || '—'} />
          <Info label="ABN" value={data.abn || '—'} />
          <Info label="Phone" value={data.phone || '—'} />
          <Info label="Email" value={data.email || '—'} />
        </div>

        <div className="pt-2 flex flex-wrap gap-2">
          {data.status !== 'active' && (
            <button className="rounded bg-green-600 text-white text-sm px-3 py-2" onClick={() => statusMut.mutate('active')} disabled={statusMut.isPending}>
              Activate
            </button>
          )}
          {data.status === 'active' && (
            <button className="rounded bg-amber-600 text-white text-sm px-3 py-2" onClick={() => statusMut.mutate('suspended')} disabled={statusMut.isPending}>
              Suspend
            </button>
          )}
          {data.status !== 'inactive' && (
            <button className="rounded bg-gray-700 text-white text-sm px-3 py-2" onClick={() => statusMut.mutate('inactive')} disabled={statusMut.isPending}>
              Mark Inactive
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded border border-gray-100 p-2">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-sm text-gray-900 ${mono ? 'font-mono break-all' : ''}`}>{value}</div>
    </div>
  );
}
