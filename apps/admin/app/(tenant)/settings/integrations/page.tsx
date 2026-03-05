'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Toast } from '@/components/ui/Toast';
import {PageLoader, InlineSpinner} from '@/components/ui/LoadingSpinner';

interface IntegrationRow {
  type: string;
  active: boolean;
  masked_preview: string | null;
}

type IntegrationField = {
  key: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
};

type IntegrationConfig = {
  type: string;
  label: string;
  description?: string;
  fields: IntegrationField[];
};

const INTEGRATIONS: IntegrationConfig[] = [
  {
    type: 'smtp',
    label: 'SMTP (Email)',
    description:
      'Configure your SMTP provider (Resend, SendGrid, Mailgun, Gmail, or custom).',
    fields: [
      {
        key: 'host',
        label: 'host',
        placeholder: 'smtp.resend.com',
        defaultValue: 'smtp.resend.com',
      },
      { key: 'port', label: 'port', placeholder: '465', defaultValue: '465' },
      {
        key: 'username',
        label: 'username',
        placeholder: 'resend',
        defaultValue: 'resend',
      },
      { key: 'password', label: 'password', placeholder: 'API key', defaultValue: '' },
      {
        key: 'from_address',
        label: 'from_address',
        placeholder: 'noreply@yourdomain.com',
        defaultValue: '',
      },
      { key: 'from_name', label: 'from_name', placeholder: 'Your Brand', defaultValue: '' },
    ],
  },
  {
    type: 'resend',
    label: 'Resend (Email API)',
    fields: [
      { key: 'api_key', label: 'api_key' },
      { key: 'from_address', label: 'from_address' },
      { key: 'from_name', label: 'from_name' },
    ],
  },
  {
    type: 'twilio',
    label: 'Twilio',
    fields: [
      { key: 'account_sid', label: 'account_sid' },
      { key: 'api_key', label: 'api_key' },
      { key: 'sender', label: 'sender' },
    ],
  },
  {
    type: 'stripe',
    label: 'Stripe',
    fields: [
      { key: 'secret_key', label: 'secret_key' },
      { key: 'publishable_key', label: 'publishable_key' },
      { key: 'webhook_secret', label: 'webhook_secret' },
    ],
  },
  {
    type: 'google_maps',
    label: 'Google Maps',
    fields: [{ key: 'api_key', label: 'api_key' }],
  },
];

export default function IntegrationsPage() {
  const [rows, setRows] = useState<IntegrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formState, setFormState] = useState<Record<string, any>>({});
  const [testStatus, setTestStatus] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [intSaving, setIntSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  // Collapsed state — configured integrations start collapsed
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.get('/integrations').then((res) => {
      setRows(res.data ?? []);
      setLoading(false);
    });
  }, []);

  async function saveIntegration(type: string) {
    setIntSaving(true);
    try {
      const config = formState[type]?.config ?? {};
      const rawKey = config.password || config.api_key || '';
      const maskedPreview = rawKey ? `****${rawKey.slice(-4)}` : null;
      await api.post(`/integrations/${type}`, {
        ...config,
        maskedPreview,
      });
      try {
        const testRes = await api.post(`/integrations/test/${type}`);
        setTestStatus((prev) => ({
          ...prev,
          [type]: {
            ok: Boolean(testRes.data?.success),
            message: testRes.data?.message ?? 'Connection test completed',
          },
        }));
      } catch (err: any) {
        const message = err?.response?.data?.message ?? 'Connection test failed';
        setTestStatus((prev) => ({
          ...prev,
          [type]: { ok: false, message },
        }));
      }
      const refreshed = await api.get('/integrations');
      setRows(refreshed.data ?? []);
      // Collapse after successful save
      setExpanded((prev) => ({ ...prev, [type]: false }));
      setToast({ message: `${type} integration saved`, tone: 'success' });
    } catch (e: any) {
      setToast({ message: e?.response?.data?.message ?? 'Save failed', tone: 'error' });
    } finally {
      setIntSaving(false);
    }
  }

  async function removeIntegration() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await api.delete(`/integrations/${removeTarget}`);
      const refreshed = await api.get('/integrations');
      setRows(refreshed.data ?? []);
      setToast({ message: `${removeTarget} integration removed`, tone: 'success' });
    } catch {
      setToast({ message: 'Failed to remove integration', tone: 'error' });
    } finally {
      setRemoving(false);
      setRemoveTarget(null);
    }
  }

  if (loading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Integrations</h2>
        <p className="text-sm text-gray-500 mt-1">
          Configure email, SMS, and payments for your tenant.
        </p>
      </div>

      {INTEGRATIONS.map((integration) => {
        const current = rows.find((r) => r.type === integration.type);
        const fields = integration.fields;
        const isConfigured = !!current?.active;
        const isExpanded = expanded[integration.type] ?? !isConfigured;
        return (
          <div
            key={integration.type}
            className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
          >
            {/* Header row */}
            <div
              className="flex items-center justify-between px-6 py-4 cursor-pointer select-none hover:bg-gray-50 transition-colors"
              onClick={() => setExpanded((prev) => ({ ...prev, [integration.type]: !isExpanded }))}
            >
              <div className="flex items-center gap-3">
                {isConfigured && (
                  <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{integration.label}</h3>
                  {integration.description && (
                    <p className="text-xs text-gray-400 mt-0.5">{integration.description}</p>
                  )}
                  <p className={`text-xs mt-0.5 font-medium ${isConfigured ? 'text-green-600' : 'text-gray-400'}`}>
                    {isConfigured ? `Active · ${current.masked_preview ?? '****'}` : 'Not configured'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {testStatus[integration.type] && (
                  <span className={`text-xs px-2 py-1 rounded font-medium ${
                    testStatus[integration.type].ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {testStatus[integration.type].ok ? '✅ Verified' : '❌ Failed'}
                  </span>
                )}
                {isConfigured && (
                  <button
                    onClick={() => setRemoveTarget(integration.type)}
                    className="px-3 py-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50 text-xs font-medium"
                  >
                    Remove
                  </button>
                )}
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Collapsible form */}
            {isExpanded && (
            <div className="px-6 pb-6 pt-2 border-t border-gray-50 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label ?? field.key}
                  </label>
                  <input
                    type="text"
                    placeholder={field.placeholder}
                    defaultValue={field.defaultValue}
                    className="w-full border rounded px-3 py-2 text-sm"
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        [integration.type]: {
                          config: {
                            ...prev[integration.type]?.config,
                            [field.key]: e.target.value,
                          },
                        },
                      }))
                    }
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => saveIntegration(integration.type)}
                disabled={intSaving}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-60"
              >
                {intSaving ? 'Saving…' : isConfigured ? 'Update' : 'Save'}
              </button>
            </div>
            </div>
            )}
          </div>
        );
      })}

      <ConfirmModal
        title={`Remove ${removeTarget} integration?`}
        description="This will remove your custom configuration. Platform defaults will be used."
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={removeIntegration}
        confirmText={removing ? 'Removing…' : 'Yes, remove'}
        confirmTone="danger"
        loading={removing}
      />

      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  );
}
