'use client';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { ListPage } from '@/components/patterns/ListPage';

const EVENTS = [
  { key: 'BookingConfirmed', label: 'Booking Confirmed' },
  { key: 'DriverAcceptedAssignment', label: 'Driver Accepted' },
  { key: 'DriverInvitationSent', label: 'Driver Invitation' },
  { key: 'JobCompleted', label: 'Job Completed' },
  { key: 'BookingCancelled', label: 'Booking Cancelled' },
];

const VARIABLES = [
  'booking_reference',
  'customer_first_name',
  'customer_last_name',
  'pickup_address',
  'dropoff_address',
  'pickup_time',
  'driver_name',
  'vehicle_make',
  'vehicle_model',
  'total_amount',
  'currency',
];

interface TemplateRow {
  id: string;
  event_type: string;
  channel: string;
  subject: string | null;
  body: string;
  active: boolean;
}

export default function TemplatesPage() {
  const [selectedEvent, setSelectedEvent] = useState(EVENTS[0].key);
  const [channel, setChannel] = useState<'email' | 'sms'>('email');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState<{ subject?: string; body?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState<'subject' | 'body' | null>(null);

  const { data: templates = [], isLoading, refetch } = useQuery({
    queryKey: ['notification-templates'],
    queryFn: async () => {
      const res = await api.get('/notification-templates');
      return res.data ?? [];
    },
  });

  const currentTemplate = useMemo(() => {
    return (templates as TemplateRow[]).find(
      (t) => t.event_type === selectedEvent && t.channel === channel,
    );
  }, [templates, selectedEvent, channel]);

  async function loadTemplate() {
    const res = await api.get(`/notification-templates/${selectedEvent}/${channel}`);
    const data = res.data;
    setSubject(data?.subject ?? '');
    setBody(data?.body ?? '');
    setPreview(null);
  }

  useEffect(() => {
    loadTemplate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEvent, channel]);

  async function handleSave() {
    setSaving(true);
    await api.post('/notification-templates', {
      event_type: selectedEvent,
      channel,
      subject: subject || null,
      body,
    });
    await refetch();
    setSaving(false);
  }

  async function handleReset() {
    setSaving(true);
    await api.delete(`/notification-templates/${selectedEvent}/${channel}`);
    await refetch();
    await loadTemplate();
    setSaving(false);
  }

  async function handlePreview() {
    const res = await api.post('/notification-templates/preview', {
      channel,
      subject,
      body,
    });
    if (channel === 'sms') {
      setPreview({ body: res.data?.text_rendered ?? '' });
    } else {
      setPreview({ subject: res.data?.subject_rendered ?? '', body: res.data?.html_rendered ?? '' });
    }
  }

  function insertVar(variable: string) {
    const token = `{{${variable}}}`;
    if (focused === 'subject') {
      setSubject((prev) => `${prev}${token}`);
      return;
    }
    setBody((prev) => `${prev}${token}`);
  }

  return (
    <ListPage
      title="Templates"
      subtitle="Manage notification templates for your tenant"
      table={
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border rounded p-4 space-y-2">
            <div className="text-sm font-medium text-gray-700">Events</div>
            {EVENTS.map((e) => (
              <button
                key={e.key}
                onClick={async () => {
                  setSelectedEvent(e.key);
                  await loadTemplate();
                }}
                className={`w-full text-left px-3 py-2 rounded text-sm ${
                  selectedEvent === e.key ? 'bg-blue-600 text-white' : 'hover:bg-gray-50'
                }`}
              >
                {e.label}
              </button>
            ))}
          </div>

          <div className="lg:col-span-2 bg-white border rounded p-4 space-y-4">
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  setChannel('email');
                  await loadTemplate();
                }}
                className={`px-3 py-2 text-sm rounded ${
                  channel === 'email' ? 'bg-blue-600 text-white' : 'bg-gray-100'
                }`}
              >
                Email
              </button>
              <button
                onClick={async () => {
                  setChannel('sms');
                  await loadTemplate();
                }}
                className={`px-3 py-2 text-sm rounded ${
                  channel === 'sms' ? 'bg-blue-600 text-white' : 'bg-gray-100'
                }`}
              >
                SMS
              </button>
            </div>

            {isLoading ? (
              <div className="text-sm text-gray-500">Loading...</div>
            ) : (
              <div className="space-y-3">
                {channel === 'email' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                    <input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      onFocus={() => setFocused('subject')}
                      className="w-full border rounded px-3 py-2 text-sm"
                      placeholder="Booking confirmed for {{customer_first_name}}"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {channel === 'email' ? 'HTML Body' : 'SMS Text'}
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onFocus={() => setFocused('body')}
                    className="w-full border rounded px-3 py-2 text-sm h-48"
                  />
                  {channel === 'sms' && (
                    <div className="text-xs text-gray-500 mt-1">{body.length}/160</div>
                  )}
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Variables</div>
                  <div className="flex flex-wrap gap-2">
                    {VARIABLES.map((v) => (
                      <button
                        key={v}
                        onClick={() => insertVar(v)}
                        className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
                      >
                        {`{{${v}}}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handlePreview}
                    className="px-3 py-2 text-sm rounded bg-gray-100 hover:bg-gray-200"
                  >
                    Preview
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-3 py-2 text-sm rounded bg-blue-600 text-white disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={handleReset}
                    disabled={saving}
                    className="px-3 py-2 text-sm rounded bg-red-600 text-white disabled:opacity-60"
                  >
                    Reset to Default
                  </button>
                </div>

                {preview && (
                  <div className="border rounded p-3 bg-gray-50 text-sm">
                    {preview.subject && (
                      <div className="mb-2">
                        <div className="text-xs text-gray-500">Subject</div>
                        <div className="font-medium">{preview.subject}</div>
                      </div>
                    )}
                    <div className="text-xs text-gray-500">Preview</div>
                    <div className="whitespace-pre-wrap">{preview.body}</div>
                  </div>
                )}

                {currentTemplate && (
                  <div className="text-xs text-gray-500">Loaded custom template</div>
                )}
              </div>
            )}
          </div>
        </div>
      }
    />
  );
}
