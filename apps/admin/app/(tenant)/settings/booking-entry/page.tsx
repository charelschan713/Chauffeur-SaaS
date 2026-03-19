'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

const DEFAULTS = {
  widget_enabled: true,
  public_booking_enabled: true,
  guest_booking_enabled: true,
  quote_entry_mode: 'CTA_FIRST',
  cta_label: 'Get Instant Quote',
  widget_heading: 'Get Your Quote in Seconds',
  widget_intro_text: '',
  homepage_preload_widget: true,
  internal_pages_quote_cta_handoff_enabled: true,
  enabled_service_types: [] as string[],
  enabled_service_classes: [] as string[],
  allow_return_trip: true,
  allow_waypoints: true,
  allow_special_requests: true,
  allow_flight_details: true,
  allow_return_flight_details: true,
  required_fields: [] as string[],
  required_passenger_fields: [] as string[],
};

export default function BookingEntrySettingsPage() {
  const [form, setForm] = useState<any>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/tenant-branding/me/booking-entry-config');
        setForm({ ...DEFAULTS, ...(data || {}) });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

  async function onSave() {
    setSaving(true);
    setMsg('');
    try {
      const payload = {
        ...form,
        enabled_service_types: Array.isArray(form.enabled_service_types)
          ? form.enabled_service_types
          : toList(form.enabled_service_types || ''),
        enabled_service_classes: Array.isArray(form.enabled_service_classes)
          ? form.enabled_service_classes
          : toList(form.enabled_service_classes || ''),
        required_fields: Array.isArray(form.required_fields)
          ? form.required_fields
          : toList(form.required_fields || ''),
        required_passenger_fields: Array.isArray(form.required_passenger_fields)
          ? form.required_passenger_fields
          : toList(form.required_passenger_fields || ''),
      };
      await api.patch('/tenant-branding/me/booking-entry-config', payload);
      setMsg('Booking entry settings saved.');
    } catch (e: any) {
      setMsg(e?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading booking entry settings…</div>;

  return (
    <div className="max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold">Booking Entry Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Controls website widget/public booking entry behavior. Pricing engine logic remains platform-owned.
        </p>
      </div>

      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="font-medium">Enablement</h2>
        <Toggle label="Widget enabled" checked={form.widget_enabled} onChange={(v) => setForm({ ...form, widget_enabled: v })} />
        <Toggle label="Public booking enabled" checked={form.public_booking_enabled} onChange={(v) => setForm({ ...form, public_booking_enabled: v })} />
        <Toggle label="Guest booking enabled" checked={form.guest_booking_enabled} onChange={(v) => setForm({ ...form, guest_booking_enabled: v })} />
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="font-medium">Entry UX Mode</h2>
        <label className="text-sm block">Quote entry mode</label>
        <select className="border rounded px-2 py-1 text-sm" value={form.quote_entry_mode} onChange={(e) => setForm({ ...form, quote_entry_mode: e.target.value })}>
          <option value="CTA_FIRST">CTA_FIRST</option>
          <option value="DIRECT_WIDGET">DIRECT_WIDGET</option>
        </select>
        <Input label="CTA label" value={form.cta_label || ''} onChange={(v) => setForm({ ...form, cta_label: v })} />
        <Input label="Widget heading" value={form.widget_heading || ''} onChange={(v) => setForm({ ...form, widget_heading: v })} />
        <Input label="Widget intro text" value={form.widget_intro_text || ''} onChange={(v) => setForm({ ...form, widget_intro_text: v })} />
        <Toggle label="Homepage preload widget" checked={form.homepage_preload_widget} onChange={(v) => setForm({ ...form, homepage_preload_widget: v })} />
        <Toggle label="Internal pages quote CTA handoff enabled" checked={form.internal_pages_quote_cta_handoff_enabled} onChange={(v) => setForm({ ...form, internal_pages_quote_cta_handoff_enabled: v })} />
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="font-medium">Visible Booking Options</h2>
        <Input label="Enabled service types (comma separated IDs)" value={Array.isArray(form.enabled_service_types) ? form.enabled_service_types.join(', ') : (form.enabled_service_types || '')} onChange={(v) => setForm({ ...form, enabled_service_types: v })} />
        <Input label="Enabled service classes/car types (comma separated IDs)" value={Array.isArray(form.enabled_service_classes) ? form.enabled_service_classes.join(', ') : (form.enabled_service_classes || '')} onChange={(v) => setForm({ ...form, enabled_service_classes: v })} />
        <Toggle label="Allow return trip" checked={form.allow_return_trip} onChange={(v) => setForm({ ...form, allow_return_trip: v })} />
        <Toggle label="Allow waypoints" checked={form.allow_waypoints} onChange={(v) => setForm({ ...form, allow_waypoints: v })} />
        <Toggle label="Allow special requests / notes" checked={form.allow_special_requests} onChange={(v) => setForm({ ...form, allow_special_requests: v })} />
        <Toggle label="Allow flight details" checked={form.allow_flight_details} onChange={(v) => setForm({ ...form, allow_flight_details: v })} />
        <Toggle label="Allow return flight details" checked={form.allow_return_flight_details} onChange={(v) => setForm({ ...form, allow_return_flight_details: v })} />
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="font-medium">Required Field Rules</h2>
        <Input label="Required booking/customer fields (comma separated)" value={Array.isArray(form.required_fields) ? form.required_fields.join(', ') : (form.required_fields || '')} onChange={(v) => setForm({ ...form, required_fields: v })} />
        <Input label="Required passenger fields (comma separated)" value={Array.isArray(form.required_passenger_fields) ? form.required_passenger_fields.join(', ') : (form.required_passenger_fields || '')} onChange={(v) => setForm({ ...form, required_passenger_fields: v })} />
      </section>

      <div className="flex items-center gap-3">
        <button onClick={onSave} disabled={saving} className="rounded bg-indigo-600 text-white px-4 py-2 text-sm disabled:opacity-60">
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        <span className="text-sm text-gray-600">{msg}</span>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-sm block">{label}</label>
      <input className="w-full border rounded px-2 py-1 text-sm" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
