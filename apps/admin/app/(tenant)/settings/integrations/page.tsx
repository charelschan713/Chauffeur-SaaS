'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface IntegrationRow {
  type: string;
  active: boolean;
  masked_preview: string | null;
}

const INTEGRATIONS = [
  { type: 'sendgrid', label: 'SendGrid', fields: ['api_key', 'from_address', 'from_name'] },
  { type: 'twilio', label: 'Twilio', fields: ['account_sid', 'api_key', 'sender'] },
  { type: 'stripe', label: 'Stripe', fields: ['api_key'] },
];

export default function IntegrationsPage() {
  const [rows, setRows] = useState<IntegrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formState, setFormState] = useState<Record<string, any>>({});

  useEffect(() => {
    api.get('/integrations').then((res) => {
      setRows(res.data ?? []);
      setLoading(false);
    });
  }, []);

  async function saveIntegration(type: string) {
    const config = formState[type]?.config ?? {};
    const rawKey = config.api_key || '';
    const maskedPreview = rawKey ? `****${rawKey.slice(-4)}` : null;
    await api.post(`/integrations/${type}`, {
      config,
      maskedPreview,
    });
    const refreshed = await api.get('/integrations');
    setRows(refreshed.data ?? []);
  }

  if (loading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Integrations</h2>
        <p className="text-sm text-gray-500 mt-1">Manage SendGrid, Twilio, and Stripe credentials.</p>
      </div>

      {INTEGRATIONS.map((integration) => {
        const current = rows.find((r) => r.type === integration.type);
        return (
          <div key={integration.type} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{integration.label}</h3>
                <p className="text-sm text-gray-500">
                  {current?.active ? `Configured (${current.masked_preview ?? '****'})` : 'Not configured'}
                </p>
              </div>
              <button
                onClick={() => saveIntegration(integration.type)}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Save
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {integration.fields.map((field) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{field}</label>
                  <input
                    type="text"
                    className="w-full border rounded px-3 py-2 text-sm"
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        [integration.type]: {
                          config: {
                            ...prev[integration.type]?.config,
                            [field]: e.target.value,
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
