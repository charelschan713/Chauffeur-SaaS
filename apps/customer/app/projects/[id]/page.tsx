'use client';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  ACTIVE:    'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
  DRAFT:     'bg-gray-100 text-gray-500',
};

const fmtDt = (dt: string | null) => dt ? new Date(dt).toLocaleString('en-AU', {
  timeZone: 'Australia/Sydney', day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false,
}) : '—';

export default function CustomerProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<'bookings' | 'timeline'>('bookings');

  const { data, isLoading } = useQuery({
    queryKey: ['customer-project', id],
    queryFn: async () => (await api.get(`/customer-portal/projects/${id}`)).data,
    enabled: !!id,
    refetchInterval: 30000, // Refresh every 30s for live status
  });

  if (isLoading) return <div className="flex items-center justify-center py-24 text-gray-400">Loading…</div>;
  if (!data) return <div className="text-center py-16 text-gray-400">Project not found</div>;

  const bookings: any[]    = data.bookings ?? [];
  const timeline: any[]    = data.timeline ?? [];
  const activeBookings     = bookings.filter((b: any) => b.badge?.trackingActive);

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-5">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">{data.project_type?.replace(/_/g,' ')}</p>
            <h1 className="text-xl font-bold text-gray-900 mt-0.5">{data.project_name}</h1>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[data.status] ?? 'bg-gray-100 text-gray-500'}`}>
            {data.status}
          </span>
        </div>

        {(data.start_at || data.end_at) && (
          <p className="text-sm text-gray-500">
            {fmtDt(data.start_at)}{data.end_at ? ` – ${fmtDt(data.end_at)}` : ''}
          </p>
        )}

        <div className="mt-4 flex gap-5 text-sm">
          <div><p className="text-gray-400 text-xs">Vehicles</p><p className="font-bold text-base">{bookings.length}</p></div>
          <div>
            <p className="text-gray-400 text-xs">Active now</p>
            <p className="font-bold text-base text-blue-700">{activeBookings.length}</p>
          </div>
        </div>

        {/* Active vehicle live indicators */}
        {activeBookings.length > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <p className="text-sm text-blue-700 font-medium">{activeBookings.length} vehicle{activeBookings.length > 1 ? 's' : ''} currently active · auto-refreshing</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="flex border-b border-gray-100">
          {(['bookings','timeline'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors capitalize ${
                tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500'
              }`}>
              {t === 'bookings' ? `Vehicles (${bookings.length})` : `Timeline (${timeline.length})`}
            </button>
          ))}
        </div>

        {/* Vehicles / bookings */}
        {tab === 'bookings' && (
          <div className="divide-y divide-gray-100">
            {bookings.length === 0 && (
              <div className="text-center py-12 text-gray-400">No vehicles in this project</div>
            )}
            {bookings.map((b: any) => (
              <div key={b.id} className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-gray-800">{b.booking_reference}</span>
                    {b.badge?.trackingActive && (
                      <span className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
                        Live
                      </span>
                    )}
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${BADGE_STYLE[b.badge?.color ?? 'gray']}`}>
                    {b.badge?.label ?? b.operational_status}
                  </span>
                </div>

                {/* Route */}
                <p className="text-sm text-gray-500 truncate">
                  {b.pickup_address_text}
                </p>
                <p className="text-xs text-gray-400 truncate">→ {b.dropoff_address_text}</p>

                {/* Driver + vehicle */}
                {(b.driver_name || b.vehicle_rego) && (
                  <div className="mt-2 flex gap-4 text-sm text-gray-600">
                    {b.driver_name  && <span>🧑‍✈️ {b.driver_name}</span>}
                    {b.vehicle_rego && <span>🚗 {b.vehicle_rego}{b.vehicle_make ? ` (${b.vehicle_make} ${b.vehicle_model ?? ''})` : ''}</span>}
                  </div>
                )}

                {/* Live location */}
                {b.map_marker && (
                  <div className="mt-2 bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-700">
                    <span className="font-semibold">Current position: </span>
                    <a href={`https://maps.google.com/?q=${b.map_marker.lat},${b.map_marker.lng}`}
                      target="_blank" rel="noopener noreferrer"
                      className="underline">
                      View on map
                    </a>
                    <span className="text-blue-500 ml-2">· Updated {fmtDt(b.map_marker.recorded_at)}</span>
                  </div>
                )}

                {b.pickup_at_utc && (
                  <p className="mt-1 text-xs text-gray-400">Service time: {fmtDt(b.pickup_at_utc)}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Timeline */}
        {tab === 'timeline' && (
          <div className="px-5 py-4 space-y-3">
            {timeline.length === 0 && (
              <div className="text-center py-10 text-gray-400">No events recorded yet</div>
            )}
            {timeline.map((e: any, i: number) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-gray-300 mt-1.5 shrink-0" />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">{e.event_label ?? e.event_type}</span>
                    {e.booking_reference && (
                      <span className="text-xs font-mono text-gray-500">{e.booking_reference}</span>
                    )}
                    {e.driver_name && <span className="text-xs text-gray-400">· {e.driver_name}</span>}
                    {e.vehicle_rego && <span className="text-xs text-gray-400">· {e.vehicle_rego}</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{fmtDt(e.occurred_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
