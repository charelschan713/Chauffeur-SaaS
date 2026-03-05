'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface NotificationLog {
  id: string;
  event_type: string;
  channel: 'email' | 'sms';
  recipient_type?: string;
  recipient_email?: string;
  recipient_phone?: string;
  subject?: string;
  body?: string;
  status: 'SENT' | 'FAILED' | 'BOUNCED';
  sent_at: string;
  booking_id?: string;
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'SENT' ? 'bg-green-100 text-green-700' :
    status === 'FAILED' ? 'bg-red-100 text-red-700' :
    'bg-yellow-100 text-yellow-700';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{status}</span>;
}

function ChannelBadge({ channel }: { channel: string }) {
  const cls = channel === 'email' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{channel}</span>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function NotificationLogsPage() {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedLog, setExpandedLog] = useState<NotificationLog | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/notification-templates/notification-logs')
      .then(r => setLogs(r.data ?? []))
      .catch(e => setError(e?.response?.data?.message ?? 'Failed to load logs'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = logs.filter(l => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      l.event_type?.toLowerCase().includes(q) ||
      l.booking_id?.toLowerCase().includes(q) ||
      l.recipient_email?.toLowerCase().includes(q) ||
      l.recipient_phone?.includes(q)
    );
  });

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedLog(null);
      return;
    }
    setExpandedId(id);
    setLoadingDetail(true);
    try {
      const r = await api.get(`/notification-templates/notification-logs/${id}`);
      setExpandedLog(r.data);
    } catch {
      setExpandedLog(logs.find(l => l.id === id) ?? null);
    } finally {
      setLoadingDetail(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Notification Logs</h1>
        <p className="text-sm text-gray-500 mt-1">Last 100 sent notifications</p>
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search by event type, booking ID or recipient…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No notification logs found.</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Event</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Ch.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Recipient</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Sent At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(log => (
                <>
                  <tr
                    key={log.id}
                    onClick={() => toggleExpand(log.id)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{log.event_type}</div>
                      {log.subject && <div className="text-xs text-gray-400 truncate max-w-xs">{log.subject}</div>}
                    </td>
                    <td className="px-4 py-3"><ChannelBadge channel={log.channel} /></td>
                    <td className="px-4 py-3 text-gray-600">
                      {log.recipient_email ?? log.recipient_phone ?? '—'}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={log.status} /></td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(log.sent_at)}</td>
                  </tr>
                  {expandedId === log.id && (
                    <tr key={`${log.id}-expanded`}>
                      <td colSpan={5} className="px-4 py-4 bg-gray-50 border-b border-gray-200">
                        {loadingDetail ? (
                          <div className="flex justify-center py-4">
                            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : expandedLog ? (
                          <div className="space-y-3">
                            <div className="flex gap-4 text-xs text-gray-500">
                              {expandedLog.booking_id && <span>Booking: <code className="font-mono">{expandedLog.booking_id}</code></span>}
                              <span>ID: <code className="font-mono">{expandedLog.id}</code></span>
                            </div>
                            {expandedLog.body ? (
                              expandedLog.channel === 'email' ? (
                                <iframe
                                  srcDoc={expandedLog.body}
                                  sandbox=""
                                  className="w-full h-64 border border-gray-200 rounded-lg bg-white"
                                  title="Email preview"
                                />
                              ) : (
                                <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-white border border-gray-200 rounded-lg p-3">
                                  {expandedLog.body}
                                </pre>
                              )
                            ) : (
                              <p className="text-xs text-gray-400">No body content available.</p>
                            )}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
