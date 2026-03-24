'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';

const STATUS_STYLE: Record<string, string> = {
  DRAFT:     'bg-gray-100 text-gray-500',
  ACTIVE:    'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
};

export default function CustomerProjectsPage() {
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['customer-projects'],
    queryFn: async () => (await api.get('/customer-portal/projects')).data,
  });

  const fmtDt = (dt: string | null) => dt
    ? new Date(dt).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Australia/Sydney' })
    : null;

  if (isLoading) return (
    <div className="flex items-center justify-center py-24 text-gray-400">Loading projects…</div>
  );

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-4">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">My Projects</h1>
        <p className="text-sm text-gray-500 mt-1">Track your coordinated transport projects and event transfers.</p>
      </div>

      {projects.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-4">📋</p>
          <p className="font-semibold text-gray-600">No projects yet</p>
          <p className="text-sm mt-1">Your coordinated bookings will appear here when set up by your operator.</p>
        </div>
      )}

      {projects.map((p: any) => (
        <Link key={p.id} href={`/projects/${p.id}`}
          className="block bg-white border border-gray-200 rounded-2xl p-5 hover:border-gray-300 hover:shadow-sm transition-all">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-bold text-gray-900">{p.project_name}</p>
              <p className="text-sm text-gray-500 mt-0.5">
                {p.project_type?.replace(/_/g,' ')}
                {(p.start_at || p.end_at) && (
                  <span> · {fmtDt(p.start_at)}{p.end_at ? ` – ${fmtDt(p.end_at)}` : ''}</span>
                )}
              </p>
            </div>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_STYLE[p.status] ?? 'bg-gray-100 text-gray-500'}`}>
              {p.status}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
            <span>{p.booking_count} booking{p.booking_count !== 1 ? 's' : ''}</span>
            {p.status === 'ACTIVE' && (
              <span className="text-blue-600 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
                In progress
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
