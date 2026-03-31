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

  const { data: perms } = useQuery({
    queryKey: ['platform-tenant-perms', id],
    queryFn: async () => {
      const { data } = await api.get(`/platform/tenants/${id}/permissions`);
      return data;
    },
    enabled: !!id,
  });

  const permMut = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.patch(`/platform/tenants/${id}/permissions`, payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-tenant-perms', id] });
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

      <div className="rounded-lg border bg-white p-4 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Permissions</h2>
          <p className="text-sm text-gray-500">Whitelist tenant access to platform APIs</p>
        </div>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <ToggleRow
            label="Can push jobs"
            value={!!perms?.can_push_jobs}
            onChange={(v) => permMut.mutate({ ...perms, can_push_jobs: v })}
          />
          <ToggleRow
            label="Can partner assign"
            value={!!perms?.can_partner_assign}
            onChange={(v) => permMut.mutate({ ...perms, can_partner_assign: v })}
          />
          <ToggleRow
            label="Can driver app access"
            value={!!perms?.can_driver_app_access}
            onChange={(v) => permMut.mutate({ ...perms, can_driver_app_access: v })}
          />
          <ToggleRow
            label="Can API access"
            value={!!perms?.can_api_access}
            onChange={(v) => permMut.mutate({ ...perms, can_api_access: v })}
          />
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

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded border border-gray-100 p-3">
      <span className="text-gray-800">{label}</span>
      <button
        className={`h-6 w-11 rounded-full transition ${value ? 'bg-green-600' : 'bg-gray-300'}`}
        onClick={() => onChange(!value)}
        aria-label={label}
      >
        <span
          className={`block h-5 w-5 bg-white rounded-full translate-x-1 transition ${
            value ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
