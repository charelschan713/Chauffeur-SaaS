'use client';

import { useState, useEffect } from 'react';
import { Toast } from '@/components/ui/Toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { InlineSpinner } from '@/components/ui/LoadingSpinner';

function parseJwt(token: string | null) {
  if (!token) return null;
  try { return JSON.parse(atob(token.split('.')[1])); } catch { return null; }
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
      <h2 className="text-base font-semibold text-gray-900 pb-3 border-b border-gray-100">{title}</h2>
      {children}
    </div>
  );
}

const TABS = ['Business Profile', 'Operations', 'Invoice Defaults', 'Banking'] as const;
type Tab = typeof TABS[number];

const AU_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

export default function GeneralSettingsPage() {
  const qc = useQueryClient();
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const user = parseJwt(token);
  const isOwner = ['OWNER', 'owner', 'tenant_admin', 'TENANT_ADMIN'].includes(user?.role ?? '');

  const [activeTab, setActiveTab] = useState<Tab>('Business Profile');
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  // ── Operations settings ─────────────────────────────────────────────────
  const { data: settings } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: async () => { const res = await api.get('/tenants/settings'); return res.data; },
  });

  const [confirmText, setConfirmText] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingAutoAssign, setPendingAutoAssign] = useState<boolean | null>(null);
  const [payForm, setPayForm] = useState({ default_driver_pay_type: 'PERCENTAGE', default_driver_pay_value: 70 });

  useEffect(() => {
    if (settings) {
      setPayForm({
        default_driver_pay_type: settings.default_driver_pay_type ?? 'PERCENTAGE',
        default_driver_pay_value: parseFloat(settings.default_driver_pay_value ?? '70'),
      });
    }
  }, [settings]);

  const toggleMutation = useMutation({
    mutationFn: async () => {
      await api.patch('/tenants/settings', { auto_assign_enabled: pendingAutoAssign, confirm_text: confirmText });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenant-settings'] }); setShowConfirm(false); setConfirmText(''); },
  });

  const payMutation = useMutation({
    mutationFn: async () => { await api.patch('/tenants/settings', payForm); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenant-settings'] }); setToast({ message: 'Driver pay settings saved', tone: 'success' }); },
  });

  // ── Business settings ───────────────────────────────────────────────────
  const { data: biz } = useQuery({
    queryKey: ['tenant-business'],
    queryFn: async () => { const res = await api.get('/tenants/business'); return res.data; },
  });

  const emptyBiz = {
    business_name: '', abn: '',
    address_line1: '', address_line2: '', city: '', state: '', postcode: '', country: 'Australia',
    phoneCode: '+61', phone: '', email: '', website: '', logo_url: '',
  };
  const emptyInvoice = { invoice_notes: '', invoice_footer: '' };
  const emptyBank = { bank_name: '', bank_account_name: '', bank_bsb: '', bank_account_number: '' };

  const [bizForm, setBizForm] = useState(emptyBiz);
  const [invoiceForm, setInvoiceForm] = useState(emptyInvoice);
  const [bankForm, setBankForm] = useState(emptyBank);

  useEffect(() => {
    if (biz) {
      setBizForm({
        business_name: biz.business_name ?? '',
        abn: biz.abn ?? '',
        address_line1: biz.address_line1 ?? '',
        address_line2: biz.address_line2 ?? '',
        city: biz.city ?? '',
        state: biz.state ?? '',
        postcode: biz.postcode ?? '',
        country: biz.country ?? 'Australia',
        phoneCode: (() => { const p = biz.phone ?? ''; const m = p.match(/^(\+\d{1,3})/); return m ? m[1] : '+61'; })(),
        phone: (() => { const p = biz.phone ?? ''; return p.replace(/^\+\d{1,3}\s?/, ''); })(),
        email: biz.email ?? '',
        website: biz.website ?? '',
        logo_url: biz.logo_url ?? '',
      });
      setInvoiceForm({ invoice_notes: biz.invoice_notes ?? '', invoice_footer: biz.invoice_footer ?? '' });
      setBankForm({
        bank_name: biz.bank_name ?? '',
        bank_account_name: biz.bank_account_name ?? '',
        bank_bsb: biz.bank_bsb ?? '',
        bank_account_number: biz.bank_account_number ?? '',
      });
    }
  }, [biz]);

  const bizMutation = useMutation({
    mutationFn: (data: any) => api.patch('/tenants/business', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenant-business'] }); setToast({ message: 'Business profile saved', tone: 'success' }); },
    onError: () => setToast({ message: 'Failed to save', tone: 'error' }),
  });

  const currency = settings?.currency ?? '—';

  return (
    <div className="space-y-6 max-w-2xl">
      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}

      <div>
        <h1 className="text-2xl font-bold text-gray-900">General Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your business profile, operations, and invoice defaults</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b gap-0">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── Tab: Business Profile ─────────────────────────────────────────── */}
      {activeTab === 'Business Profile' && (
        <div className="space-y-6">
          <Section title="Company Identity">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Business / Trading Name *">
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={bizForm.business_name}
                  onChange={e => setBizForm(f => ({ ...f, business_name: e.target.value }))} placeholder="AS Concierges Pty Ltd" />
              </Field>
              <Field label="ABN" hint="Australian Business Number — shown on invoices">
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={bizForm.abn}
                  onChange={e => setBizForm(f => ({ ...f, abn: e.target.value }))} placeholder="12 345 678 901" />
              </Field>
            </div>
          </Section>

          <Section title="Business Address">
            <Field label="Address Line 1">
              <input className="w-full border rounded-lg px-3 py-2 text-sm" value={bizForm.address_line1}
                onChange={e => setBizForm(f => ({ ...f, address_line1: e.target.value }))} placeholder="Unit 1, 123 George St" />
            </Field>
            <Field label="Address Line 2">
              <input className="w-full border rounded-lg px-3 py-2 text-sm" value={bizForm.address_line2}
                onChange={e => setBizForm(f => ({ ...f, address_line2: e.target.value }))} placeholder="(optional)" />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="City / Suburb">
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={bizForm.city}
                  onChange={e => setBizForm(f => ({ ...f, city: e.target.value }))} placeholder="Sydney" />
              </Field>
              <Field label="State">
                <select className="w-full border rounded-lg px-3 py-2 text-sm" value={bizForm.state}
                  onChange={e => setBizForm(f => ({ ...f, state: e.target.value }))}>
                  <option value="">—</option>
                  {AU_STATES.map(s => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Postcode">
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={bizForm.postcode}
                  onChange={e => setBizForm(f => ({ ...f, postcode: e.target.value }))} placeholder="2000" />
              </Field>
            </div>
          </Section>

          <Section title="Contact Details">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Business Phone">
                <div className="flex gap-2"><select value={bizForm.phoneCode} onChange={e => setBizForm(f => ({ ...f, phoneCode: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white w-24 shrink-0">{["+61","+1","+44","+64","+852","+65","+86"].map(c => <option key={c}>{c}</option>)}</select><input className="flex-1 border rounded-lg px-3 py-2 text-sm" value={bizForm.phone} onChange={e => setBizForm(f => ({ ...f, phone: e.target.value }))} placeholder="2 9999 9999" /></div>
              </Field>
              <Field label="Business Email">
                <input type="email" className="w-full border rounded-lg px-3 py-2 text-sm" value={bizForm.email}
                  onChange={e => setBizForm(f => ({ ...f, email: e.target.value }))} placeholder="admin@aschauffeured.com.au" />
              </Field>
            </div>
            <Field label="Website">
              <input className="w-full border rounded-lg px-3 py-2 text-sm" value={bizForm.website}
                onChange={e => setBizForm(f => ({ ...f, website: e.target.value }))} placeholder="https://aschauffeured.com.au" />
            </Field>
            <Field label="Logo URL" hint="Direct link to your logo image (PNG/SVG recommended)">
              <input className="w-full border rounded-lg px-3 py-2 text-sm" value={bizForm.logo_url}
                onChange={e => setBizForm(f => ({ ...f, logo_url: e.target.value }))} placeholder="https://..." />
              {bizForm.logo_url && (
                <div className="mt-2 p-2 border rounded bg-gray-50 inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={bizForm.logo_url} alt="Logo preview" className="h-10 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}
            </Field>
          </Section>

          <div>
            <button
              onClick={() => bizMutation.mutate({ ...bizForm, phone: bizForm.phone ? `${bizForm.phoneCode}${bizForm.phone}` : '' })}
              disabled={bizMutation.isPending}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-60 flex items-center gap-2"
            >
              {bizMutation.isPending && <InlineSpinner />}
              Save Business Profile
            </button>
          </div>
        </div>
      )}

      {/* ── Tab: Operations ───────────────────────────────────────────────── */}
      {activeTab === 'Operations' && (
        <div className="space-y-6">
          <Section title="Currency">
            {currency && currency !== '—' ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900 bg-gray-100 px-3 py-1.5 rounded">{currency}</span>
                <span className="text-xs text-gray-400">(Synced from Stripe)</span>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Configure <a href="/settings/integrations" className="text-blue-600 underline">Stripe integration</a> to sync currency.</p>
            )}
            <p className="text-xs text-gray-400">Contact platform support to change currency.</p>
          </Section>

          <Section title="Auto Assign">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Auto Assign Drivers</p>
                <p className="text-xs text-gray-500">Automatically dispatch bookings to available drivers.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-medium ${settings?.auto_assign_enabled ? 'text-green-600' : 'text-gray-400'}`}>
                  {settings?.auto_assign_enabled ? 'ON' : 'OFF'}
                </span>
                {isOwner && (
                  <button onClick={() => { setPendingAutoAssign(!settings?.auto_assign_enabled); setShowConfirm(true); }}
                    className="px-3 py-1 rounded border text-sm hover:bg-gray-50">Toggle</button>
                )}
              </div>
            </div>
            {showConfirm && (
              <div className="border rounded p-4 bg-yellow-50 space-y-3">
                <p className="text-sm font-medium">Type <strong>CONFIRM</strong> to {pendingAutoAssign ? 'enable' : 'disable'} Auto Assign</p>
                <input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="CONFIRM"
                  className="border rounded px-3 py-2 text-sm w-full" />
                <div className="flex gap-2">
                  <button disabled={confirmText !== 'CONFIRM'} onClick={() => toggleMutation.mutate()}
                    className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50">Confirm</button>
                  <button onClick={() => { setShowConfirm(false); setConfirmText(''); }}
                    className="px-4 py-2 rounded border text-sm">Cancel</button>
                </div>
              </div>
            )}
          </Section>

          <Section title="Default Driver Pay">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Pay Type">
                <select value={payForm.default_driver_pay_type}
                  onChange={e => setPayForm(p => ({ ...p, default_driver_pay_type: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="FIXED">Fixed Amount</option>
                </select>
              </Field>
              <Field label={payForm.default_driver_pay_type === 'PERCENTAGE' ? 'Percentage (%)' : 'Amount ($)'}>
                <input type="number" value={payForm.default_driver_pay_value}
                  onChange={e => setPayForm(p => ({ ...p, default_driver_pay_value: parseFloat(e.target.value) }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </Field>
            </div>
            <button onClick={() => payMutation.mutate()}
              disabled={payMutation.isPending}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-60 flex items-center gap-2">
              {payMutation.isPending && <InlineSpinner />} Save
            </button>
          </Section>
        </div>
      )}

      {/* ── Tab: Invoice Defaults ─────────────────────────────────────────── */}
      {activeTab === 'Invoice Defaults' && (
        <div className="space-y-6">
          <Section title="Invoice Notes & Footer">
            <p className="text-xs text-gray-500 -mt-2">
              These appear on every customer invoice you generate.
            </p>
            <Field label="Payment Instructions / Notes" hint="e.g. 'Payment due within 7 days. Thank you for your business.'">
              <textarea rows={3} className="w-full border rounded-lg px-3 py-2 text-sm"
                value={invoiceForm.invoice_notes}
                onChange={e => setInvoiceForm(f => ({ ...f, invoice_notes: e.target.value }))}
                placeholder="Thank you for choosing AS Chauffeured. Payment is due within 7 days of invoice date." />
            </Field>
            <Field label="Invoice Footer" hint="e.g. ABN / terms / small print">
              <textarea rows={2} className="w-full border rounded-lg px-3 py-2 text-sm"
                value={invoiceForm.invoice_footer}
                onChange={e => setInvoiceForm(f => ({ ...f, invoice_footer: e.target.value }))}
                placeholder="AS Concierges Pty Ltd · ABN 12 345 678 901 · All prices include GST" />
            </Field>
            <button onClick={() => bizMutation.mutate(invoiceForm)}
              disabled={bizMutation.isPending}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-60 flex items-center gap-2">
              {bizMutation.isPending && <InlineSpinner />} Save Invoice Defaults
            </button>
          </Section>

          {/* Preview */}
          <Section title="Invoice Header Preview">
            <div className="border rounded-lg p-5 space-y-3 bg-gray-50 text-sm">
              {bizForm.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={bizForm.logo_url} alt="logo" className="h-10 object-contain mb-2" />
              )}
              <div>
                <div className="font-bold text-gray-900 text-base">{bizForm.business_name || 'Your Business Name'}</div>
                {bizForm.abn && <div className="text-gray-500">ABN: {bizForm.abn}</div>}
                {bizForm.address_line1 && <div className="text-gray-500">{bizForm.address_line1}{bizForm.address_line2 ? `, ${bizForm.address_line2}` : ''}</div>}
                {(bizForm.city || bizForm.state || bizForm.postcode) && (
                  <div className="text-gray-500">{[bizForm.city, bizForm.state, bizForm.postcode].filter(Boolean).join(' ')}, {bizForm.country}</div>
                )}
                {bizForm.phone && <div className="text-gray-500">📞 {bizForm.phoneCode} {bizForm.phone}</div>}
                {bizForm.email && <div className="text-gray-500">✉ {bizForm.email}</div>}
              </div>
              {invoiceForm.invoice_notes && (
                <div className="border-t pt-2 text-gray-500 text-xs">{invoiceForm.invoice_notes}</div>
              )}
              {invoiceForm.invoice_footer && (
                <div className="border-t pt-2 text-gray-400 text-xs italic">{invoiceForm.invoice_footer}</div>
              )}
            </div>
          </Section>
        </div>
      )}

      {/* ── Tab: Banking ─────────────────────────────────────────────────── */}
      {activeTab === 'Banking' && (
        <div className="space-y-6">
          <Section title="Bank Account Details">
            <p className="text-xs text-gray-500 -mt-2">
              Shown on customer invoices for direct bank transfer payments.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Bank Name">
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={bankForm.bank_name}
                  onChange={e => setBankForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="Commonwealth Bank" />
              </Field>
              <Field label="Account Name">
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={bankForm.bank_account_name}
                  onChange={e => setBankForm(f => ({ ...f, bank_account_name: e.target.value }))} placeholder="AS Concierges Pty Ltd" />
              </Field>
              <Field label="BSB">
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={bankForm.bank_bsb}
                  onChange={e => setBankForm(f => ({ ...f, bank_bsb: e.target.value }))} placeholder="062-000" />
              </Field>
              <Field label="Account Number">
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={bankForm.bank_account_number}
                  onChange={e => setBankForm(f => ({ ...f, bank_account_number: e.target.value }))} placeholder="1234 5678" />
              </Field>
            </div>
            <button onClick={() => bizMutation.mutate(bankForm)}
              disabled={bizMutation.isPending}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-60 flex items-center gap-2">
              {bizMutation.isPending && <InlineSpinner />} Save Banking Details
            </button>
          </Section>

          {/* EFT Preview */}
          {(bankForm.bank_name || bankForm.bank_bsb) && (
            <Section title="EFT Preview (shown on invoices)">
              <div className="border rounded-lg p-4 bg-gray-50 text-sm space-y-1">
                <p className="font-semibold text-gray-700">Pay via Bank Transfer (EFT)</p>
                {bankForm.bank_name && <p className="text-gray-600">Bank: {bankForm.bank_name}</p>}
                {bankForm.bank_account_name && <p className="text-gray-600">Account Name: {bankForm.bank_account_name}</p>}
                {bankForm.bank_bsb && <p className="text-gray-600">BSB: {bankForm.bank_bsb}</p>}
                {bankForm.bank_account_number && <p className="text-gray-600">Account No: {bankForm.bank_account_number}</p>}
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
