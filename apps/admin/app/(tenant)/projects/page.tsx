'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';

const STATUS_STYLE: Record<string, string> = {
  DRAFT:     'bg-gray-100 text-gray-600',
  ACTIVE:    'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
  ARCHIVED:  'bg-gray-50 text-gray-400',
};

const TYPE_LABEL: Record<string, string> = {
  EVENT_TRANSFER:    'Event Transfer',
  VIP_COORDINATION:  'VIP Coordination',
  CORPORATE:         'Corporate',
  DELEGATION:        'Delegation',
  OTHER:             'Other',
};

export default function ProjectsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    project_name: '', project_type: 'EVENT_TRANSFER',
    customer_id: '', start_at: '', end_at: '', notes: '',
  });

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['admin-projects'],
    queryFn: async () => (await api.get('/projects')).data,
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/projects', {
      ...form,
      customer_id: form.customer_id || undefined,
      start_at: form.start_at || undefined,
      end_at: form.end_at || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-projects'] });
      setShowCreate(false);
      setForm({ project_name: '', project_type: 'EVENT_TRANSFER', customer_id: '', start_at: '', end_at: '', notes: '' });
    },
  });

  const fmtDt = (dt: string | null) => dt
    ? new Date(dt).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Group multiple bookings into one operational dashboard for event transfers, VIP coordination, and delegations.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700"
        >
          {showCreate ? 'Cancel' : '+ New Project'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Create Project</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Project Name *</label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.project_name}
                onChange={e => setForm(f => ({ ...f, project_name: e.target.value }))}
                placeholder="e.g. APEC Delegation Transport 2026" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Type</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.project_type}
                onChange={e => setForm(f => ({ ...f, project_type: e.target.value }))}>
                {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Customer ID (optional)</label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.customer_id}
                onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}
                placeholder="customer UUID" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Start Date</label>
              <input type="datetime-local" className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.start_at} onChange={e => setForm(f => ({ ...f, start_at: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">End Date</label>
              <input type="datetime-local" className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.end_at} onChange={e => setForm(f => ({ ...f, end_at: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Notes (internal)</label>
              <textarea rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!form.project_name || createMutation.isPending}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating…' : 'Create Project'}
          </button>
        </div>
      )}

      {/* List */}
      {isLoading && <div className="text-center py-16 text-gray-400">Loading…</div>}
      {!isLoading && projects.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-3xl mb-3">📋</p>
          <p className="font-semibold">No projects yet</p>
        </div>
      )}
      {!isLoading && projects.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Project','Type','Customer','Period','Bookings','Status',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {projects.map((p: any) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">{p.project_name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{TYPE_LABEL[p.project_type] ?? p.project_type}</td>
                  <td className="px-4 py-3 text-gray-600">{p.customer_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {fmtDt(p.start_at)}{p.end_at ? ` – ${fmtDt(p.end_at)}` : ''}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.booking_count ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[p.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/projects/${p.id}`} className="text-blue-600 hover:underline text-xs font-medium">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
