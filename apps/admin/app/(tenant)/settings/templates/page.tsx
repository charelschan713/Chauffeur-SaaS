'use client';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { ListPage } from '@/components/patterns/ListPage';
import {PageLoader, InlineSpinner} from '@/components/ui/LoadingSpinner';

const EVENT_GROUPS = [
  {
    group: '👤 Customer',
    events: [
      { key: 'CustomerRegistered',        label: 'Registration Success',       email: true,  sms: true  },
      { key: 'CustomerForgotPassword',    label: 'Forgot Password',            email: true,  sms: true  },
      { key: 'CustomerOtp',               label: 'OTP Verification',           email: false, sms: true  },
      { key: 'BookingConfirmed',          label: 'Booking Confirmed',          email: true,  sms: true  },
      { key: 'DriverAcceptedAssignment',  label: 'Driver Assigned',            email: true,  sms: true  },
      { key: 'DriverInvitationSent',      label: 'Driver En Route',            email: true,  sms: true  },
      { key: 'TripStarted',               label: 'Trip Started',               email: false, sms: true  },
      { key: 'JobCompleted',              label: 'Trip Completed',             email: true,  sms: true  },
      { key: 'BookingCancelled',          label: 'Booking Cancelled (Customer)',email: true, sms: true  },
      { key: 'BookingCancelledByAdmin',   label: 'Booking Cancelled (Admin)',  email: true,  sms: true  },
      { key: 'JobFulfilledWithExtras',    label: 'Extra Charge Applied',       email: true,  sms: true  },
      { key: 'RefundIssued',              label: 'Refund Issued',              email: true,  sms: true  },
      { key: 'InvoiceSent',               label: 'Invoice Sent',               email: true,  sms: true  },
      { key: 'InvoiceOverdue',            label: 'Invoice Overdue',            email: true,  sms: true  },
      { key: 'PaymentSuccess',            label: 'Payment Success',            email: true,  sms: true  },
      { key: 'PaymentFailed',             label: 'Payment Failed',             email: true,  sms: true  },
      { key: 'PaymentRequest',            label: 'Payment Request',            email: true,  sms: false },
    ],
  },
  {
    group: '🚗 Driver',
    events: [
      { key: 'DriverNewDispatch',         label: 'New Job Dispatched',         email: true,  sms: true  },
      { key: 'DriverAcceptedAssignment',  label: 'Acceptance Confirmed',       email: true,  sms: true  },
      { key: 'DriverRejectedAssignment',  label: 'Rejection Recorded',         email: false, sms: true  },
      { key: 'AssignmentCancelled',       label: 'Job Cancelled',              email: true,  sms: true  },
      { key: 'DriverPayUpdated',          label: 'Pay Updated',                email: true,  sms: true  },
      { key: 'DriverDocExpiry30',         label: 'Document Expiry (30 days)',  email: true,  sms: true  },
      { key: 'DriverDocExpiry7',          label: 'Document Expiry (7 days)',   email: true,  sms: true  },
      { key: 'DriverAccountSuspended',    label: 'Account Suspended',          email: true,  sms: true  },
      { key: 'DriverDocApproved',         label: 'Document Approved',          email: true,  sms: true  },
      { key: 'DriverDocRejected',         label: 'Document Rejected',          email: true,  sms: true  },
    ],
  },
  {
    group: '🏢 Admin',
    events: [
      { key: 'AdminNewBooking',           label: 'New Booking (Widget)',       email: true,  sms: true  },
      { key: 'AdminBookingPendingConfirm',label: 'Booking Pending Confirm',    email: true,  sms: true  },
      { key: 'AdminDriverRejected',       label: 'Driver Rejected Job',        email: true,  sms: true  },
      { key: 'AdminPartnerRejected',      label: 'Partner Rejected Transfer',  email: true,  sms: true  },
      { key: 'AdminTransferRequest',      label: 'Incoming Transfer Request',  email: true,  sms: true  },
      { key: 'AdminPartnerAccepted',      label: 'Partner Accepted Transfer',  email: true,  sms: true  },
      { key: 'AdminCollabRequest',        label: 'Collab Request Received',    email: true,  sms: true  },
      { key: 'AdminCollabApproved',       label: 'Collab Request Approved',    email: true,  sms: true  },
      { key: 'AdminDriverReview',         label: 'Driver Review Result',       email: true,  sms: true  },
      { key: 'AdminInvoicePaid',          label: 'Invoice Payment Received',   email: true,  sms: true  },
      { key: 'AdminPaymentFailed',        label: 'Payment Failed (Admin)',     email: true,  sms: true  },
      { key: 'AdminSettlement',           label: 'Settlement Completed',       email: true,  sms: true  },
    ],
  },
  {
    group: '⭐ Super Admin',
    events: [
      { key: 'SuperAdminDriverReview',    label: 'New Driver Review Request',  email: true,  sms: true  },
      { key: 'SuperAdminCollabReview',    label: 'New Collab Review Request',  email: true,  sms: true  },
      { key: 'SuperAdminNewTenant',       label: 'New Tenant Registered',      email: true,  sms: true  },
    ],
  },
];

// Flatten for backward-compat
const EVENTS = EVENT_GROUPS.flatMap(g => g.events);

const VARIABLES = [
  'booking_reference', 'customer_name', 'pickup_address', 'dropoff_address',
  'pickup_time', 'driver_name', 'vehicle_make', 'vehicle_model', 'total_price',
  'otp', 'reset_link', 'refund_amount', 'invoice_number', 'amount', 'due_date',
  'invoice_url', 'card_last4', 'payment_link', 'doc_type', 'expiry_date',
  'days_remaining', 'reject_reason', 'driver_pay', 'partner_name',
  'source_tenant', 'transfer_price', 'tenant_name', 'review_status', 'settlement_result',
];

interface TemplateRow {
  id: string;
  event_type: string;
  channel: string;
  subject: string | null;
  body: string;
  active: boolean;
  recipients: string[];
}

type TemplateState = {
  subject: string;
  body: string;
};

const RECIPIENT_OPTIONS = [
  { value: 'customer', label: 'Customer' },
  { value: 'driver',   label: 'Driver'   },
  { value: 'admin',    label: 'Admin'    },
];

type PreviewState = {
  subject?: string;
  body?: string;
};

export default function TemplatesPage() {
  const [templatesState, setTemplatesState] = useState<Record<string, TemplateState>>({});
  const [previewState, setPreviewState] = useState<Record<string, PreviewState>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [defaults, setDefaults] = useState<Record<string, any>>({});
  const [sources, setSources] = useState<Record<string, 'TENANT' | 'PLATFORM'>>({});
  // Per-event (not per-channel) settings: active + recipients
  const [eventActive, setEventActive] = useState<Record<string, boolean>>({});
  const [eventRecipients, setEventRecipients] = useState<Record<string, string[]>>({});

  const { data: templates = [], isLoading, refetch } = useQuery({
    queryKey: ['notification-templates'],
    queryFn: async () => {
      const res = await api.get('/notification-templates');
      return res.data ?? [];
    },
  });

  useEffect(() => {
    (async () => {
      const res = await api.get('/notification-templates/defaults');
      setDefaults(res.data ?? {});
    })();
  }, []);

  useEffect(() => {
    if (!templates?.length) return;
    setTemplatesState((prev) => {
      const next = { ...prev };
      (templates as TemplateRow[]).forEach((t) => {
        const key = `${t.event_type}:${t.channel}`;
        if (!next[key]) {
          next[key] = { subject: t.subject ?? '', body: t.body ?? '' };
        }
      });
      return next;
    });
    // Seed active + recipients from the email channel row (authoritative)
    setEventActive((prev) => {
      const next = { ...prev };
      (templates as TemplateRow[]).forEach((t) => {
        if (t.channel === 'email' && !(t.event_type in next)) {
          next[t.event_type] = t.active ?? true;
        }
      });
      return next;
    });
    setEventRecipients((prev) => {
      const next = { ...prev };
      (templates as TemplateRow[]).forEach((t) => {
        if (t.channel === 'email' && !(t.event_type in next)) {
          next[t.event_type] = Array.isArray(t.recipients) ? t.recipients : ['customer'];
        }
      });
      return next;
    });
  }, [templates]);

  function keyFor(eventType: string, channel: 'email' | 'sms') {
    return `${eventType}:${channel}`;
  }

  function getState(eventType: string, channel: 'email' | 'sms') {
    const key = keyFor(eventType, channel);
    return templatesState[key] ?? { subject: '', body: '' };
  }

  function updateState(eventType: string, channel: 'email' | 'sms', patch: Partial<TemplateState>) {
    const key = keyFor(eventType, channel);
    setTemplatesState((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? { subject: '', body: '' }), ...patch },
    }));
  }

  function getDefault(eventType: string, channel: 'email' | 'sms') {
    return defaults?.[eventType]?.[channel] ?? null;
  }

  async function loadTemplate(eventType: string, channel: 'email' | 'sms') {
    const res = await api.get(`/notification-templates/${eventType}/${channel}`);
    const data = res.data ?? {};
    updateState(eventType, channel, { subject: data.subject ?? '', body: data.body ?? '' });
  }

  async function handleSave(eventType: string, channel: 'email' | 'sms') {
    const state = getState(eventType, channel);
    const key = keyFor(eventType, channel);
    setSavingKey(key);
    await api.post('/notification-templates', {
      event_type: eventType,
      channel,
      subject: channel === 'email' ? (state.subject || null) : null,
      body: state.body,
    });
    await refetch();
    setSources((prev) => ({ ...prev, [key]: 'TENANT' }));
    setSavingKey(null);
  }

  async function handlePreview(eventType: string, channel: 'email' | 'sms') {
    const state = getState(eventType, channel);
    const res = await api.post('/notification-templates/preview', {
      channel,
      subject: state.subject,
      body: state.body,
    });
    const key = keyFor(eventType, channel);
    if (channel === 'sms') {
      setPreviewState((prev) => ({ ...prev, [key]: { body: res.data?.text_rendered ?? '' } }));
    } else {
      setPreviewState((prev) => ({
        ...prev,
        [key]: {
          subject: res.data?.subject_rendered ?? '',
          body: res.data?.html_rendered ?? '',
        },
      }));
    }
  }

  function handleUseDefault(eventType: string, channel: 'email' | 'sms') {
    const def = getDefault(eventType, channel);
    if (!def) return;
    updateState(eventType, channel, {
      subject: def.subject ?? '',
      body: def.body ?? '',
    });
    const key = keyFor(eventType, channel);
    setSources((prev) => ({ ...prev, [key]: 'PLATFORM' }));
  }

  async function handleReset(eventType: string, channel: 'email' | 'sms') {
    const key = keyFor(eventType, channel);
    setSavingKey(key);
    await api.delete(`/notification-templates/${eventType}/${channel}`);
    await loadTemplate(eventType, channel);
    setPreviewState((prev) => ({ ...prev, [key]: {} }));
    setSources((prev) => ({ ...prev, [key]: 'PLATFORM' }));
    setSavingKey(null);
  }

  async function handleToggleActive(eventType: string) {
    const newVal = !eventActive[eventType];
    setEventActive((prev) => ({ ...prev, [eventType]: newVal }));
    // Update both channels
    for (const ch of ['email', 'sms'] as const) {
      await api.patch(`/notification-templates/${eventType}/${ch}`, { active: newVal }).catch(() => {});
    }
  }

  async function handleSaveRecipients(eventType: string, newRecipients: string[]) {
    setEventRecipients((prev) => ({ ...prev, [eventType]: newRecipients }));
    for (const ch of ['email', 'sms'] as const) {
      await api.patch(`/notification-templates/${eventType}/${ch}`, { recipients: newRecipients }).catch(() => {});
    }
  }

  function toggleRecipient(eventType: string, role: string) {
    const current = eventRecipients[eventType] ?? ['customer'];
    const next = current.includes(role)
      ? current.filter((r) => r !== role)
      : [...current, role];
    handleSaveRecipients(eventType, next);
  }

  useEffect(() => {
    setSources((prev) => {
      const next = { ...prev };
      EVENTS.forEach((event) => {
        ['email', 'sms'].forEach((channel) => {
          const key = keyFor(event.key, channel as 'email' | 'sms');
          const hasTenant = (templates as TemplateRow[]).some(
            (t) => t.event_type === event.key && t.channel === channel,
          );
          if (!next[key]) {
            next[key] = hasTenant ? 'TENANT' : 'PLATFORM';
          }
        });
      });
      return next;
    });
  }, [templates]);

  const variableTokens = useMemo(() => VARIABLES.map((v) => `{{${v}}}`), []);

  return (
    <ListPage
      title="Templates"
      subtitle="Manage notification templates for your tenant"
      table={
        <div className="space-y-6">
          {isLoading && <div className="text-sm text-gray-500">Loading...</div>}
          {EVENT_GROUPS.map((group) => (
            <div key={group.group}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 mt-2">{group.group}</h3>
              <div className="space-y-4">
          {group.events.map((event) => (
            <div key={event.key} className={`bg-white border rounded p-4 space-y-4 ${eventActive[event.key] === false ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  {/* Active toggle */}
                  <button
                    onClick={() => handleToggleActive(event.key)}
                    title={eventActive[event.key] === false ? 'Enable event' : 'Disable event'}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                      eventActive[event.key] === false ? 'bg-gray-300' : 'bg-green-500'
                    }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                      eventActive[event.key] === false ? 'translate-x-0.5' : 'translate-x-4'
                    }`} />
                  </button>
                  <div className="text-sm font-semibold text-gray-800">{event.label}</div>
                  {eventActive[event.key] === false && (
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Disabled</span>
                  )}
                </div>
                {/* Recipients */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide">Notify:</span>
                  {RECIPIENT_OPTIONS.map((opt) => {
                    const checked = (eventRecipients[event.key] ?? ['customer']).includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        onClick={() => toggleRecipient(event.key, opt.value)}
                        className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                          checked
                            ? 'bg-indigo-50 border-indigo-400 text-indigo-700 font-medium'
                            : 'bg-gray-50 border-gray-200 text-gray-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="border rounded p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-gray-700">Email</div>
                    <span className={`text-[10px] px-2 py-1 rounded ${
                      sources[keyFor(event.key, 'email')] === 'TENANT'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {sources[keyFor(event.key, 'email')] === 'TENANT' ? 'Custom' : 'Platform Default'}
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
                    <input
                      value={getState(event.key, 'email').subject}
                      onChange={(e) => updateState(event.key, 'email', { subject: e.target.value })}
                      className="w-full border rounded px-3 py-2 text-sm"
                      placeholder="Subject"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Body</label>
                    <textarea
                      value={getState(event.key, 'email').body}
                      onChange={(e) => updateState(event.key, 'email', { body: e.target.value })}
                      className="w-full border rounded px-3 py-2 text-sm h-40"
                    />
                  </div>
                  <div className="text-xs text-gray-500">
                    Variables: {variableTokens.join(' ')}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePreview(event.key, 'email')}
                      className="px-3 py-2 text-xs rounded bg-gray-100 hover:bg-gray-200"
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => handleSave(event.key, 'email')}
                      disabled={savingKey === keyFor(event.key, 'email')}
                      className="px-3 py-2 text-xs rounded bg-blue-600 text-white disabled:opacity-60"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => handleUseDefault(event.key, 'email')}
                      className="px-3 py-2 text-xs rounded bg-gray-100 hover:bg-gray-200"
                    >
                      Use Default
                    </button>
                    <button
                      onClick={() => handleReset(event.key, 'email')}
                      disabled={savingKey === keyFor(event.key, 'email')}
                      className="px-3 py-2 text-xs rounded bg-red-600 text-white disabled:opacity-60"
                    >
                      Reset to Default
                    </button>
                  </div>
                  {previewState[keyFor(event.key, 'email')]?.body && (
                    <div className="border rounded p-3 bg-gray-50 text-xs">
                      {previewState[keyFor(event.key, 'email')]?.subject && (
                        <div className="mb-2">
                          <div className="text-[10px] text-gray-500">Subject</div>
                          <div className="font-medium">{previewState[keyFor(event.key, 'email')]?.subject}</div>
                        </div>
                      )}
                      <div className="text-[10px] text-gray-500">Preview</div>
                      <iframe
                        srcDoc={previewState[keyFor(event.key, 'email')]?.body}
                        sandbox=""
                        className="w-full rounded border bg-white"
                        style={{ minHeight: 320, height: 400 }}
                        title="Email preview"
                      />
                    </div>
                  )}
                </div>

                <div className="border rounded p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-gray-700">SMS</div>
                    <span className={`text-[10px] px-2 py-1 rounded ${
                      sources[keyFor(event.key, 'sms')] === 'TENANT'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {sources[keyFor(event.key, 'sms')] === 'TENANT' ? 'Custom' : 'Platform Default'}
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Body</label>
                    <textarea
                      value={getState(event.key, 'sms').body}
                      onChange={(e) => updateState(event.key, 'sms', { body: e.target.value })}
                      className="w-full border rounded px-3 py-2 text-sm h-40"
                    />
                  </div>
                  <div className="text-xs text-gray-500">
                    Variables: {variableTokens.join(' ')}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePreview(event.key, 'sms')}
                      className="px-3 py-2 text-xs rounded bg-gray-100 hover:bg-gray-200"
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => handleSave(event.key, 'sms')}
                      disabled={savingKey === keyFor(event.key, 'sms')}
                      className="px-3 py-2 text-xs rounded bg-blue-600 text-white disabled:opacity-60"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => handleUseDefault(event.key, 'sms')}
                      className="px-3 py-2 text-xs rounded bg-gray-100 hover:bg-gray-200"
                    >
                      Use Default
                    </button>
                    <button
                      onClick={() => handleReset(event.key, 'sms')}
                      disabled={savingKey === keyFor(event.key, 'sms')}
                      className="px-3 py-2 text-xs rounded bg-red-600 text-white disabled:opacity-60"
                    >
                      Reset to Default
                    </button>
                  </div>
                  {previewState[keyFor(event.key, 'sms')]?.body && (
                    <div className="border rounded p-3 bg-gray-50 text-xs">
                      <div className="text-[10px] text-gray-500">Preview</div>
                      <div className="whitespace-pre-wrap">{previewState[keyFor(event.key, 'sms')]?.body}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
              </div>
            </div>
          ))}
        </div>
      }
    />
  );
}
