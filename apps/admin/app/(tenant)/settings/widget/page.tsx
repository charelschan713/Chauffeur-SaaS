'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Toast } from '@/components/ui/Toast';

type WidgetSettings = {
  returnTrip?: boolean;
  flightNumber?: boolean;
  waypoints?: boolean;
  passengers?: boolean;
  luggage?: boolean;
  babySeats?: boolean;
  promoCode?: boolean;
  customCss?: string;
  customCssUrl?: string;
};

const DEFAULTS: Required<WidgetSettings> = {
  returnTrip: false,
  flightNumber: false,
  waypoints: false,
  passengers: false,
  luggage: false,
  babySeats: false,
  promoCode: false,
  customCss: '',
  customCssUrl: '',
};

function ToggleRow({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <div>
        <div className="text-sm font-medium text-gray-900">{label}</div>
        {desc && <div className="text-xs text-gray-500 mt-0.5">{desc}</div>}
      </div>
      <label className="inline-flex items-center gap-2 select-none">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="text-xs text-gray-600">{value ? 'Active' : 'Inactive'}</span>
      </label>
    </div>
  );
}

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
        returnTrip: !!ws.returnTrip,
        flightNumber: !!ws.flightNumber,
        waypoints: !!ws.waypoints,
        passengers: !!ws.passengers,
        luggage: !!ws.luggage,
        babySeats: !!ws.babySeats,
        promoCode: !!ws.promoCode,
        customCss: typeof ws.customCss === 'string' ? ws.customCss : (typeof ws.custom_css === 'string' ? ws.custom_css : ''),
        customCssUrl: typeof ws.customCssUrl === 'string' ? ws.customCssUrl : (typeof ws.custom_css_url === 'string' ? ws.custom_css_url : ''),
      });
    } else {
      setForm(DEFAULTS);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.patch('/tenants/settings', { widget_settings: form });
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
          Control which input sections are visible in the tenant quote widget. Required fields (pickup, drop-off, date/time) are always shown.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="divide-y divide-gray-100">
          <ToggleRow
            label="Return Trip"
            desc="Allow customers to request return journeys."
            value={form.returnTrip}
            onChange={(v) => setForm((p) => ({ ...p, returnTrip: v }))}
          />
          <ToggleRow
            label="Flight Number"
            desc="Show flight number inputs (pickup + return flight)."
            value={form.flightNumber}
            onChange={(v) => setForm((p) => ({ ...p, flightNumber: v }))}
          />
          <ToggleRow
            label="Waypoints / Stops"
            desc="Allow intermediate stops between pickup and drop-off."
            value={form.waypoints}
            onChange={(v) => setForm((p) => ({ ...p, waypoints: v }))}
          />
          <ToggleRow
            label="Passengers"
            desc="Show passenger count selector."
            value={form.passengers}
            onChange={(v) => setForm((p) => ({ ...p, passengers: v }))}
          />
          <ToggleRow
            label="Luggage"
            desc="Show luggage count selector."
            value={form.luggage}
            onChange={(v) => setForm((p) => ({ ...p, luggage: v }))}
          />
          <ToggleRow
            label="Baby Seats"
            desc="Show baby seat selectors (infant/toddler/booster)."
            value={form.babySeats}
            onChange={(v) => setForm((p) => ({ ...p, babySeats: v }))}
          />
          <ToggleRow
            label="Promo Code"
            desc="Allow promo code entry."
            value={form.promoCode}
            onChange={(v) => setForm((p) => ({ ...p, promoCode: v }))}
          />
        </div>

        <div className="pt-6 space-y-4">
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
