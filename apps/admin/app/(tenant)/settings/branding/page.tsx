'use client';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';

const FONT_OPTIONS = [
  { label: 'Playfair Display (Luxury Serif)', value: 'Playfair Display' },
  { label: 'Cormorant Garamond (Elegant Serif)', value: 'Cormorant Garamond' },
  { label: 'Lato (Modern Sans)', value: 'Lato' },
  { label: 'Montserrat (Clean Sans)', value: 'Montserrat' },
  { label: 'Inter (System Sans)', value: 'Inter' },
];

// Convert hex #rrggbb → HSL string "h s% l%" for CSS variables
function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Convert HSL string "h s% l%" → hex (best-effort for display)
function hslToHex(hsl: string): string {
  try {
    const [h, s, l] = hsl.replace(/%/g, '').split(' ').map(Number);
    const sn = s / 100, ln = l / 100;
    const a = sn * Math.min(ln, 1 - ln);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = ln - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  } catch { return '#2563eb'; }
}

export default function BrandingPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    logoUrl: '',
    primaryColor: '39 46% 60%',   // stored as HSL string
    primaryForeground: '240 8% 3%',
    fontFamily: 'Playfair Display',
    companyName: '',
    contactEmail: '',
    contactPhone: '',
    customDomain: '',
    cancelWindowHours: 24,
    websiteUrl: '',
    customCss: '',
    customCssUrl: '',
  });
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  const { data: branding } = useQuery({
    queryKey: ['tenant-branding'],
    queryFn: () => api.get('/tenant-branding').then((r) => r.data),
  });

  useEffect(() => {
    if (branding) {
      setForm({
        logoUrl:             branding.logo_url             ?? '',
        primaryColor:        branding.primary_color        ?? '39 46% 60%',
        primaryForeground:   branding.primary_foreground   ?? '240 8% 3%',
        fontFamily:          branding.font_family          ?? 'Playfair Display',
        companyName:         branding.company_name         ?? '',
        contactEmail:        branding.contact_email        ?? '',
        contactPhone:        branding.contact_phone        ?? '',
        customDomain:        branding.custom_domain        ?? '',
        cancelWindowHours:   branding.cancel_window_hours  ?? 24,
        websiteUrl:          branding.website_url          ?? '',
        customCss:           branding.custom_css           ?? '',
        customCssUrl:        branding.custom_css_url       ?? '',
      });
    }
  }, [branding]);

  const saveMut = useMutation({
    mutationFn: () => api.put('/tenant-branding', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-branding'] });
      setToast({ message: 'Branding saved', tone: 'success' });
    },
    onError: () => setToast({ message: 'Failed to save branding', tone: 'error' }),
  });

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  // Preview colour (convert HSL → hex for color input)
  const previewHex = hslToHex(form.primaryColor);

  return (
    <div className="space-y-6">
      <PageHeader title="Branding" description="Customise your customer portal appearance" />

      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}

      {/* ── Identity ── */}
      <Card title="Identity">
        <div className="space-y-4 max-w-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.companyName} onChange={f('companyName')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.logoUrl} onChange={f('logoUrl')} placeholder="https://..." />
            {form.logoUrl && (
              <img src={form.logoUrl} alt="logo preview" className="mt-2 h-10 object-contain rounded" />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
            <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.contactEmail} onChange={f('contactEmail')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
            <input type="tel" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.contactPhone} onChange={f('contactPhone')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Custom Domain</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.customDomain} onChange={f('customDomain')} placeholder="book.yourdomain.com" />
            <p className="text-xs text-gray-400 mt-1">Set a CNAME pointing to the customer portal host</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Website / Booking Widget URL</label>
            <input type="url" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.websiteUrl} onChange={f('websiteUrl')} placeholder="https://yoursite.com/#book" />
            <p className="text-xs text-gray-400 mt-1">"Book a Ride" on the customer portal links here. Leave blank to stay within the portal.</p>
          </div>
        </div>
      </Card>

      {/* ── Theme (Step B) ── */}
      <Card title="Customer Portal Theme">
        <div className="space-y-5 max-w-lg">
          <p className="text-sm text-gray-500">
            These settings control the colour and typography of your customer-facing booking portal.
            Values are injected as CSS variables at runtime.
          </p>

          {/* Primary colour */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Primary Colour
              <span className="ml-1 text-xs text-gray-400 font-normal">(HSL: e.g. 39 46% 60%)</span>
            </label>
            <div className="flex gap-3 items-center">
              <input
                type="color"
                className="h-10 w-14 rounded border border-gray-300 cursor-pointer"
                value={previewHex}
                onChange={(e) => setForm({ ...form, primaryColor: hexToHsl(e.target.value) })}
              />
              <input
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                value={form.primaryColor}
                onChange={f('primaryColor')}
                placeholder="39 46% 60%"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Use the colour picker or type an HSL value directly for exact brand matching.
            </p>
          </div>

          {/* Primary foreground */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Primary Foreground
              <span className="ml-1 text-xs text-gray-400 font-normal">(text on primary buttons)</span>
            </label>
            <div className="flex gap-3 items-center">
              <input
                type="color"
                className="h-10 w-14 rounded border border-gray-300 cursor-pointer"
                value={hslToHex(form.primaryForeground)}
                onChange={(e) => setForm({ ...form, primaryForeground: hexToHsl(e.target.value) })}
              />
              <input
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                value={form.primaryForeground}
                onChange={f('primaryForeground')}
                placeholder="240 8% 3%"
              />
            </div>
          </div>

          {/* Font family */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Font</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.fontFamily}
              onChange={f('fontFamily')}
            >
              {FONT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Cancel window */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cancellation Window (hours)</label>
            <input
              type="number"
              min={0}
              max={168}
              className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.cancelWindowHours}
              onChange={(e) => setForm({ ...form, cancelWindowHours: Number(e.target.value) })}
            />
            <p className="text-xs text-gray-400 mt-1">
              Customers can cancel free of charge up to this many hours before pickup.
            </p>
          </div>
        </div>
      </Card>

      {/* ── Custom CSS (Portal) ── */}
      <Card title="Custom Portal CSS">
        <div className="space-y-4 max-w-2xl">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Custom CSS</label>
            <p className="text-xs text-gray-400 mb-2">Overrides for customer portal pages (including login/account).</p>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
              rows={7}
              placeholder="/* Custom CSS overrides */\n:root { --primary: 39 46% 60%; }"
              value={form.customCss}
              onChange={(e) => setForm({ ...form, customCss: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Custom CSS URL</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="https://example.com/portal-overrides.css"
              value={form.customCssUrl}
              onChange={(e) => setForm({ ...form, customCssUrl: e.target.value })}
            />
          </div>
          <p className="text-xs text-gray-400">If both are set, URL loads after inline CSS.</p>
        </div>
      </Card>

      {/* ── Live preview ── */}
      <Card title="Live Preview">
        <div className="p-6 rounded-xl" style={{ background: 'hsl(240 8% 3%)' }}>
          <div className="max-w-xs mx-auto rounded-xl border p-5 space-y-3"
            style={{ background: 'hsl(228 10% 8%)', borderColor: `hsl(${form.primaryColor} / 0.3)` }}>
            <div className="h-1.5 w-20 rounded-full" style={{ background: `hsl(${form.primaryColor})` }} />
            <p className="font-semibold text-white" style={{ fontFamily: `'${form.fontFamily}', serif` }}>
              {form.companyName || 'Your Company'}
            </p>
            <p className="text-xs" style={{ color: 'hsl(217 11% 70%)' }}>
              Sydney Airport → Four Seasons Hotel
            </p>
            <button className="w-full py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
              style={{
                background: `hsl(${form.primaryColor})`,
                color: `hsl(${form.primaryForeground})`,
                fontFamily: `'${form.fontFamily}', serif`,
              }}>
              Book Now
            </button>
          </div>
        </div>
      </Card>

      <div>
        <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
          {saveMut.isPending ? 'Saving...' : 'Save Branding'}
        </Button>
      </div>
    </div>
  );
}
