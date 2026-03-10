'use client';
/**
 * TripEvidencePanel — Admin booking detail evidence section
 *
 * Shows:
 *   - Evidence status + freeze timestamp (frozen = finalized at FULFILLED)
 *   - GPS milestones table
 *   - Route map image
 *   - SMS transcript
 *   - Operation log timeline
 *   - Download audit report (PDF)
 *
 * Evidence becomes read-only (frozen) when booking reaches FULFILLED.
 * This component is embeddable in any admin booking detail page.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

const MILESTONE_LABEL: Record<string, string> = {
  on_the_way: 'Departed',
  arrived:    'Arrived at Pickup',
  pob:        'Passenger On Board',
  job_done:   'Job Done',
  trace:      'Route Trace',
};
const MILESTONE_COLOR: Record<string, string> = {
  on_the_way: 'bg-blue-100 text-blue-700',
  arrived:    'bg-yellow-100 text-yellow-700',
  pob:        'bg-green-100 text-green-700',
  job_done:   'bg-red-100 text-red-700',
  trace:      'bg-gray-100 text-gray-500',
};

function fmtDt(dt: string | null) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney', day: '2-digit', month: 'short',
    year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

export function TripEvidencePanel({ bookingId, tenantId }: { bookingId: string; tenantId?: string }) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'milestones' | 'sms' | 'log'>('milestones');
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['trip-evidence', bookingId],
    queryFn: async () => (await api.get(`/admin/bookings/${bookingId}/evidence`)).data,
    enabled: !!bookingId && expanded,
  });

  const regenerateMutation = useMutation({
    mutationFn: () => api.post(`/admin/bookings/${bookingId}/evidence/route-image`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trip-evidence', bookingId] }),
  });

  const record     = data?.record;
  const milestones: any[] = data?.milestones ?? [];
  const transcript: any[] = data?.transcript ?? [];
  const opLog: any[]      = data?.operation_log ?? [];
  const summary           = data?.summary;

  const isFrozen = record?.evidence_status === 'frozen';

  const TABS = [
    { id: 'milestones', label: `GPS (${milestones.length})` },
    { id: 'sms',        label: `SMS (${transcript.length})` },
    { id: 'log',        label: `Log (${opLog.length})` },
  ] as const;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header row — always visible */}
      <div
        className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <p className="text-sm font-semibold text-gray-900">Trip Evidence</p>
          {!expanded && (
            <p className="text-xs text-gray-400 mt-0.5">
              {summary ? (
                <>
                  {summary.is_frozen && <span className="text-emerald-600 font-medium">✓ Frozen · </span>}
                  GPS {summary.milestone_types.join(', ')||'none'} · {summary.message_count} SMS
                  {summary.has_route_image && ' · Route map ✓'}
                </>
              ) : 'Click to load evidence'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isFrozen && (
            <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
              FROZEN
            </span>
          )}
          {!expanded && !data && (
            <span className="text-xs text-gray-400">Evidence available</span>
          )}
          <span className="text-gray-400 text-sm">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100">
          {isLoading && (
            <div className="text-center py-10 text-gray-400 text-sm">Loading evidence…</div>
          )}

          {!isLoading && !record && (
            <div className="px-5 py-8 text-center">
              <p className="text-2xl mb-2">📡</p>
              <p className="text-sm font-semibold text-gray-600">No evidence recorded yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Evidence collection starts when driver sets status to on_the_way.
              </p>
            </div>
          )}

          {!isLoading && record && (
            <div className="space-y-0">
              {/* Evidence metadata */}
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex flex-wrap gap-4 text-xs text-gray-500">
                <span>Bridge opened: <strong>{fmtDt(record.sms_bridge_opened_at)}</strong></span>
                <span>Bridge closed: <strong>{fmtDt(record.sms_bridge_closed_at)}</strong></span>
                {record.evidence_frozen_at && (
                  <span className="text-emerald-700">
                    Frozen: <strong>{fmtDt(record.evidence_frozen_at)}</strong>
                  </span>
                )}
                {record.twilio_proxy_number && (
                  <span>Proxy: <strong>{record.twilio_proxy_number}</strong></span>
                )}
              </div>

              {/* Route image */}
              {record.route_image_url && (
                <div className="px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-700">Route Map</p>
                    {!isFrozen && (
                      <button
                        onClick={() => regenerateMutation.mutate()}
                        disabled={regenerateMutation.isPending}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {regenerateMutation.isPending ? 'Regenerating…' : 'Regenerate'}
                      </button>
                    )}
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={record.route_image_url}
                    alt="Trip route map"
                    className="rounded-lg w-full max-w-lg border border-gray-200"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    S=Departed · A=Arrived · P=Passenger On Board · E=Job Done
                  </p>
                </div>
              )}

              {!record.route_image_url && !isFrozen && (
                <div className="px-5 py-3 border-b border-gray-100">
                  <button
                    onClick={() => regenerateMutation.mutate()}
                    disabled={regenerateMutation.isPending}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {regenerateMutation.isPending ? 'Generating route image…' : '🗺 Generate Route Image'}
                  </button>
                </div>
              )}

              {/* Tabs */}
              <div className="flex border-b border-gray-100">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-5 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-600 text-blue-700'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
                <div className="flex-1" />
                <a
                  href={`/api-proxy/admin/bookings/${bookingId}/evidence/audit-report`}
                  target="_blank"
                  className="px-4 py-2 text-xs text-gray-500 hover:text-blue-600 font-medium self-center"
                >
                  📄 Audit Report PDF
                </a>
              </div>

              {/* GPS milestones tab */}
              {activeTab === 'milestones' && (
                <div className="px-5 py-4">
                  {milestones.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No GPS milestones recorded</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          {['Milestone','Coordinates','Accuracy','Recorded At'].map(h => (
                            <th key={h} className="text-left text-xs text-gray-400 font-semibold pb-2 pr-4 uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {milestones.map((m: any) => (
                          <tr key={m.id}>
                            <td className="py-2 pr-4">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${MILESTONE_COLOR[m.milestone_type] ?? 'bg-gray-100 text-gray-500'}`}>
                                {MILESTONE_LABEL[m.milestone_type] ?? m.milestone_type}
                              </span>
                            </td>
                            <td className="py-2 pr-4 font-mono text-xs text-gray-700">
                              <a
                                href={`https://maps.google.com/?q=${m.latitude},${m.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-blue-600"
                              >
                                {parseFloat(m.latitude).toFixed(6)}, {parseFloat(m.longitude).toFixed(6)}
                              </a>
                            </td>
                            <td className="py-2 pr-4 text-gray-400 text-xs">
                              {m.accuracy_meters ? `${m.accuracy_meters}m` : '—'}
                            </td>
                            <td className="py-2 text-gray-500 text-xs">{fmtDt(m.recorded_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* SMS transcript tab */}
              {activeTab === 'sms' && (
                <div className="px-5 py-4 space-y-3">
                  {transcript.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No SMS messages recorded</p>
                  ) : (
                    transcript.map((msg: any) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-md rounded-xl px-4 py-2.5 ${
                            msg.direction === 'outbound'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          <p className="text-xs opacity-60 mb-0.5">
                            {msg.direction === 'outbound' ? '→ Driver → Passenger' : '← Passenger → Driver'}
                            {' · '}{fmtDt(msg.sent_at)}
                            {msg.delivery_status !== 'sent' && msg.delivery_status !== 'received' && (
                              <span className="ml-1 text-yellow-300">({msg.delivery_status})</span>
                            )}
                          </p>
                          <p className="text-sm">{msg.body}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Operation log tab */}
              {activeTab === 'log' && (
                <div className="px-5 py-4">
                  {opLog.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No operation log entries</p>
                  ) : (
                    <div className="space-y-1">
                      {opLog.map((entry: any) => (
                        <div key={entry.id} className="flex items-baseline gap-3 text-xs">
                          <span className="text-gray-400 whitespace-nowrap font-mono">{fmtDt(entry.occurred_at)}</span>
                          <span className="font-semibold text-gray-700">{entry.event_type}</span>
                          <span className="text-gray-400">actor: {entry.actor ?? 'system'}</span>
                          {entry.metadata && (
                            <span className="text-gray-400 truncate max-w-xs">
                              {JSON.stringify(entry.metadata)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {isFrozen && (
                <div className="px-5 py-3 bg-emerald-50 border-t border-emerald-100">
                  <p className="text-xs text-emerald-700 font-medium">
                    ✓ Evidence frozen at FULFILLED — {fmtDt(record.evidence_frozen_at)}. All data is read-only and represents the final trip record.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
