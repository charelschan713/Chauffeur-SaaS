'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

const BADGE_STYLE: Record<string, string> = {
  blue:    'bg-blue-100 text-blue-700',
  yellow:  'bg-yellow-100 text-yellow-800',
  purple:  'bg-purple-100 text-purple-700',
  green:   'bg-green-100 text-green-700',
  red:     'bg-red-100 text-red-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  gray:    'bg-gray-100 text-gray-600',
};

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600', ACTIVE: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700', CANCELLED: 'bg-red-100 text-red-600',
  ARCHIVED: 'bg-gray-50 text-gray-400',
};

const fmtDt = (dt: string | null) => dt ? new Date(dt).toLocaleString('en-AU', {
  timeZone: 'Australia/Sydney', day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false,
}) : '—';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [addInput, setAddInput] = useState('');
  const [activeTab, setActiveTab] = useState<'bookings' | 'map' | 'timeline'>('bookings');

  const { data, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => (await api.get(`/projects/${id}`)).data,
    enabled: !!id,
  });

  const activateMutation = useMutation({
    mutationFn: () => api.patch(`/projects/${id}`, { status: 'ACTIVE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', id] }),
  });
  const completeMutation = useMutation({
    mutationFn: () => api.patch(`/projects/${id}`, { status: 'COMPLETED' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', id] }),
  });
  const addBookingMutation = useMutation({
    mutationFn: (ids: string[]) => api.post(`/projects/${id}/bookings`, { booking_ids: ids }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project', id] }); setAddInput(''); },
  });
  const removeBookingMutation = useMutation({
    mutationFn: (bookingId: string) => api.delete(`/projects/${id}/bookings/${bookingId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', id] }),
  });

  if (isLoading) return <div className="text-center py-16 text-gray-400">Loading…</div>;
  if (!data) return <div className="text-center py-16 text-gray-400">Project not found</div>;

  const bookings: any[]  = data.bookings ?? [];
  const timeline: any[]  = data.timeline ?? [];
  const activeMarkers    = bookings.filter((b: any) => b.map_marker);

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{data.project_type?.replace(/_/g,' ')}</p>
            <h1 className="text-2xl font-bold text-gray-900">{data.project_name}</h1>
            {data.customer_name && <p className="text-sm text-gray-500 mt-1">Customer: <strong>{data.customer_name}</strong></p>}
            {(data.start_at || data.end_at) && (
              <p className="text-sm text-gray-500 mt-0.5">
                Period: {fmtDt(data.start_at)} – {fmtDt(data.end_at)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-semibold px-3 py-1 rounded-full ${STATUS_STYLE[data.status] ?? 'bg-gray-100 text-gray-500'}`}>
              {data.status}
            </span>
            {data.status === 'DRAFT' && (
              <button onClick={() => activateMutation.mutate()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                Activate
              </button>
            )}
            {data.status === 'ACTIVE' && (
              <button onClick={() => completeMutation.mutate()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                Mark Complete
              </button>
            )}
          </div>
        </div>
        {data.notes && (
          <div className="mt-4 bg-gray-50 rounded-lg px-4 py-2 text-sm text-gray-600 italic">{data.notes}</div>
        )}

        {/* Quick stats */}
        <div className="mt-4 flex gap-6 text-sm">
          <div><p className="text-gray-400 text-xs">Bookings</p><p className="font-bold text-lg">{bookings.length}</p></div>
          <div><p className="text-gray-400 text-xs">Active vehicles</p><p className="font-bold text-lg">{activeMarkers.length}</p></div>
          <div><p className="text-gray-400 text-xs">Timeline events</p><p className="font-bold text-lg">{timeline.length}</p></div>
        </div>
      </div>

      {/* Add booking */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
        <input className="flex-1 border rounded-lg px-3 py-2 text-sm" value={addInput}
          onChange={e => setAddInput(e.target.value)}
          placeholder="Paste booking ID(s) comma-separated to add to project" />
        <button
          onClick={() => {
            const ids = addInput.split(',').map(s => s.trim()).filter(Boolean);
            if (ids.length) addBookingMutation.mutate(ids);
          }}
          disabled={!addInput.trim() || addBookingMutation.isPending}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {addBookingMutation.isPending ? 'Adding…' : 'Add Booking(s)'}
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex border-b border-gray-100">
          {(['bookings','map','timeline'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors capitalize ${
                activeTab === tab ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500'
              }`}>
              {tab === 'bookings' ? `Bookings (${bookings.length})` :
               tab === 'map'      ? `Active Markers (${activeMarkers.length})` :
               `Timeline (${timeline.length})`}
            </button>
          ))}
        </div>

        {/* Bookings tab */}
        {activeTab === 'bookings' && (
          <div className="divide-y divide-gray-100">
            {bookings.length === 0 && (
              <div className="text-center py-12 text-gray-400">No bookings in this project yet</div>
            )}
            {bookings.map((b: any) => (
              <div key={b.id} className="px-6 py-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-gray-900">{b.booking_reference}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${BADGE_STYLE[b.badge?.color ?? 'gray']}`}>
                      {b.badge?.label ?? b.operational_status}
                    </span>
                    {b.badge?.trackingActive && (
                      <span className="text-xs text-blue-500 animate-pulse">● Live</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1 truncate">
                    {b.pickup_address_text} → {b.dropoff_address_text}
                  </p>
                  <div className="flex gap-4 mt-1.5 text-xs text-gray-400">
                    {b.pickup_at_utc && <span>{fmtDt(b.pickup_at_utc)}</span>}
                    {b.driver_name && <span>Driver: <strong className="text-gray-700">{b.driver_name}</strong></span>}
                    {b.vehicle_rego && <span>Rego: <strong className="text-gray-700">{b.vehicle_rego}</strong></span>}
                  </div>
                  {/* Map marker info when active */}
                  {b.map_marker && (
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className="text-blue-600">📍</span>
                      <a href={`https://maps.google.com/?q=${b.map_marker.lat},${b.map_marker.lng}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-blue-600 hover:underline font-mono">
                        {b.map_marker.lat.toFixed(5)}, {b.map_marker.lng.toFixed(5)}
                      </a>
                      <span className="text-gray-400">· {fmtDt(b.map_marker.recorded_at)}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Remove booking ${b.booking_reference} from project?`))
                      removeBookingMutation.mutate(b.id);
                  }}
                  className="text-xs text-red-400 hover:text-red-600 shrink-0"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Map tab */}
        {activeTab === 'map' && (
          <div className="px-6 py-6">
            {activeMarkers.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p className="text-2xl mb-2">🗺</p>
                <p className="font-semibold">No active vehicle positions</p>
                <p className="text-sm mt-1">Markers appear when drivers are on_the_way, arrived, or passenger_on_board.</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-4">{activeMarkers.length} active vehicle(s) with last known location:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeMarkers.map((b: any) => (
                    <div key={b.id} className="border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono font-bold text-gray-900">{b.booking_reference}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${BADGE_STYLE[b.badge?.color ?? 'gray']}`}>
                          {b.badge?.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{b.driver_name} · {b.vehicle_rego}</p>
                      <a href={`https://maps.google.com/?q=${b.map_marker.lat},${b.map_marker.lng}`}
                        target="_blank" rel="noopener noreferrer"
                        className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:underline">
                        📍 {b.map_marker.lat.toFixed(5)}, {b.map_marker.lng.toFixed(5)}
                      </a>
                      <p className="text-xs text-gray-400 mt-1">Last update: {fmtDt(b.map_marker.recorded_at)}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Timeline tab */}
        {activeTab === 'timeline' && (
          <div className="px-6 py-4">
            {timeline.length === 0 ? (
              <div className="text-center py-10 text-gray-400">No timeline events yet</div>
            ) : (
              <div className="space-y-2">
                {timeline.map((e: any, i: number) => (
                  <div key={i} className="flex items-start gap-4 text-sm">
                    <span className="text-xs text-gray-400 font-mono whitespace-nowrap w-36 shrink-0">{fmtDt(e.occurred_at)}</span>
                    <div>
                      <span className="font-semibold text-gray-800">{e.event_label ?? e.event_type}</span>
                      {e.booking_reference && <span className="ml-2 text-xs font-mono text-gray-500">{e.booking_reference}</span>}
                      {e.driver_name && <span className="ml-2 text-xs text-gray-400">· {e.driver_name}</span>}
                      {e.vehicle_rego && <span className="ml-2 text-xs text-gray-400">· {e.vehicle_rego}</span>}
                      {e.note && <p className="text-xs text-gray-400 mt-0.5 italic">{e.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
