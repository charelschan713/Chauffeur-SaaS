'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Toast } from '@/components/ui/Toast';

type WidgetSettings = {
  customCss?: string;
  customCssUrl?: string;
};

const DEFAULTS: Required<WidgetSettings> = {
  customCss: '',
  customCssUrl: '',
};


export default function WidgetSettingsPage() {
  const qc = useQueryClient();
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  const { data: settings } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: async () => {
      const res = await api.get('/tenants/settings');
      return res.data;
    },
  });

  const [form, setForm] = useState<Required<WidgetSettings>>(DEFAULTS);

  useEffect(() => {
    const ws = settings?.widget_settings ?? null;
    if (ws && typeof ws === 'object') {
      setForm({
        customCss: typeof ws.customCss === 'string' ? ws.customCss : (typeof ws.custom_css === 'string' ? ws.custom_css : ''),
        customCssUrl: typeof ws.customCssUrl === 'string' ? ws.customCssUrl : (typeof ws.custom_css_url === 'string' ? ws.custom_css_url : ''),
      });
    } else {
      setForm(DEFAULTS);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const existing = settings?.widget_settings ?? {};
      await api.patch('/tenants/settings', {
        widget_settings: {
          ...existing,
          customCss: form.customCss,
          customCssUrl: form.customCssUrl,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-settings'] });
      setToast({ message: 'Widget settings saved', tone: 'success' });
    },
    onError: () => setToast({ message: 'Failed to save widget settings', tone: 'error' }),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Widget Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure custom CSS overrides for the tenant widget. Feature toggles are managed by the tenant’s website widget.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium text-gray-900">Custom CSS</div>
            <div className="text-xs text-gray-500 mt-0.5">Override widget styles for this tenant only.</div>
            <textarea
              value={form.customCss}
              onChange={(e) => setForm((p) => ({ ...p, customCss: e.target.value }))}
              rows={6}
              placeholder="/* Custom CSS overrides */\n#chauffeur-quote .cw-shell { }"
              className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono"
            />
          </div>

          <div>
            <div className="text-sm font-medium text-gray-900">Custom CSS URL</div>
            <div className="text-xs text-gray-500 mt-0.5">Load external CSS (overrides inline CSS if both set).</div>
            <input
              value={form.customCssUrl}
              onChange={(e) => setForm((p) => ({ ...p, customCssUrl: e.target.value }))}
              placeholder="https://example.com/widget-overrides.css"
              className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>

          <div className="pt-2">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
