'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

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
    description: 'Configure your SMTP provider (Resend, SendGrid, Mailgun, Gmail, or custom).',
    fields: [
      { key: 'host', label: 'host', placeholder: 'smtp.resend.com', defaultValue: 'smtp.resend.com' },
      { key: 'port', label: 'port', placeholder: '465', defaultValue: '465' },
      { key: 'username', label: 'username', placeholder: 'resend', defaultValue: 'resend' },
      { key: 'password', label: 'password', placeholder: 'API key', defaultValue: '' },
      { key: 'from_address', label: 'from_address', placeholder: 'noreply@yourdomain.com', defaultValue: '' },
      { key: 'from_name', label: 'from_name', placeholder: 'Your Brand', defaultValue: '' },
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
    fields: [{ key: 'api_key', label: 'api_key' }],
  },
];

export default function IntegrationsPage() {
  const [rows, setRows] = useState<IntegrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formState, setFormState] = useState<Record<string, any>>({});
  const [testStatus, setTestStatus] = useState<Record<string, { ok: boolean; message: string }>>({});

  useEffect(() => {
    api.get('/integrations').then((res) => {
      setRows(res.data ?? []);
      setLoading(false);
    });
  }, []);

  async function saveIntegration(type: string) {
    const config = formState[type]?.config ?? {};
    const rawKey = config.password || config.api_key || '';
    const maskedPreview = rawKey ? `****${rawKey.slice(-4)}` : null;
    await api.post(`/integrations/${type}`, {
      config,
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
        return (
          <div
            key={integration.type}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{integration.label}</h3>
                {integration.description && (
                  <p className="text-sm text-gray-500 mt-1">{integration.description}</p>
                )}
                <p className="text-sm text-gray-500">
                  {current?.active ? `Configured (${current.masked_preview ?? '****'})` : 'Not configured'}
                </p>
                {testStatus[integration.type] && (
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium mt-2 ${
                      testStatus[integration.type].ok
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {testStatus[integration.type].ok
                      ? '✅ Connection verified'
                      : `❌ Connection failed: ${testStatus[integration.type].message}`}
                  </span>
                )}
              </div>
              <button
                onClick={() => saveIntegration(integration.type)}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Save
              </button>
            </div>
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
          </div>
        );
      })}
    </div>
  );
}
