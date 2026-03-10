'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Toast } from '@/components/ui/Toast';

// ── Helpers ───────────────────────────────────────────────────────────────────

function Field({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function Section({ title, description, children, badge }: {
  title: string; description?: string; children: React.ReactNode; badge?: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
        </div>
        {badge}
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  );
}

function ReadinessBadge({ ready }: { ready: boolean }) {
  return ready
    ? <span className="inline-flex items-center gap-1 text-xs font-semibold bg-green-100 text-green-800 px-2 py-1 rounded-full">✅ Ready</span>
    : <span className="inline-flex items-center gap-1 text-xs font-semibold bg-red-100 text-red-700 px-2 py-1 rounded-full">❌ Incomplete</span>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between py-2 cursor-pointer">
      <span className="text-sm text-gray-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}
      >
        <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
    </label>
  );
}

const AU_TIMEZONES = ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Perth', 'Australia/Adelaide', 'UTC'];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InvoiceSettingsPage() {
  const qc = useQueryClient();
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  // ── Readiness ───────────────────────────────────────────────────────────
  const { data: readiness, refetch: refetchReadiness } = useQuery({
    queryKey: ['invoice-readiness'],
    queryFn: async () => { const res = await api.get('/tenants/invoice-readiness'); return res.data; },
  });

  // ── Company profile ─────────────────────────────────────────────────────
  const { data: biz, isLoading: bizLoading } = useQuery({
    queryKey: ['tenant-business'],
    queryFn: async () => { const res = await api.get('/tenants/business'); return res.data; },
  });

  const emptyCompany = {
    business_name: '', trading_name: '', abn: '',
    is_gst_registered: false,
    address_line1: '', address_line2: '', city: '', state: '', postcode: '', country: 'Australia',
    phone: '', email: '', website: '', logo_url: '',
    accounts_contact_name: '', support_email: '', company_profile_short: '',
    bank_name: '', bank_account_name: '', bank_bsb: '', bank_account_number: '',
  };

  const [companyForm, setCompanyForm] = useState(emptyCompany);

  useEffect(() => {
    if (biz) {
      setCompanyForm({
        business_name:         biz.business_name ?? '',
        trading_name:          biz.trading_name ?? '',
        abn:                   biz.abn ?? '',
        is_gst_registered:     biz.is_gst_registered ?? false,
        address_line1:         biz.address_line1 ?? '',
        address_line2:         biz.address_line2 ?? '',
        city:                  biz.city ?? '',
        state:                 biz.state ?? '',
        postcode:              biz.postcode ?? '',
        country:               biz.country ?? 'Australia',
        phone:                 biz.phone ?? '',
        email:                 biz.email ?? '',
        website:               biz.website ?? '',
        logo_url:              biz.logo_url ?? '',
        accounts_contact_name: biz.accounts_contact_name ?? '',
        support_email:         biz.support_email ?? '',
        company_profile_short: biz.company_profile_short ?? '',
        bank_name:             biz.bank_name ?? '',
        bank_account_name:     biz.bank_account_name ?? '',
        bank_bsb:              biz.bank_bsb ?? '',
        bank_account_number:   biz.bank_account_number ?? '',
      });
    }
  }, [biz]);

  const companyMutation = useMutation({
    mutationFn: (d: typeof companyForm) => api.patch('/tenants/business', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-business'] });
      qc.invalidateQueries({ queryKey: ['invoice-readiness'] });
      setToast({ message: 'Company profile saved', tone: 'success' });
      refetchReadiness();
    },
    onError: () => setToast({ message: 'Failed to save company profile', tone: 'error' }),
  });

  // ── Invoice profile ─────────────────────────────────────────────────────
  const { data: invoiceProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['invoice-profile'],
    queryFn: async () => { const res = await api.get('/tenants/invoice-profile'); return res.data; },
  });

  const emptyInvoiceProfile = {
    invoice_prefix: 'INV', invoice_terms_days: 7, currency: 'AUD', timezone: 'Australia/Sydney',
    payment_note: '', stripe_invoice_enabled: false,
    invoice_header_title: '', invoice_footer_note: '', thank_you_message: '',
    show_logo: true, show_legal_name: true, show_trading_name: true, show_abn: true,
    show_company_profile: false, show_gst_breakdown: true, show_vehicle_details: true,
    show_booking_reference: true, show_payment_instructions: true, show_footer_note: true,
  };

  const [profileForm, setProfileForm] = useState(emptyInvoiceProfile);

  useEffect(() => {
    if (invoiceProfile && invoiceProfile.id) {
      setProfileForm({
        invoice_prefix:          invoiceProfile.invoice_prefix ?? 'INV',
        invoice_terms_days:      invoiceProfile.invoice_terms_days ?? 7,
        currency:                invoiceProfile.currency ?? 'AUD',
        timezone:                invoiceProfile.timezone ?? 'Australia/Sydney',
        payment_note:            invoiceProfile.payment_note ?? '',
        stripe_invoice_enabled:  invoiceProfile.stripe_invoice_enabled ?? false,
        invoice_header_title:    invoiceProfile.invoice_header_title ?? '',
        invoice_footer_note:     invoiceProfile.invoice_footer_note ?? '',
        thank_you_message:       invoiceProfile.thank_you_message ?? '',
        show_logo:               invoiceProfile.show_logo ?? true,
        show_legal_name:         invoiceProfile.show_legal_name ?? true,
        show_trading_name:       invoiceProfile.show_trading_name ?? true,
        show_abn:                invoiceProfile.show_abn ?? true,
        show_company_profile:    invoiceProfile.show_company_profile ?? false,
        show_gst_breakdown:      invoiceProfile.show_gst_breakdown ?? true,
        show_vehicle_details:    invoiceProfile.show_vehicle_details ?? true,
        show_booking_reference:  invoiceProfile.show_booking_reference ?? true,
        show_payment_instructions: invoiceProfile.show_payment_instructions ?? true,
        show_footer_note:        invoiceProfile.show_footer_note ?? true,
      });
    }
  }, [invoiceProfile]);

  const profileMutation = useMutation({
    mutationFn: (d: typeof profileForm) => api.patch('/tenants/invoice-profile', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice-profile'] });
      qc.invalidateQueries({ queryKey: ['invoice-readiness'] });
      setToast({ message: 'Invoice profile saved', tone: 'success' });
      refetchReadiness();
    },
    onError: () => setToast({ message: 'Failed to save invoice profile', tone: 'error' }),
  });

  const setP = (k: keyof typeof profileForm, v: any) =>
    setProfileForm(f => ({ ...f, [k]: v }));

  const isLoading = bizLoading || profileLoading;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}

      <div>
        <h1 className="text-xl font-bold text-gray-900">Invoice Configuration</h1>
        <p className="text-sm text-gray-500 mt-1">
          Company profile and invoice settings. Final invoices can only be generated when all required fields are complete.
        </p>
      </div>

      {/* ── Readiness summary ── */}
      {readiness && (
        <div className={`rounded-xl border p-5 space-y-3 ${readiness.invoice_ready ? 'bg-green-50 border-green-300' : 'bg-amber-50 border-amber-300'}`}>
          <div className="flex items-center justify-between">
            <p className={`font-semibold ${readiness.invoice_ready ? 'text-green-900' : 'text-amber-900'}`}>
              {readiness.invoice_ready ? '✅ Tenant is Invoice-Ready' : '⚠️ Invoice Not Ready — Action Required'}
            </p>
            <ReadinessBadge ready={readiness.invoice_ready} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Company Profile',      data: readiness.company_profile },
              { label: 'Invoice Profile',       data: readiness.invoice_profile },
              { label: 'Payment Instructions',  data: readiness.payment_instruction },
            ].map(({ label, data }) => (
              <div key={label} className={`rounded-lg p-3 text-sm border ${data.ready ? 'bg-white border-green-200' : 'bg-white border-red-200'}`}>
                <div className="flex items-center gap-1.5 font-medium mb-1">
                  <span>{data.ready ? '✅' : '❌'}</span>
                  <span>{label}</span>
                </div>
                {!data.ready && data.missing?.length > 0 && (
                  <ul className="text-xs text-red-700 space-y-0.5 mt-1">
                    {data.missing.map((m: string, i: number) => <li key={i}>• {m}</li>)}
                  </ul>
                )}
                {data.ready && (
                  <p className="text-xs text-green-700">All required fields complete</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading && <div className="text-center text-gray-400 py-8">Loading…</div>}

      {!isLoading && (
        <>
          {/* ── Company Profile ── */}
          <Section
            title="Company Profile"
            description="Your legal business identity. These fields appear on all final invoices and must be complete to issue invoices."
            badge={<ReadinessBadge ready={readiness?.company_profile?.ready ?? false} />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Legal Company Name" required>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={companyForm.business_name}
                  onChange={e => setCompanyForm(f => ({ ...f, business_name: e.target.value }))}
                  placeholder="AS Concierges Pty Ltd" />
              </Field>
              <Field label="Trading Name" hint="If different from legal name">
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={companyForm.trading_name}
                  onChange={e => setCompanyForm(f => ({ ...f, trading_name: e.target.value }))}
                  placeholder="AS Chauffeured" />
              </Field>
              <Field label="ABN" required hint="Australian Business Number — shown on tax invoices">
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={companyForm.abn}
                  onChange={e => setCompanyForm(f => ({ ...f, abn: e.target.value }))}
                  placeholder="12 345 678 901" />
              </Field>
              <Field label="GST Registration">
                <div className="flex items-center gap-2 mt-2">
                  <input type="checkbox" checked={companyForm.is_gst_registered}
                    onChange={e => setCompanyForm(f => ({ ...f, is_gst_registered: e.target.checked }))}
                    className="w-4 h-4 rounded" />
                  <span className="text-sm text-gray-700">Registered for GST</span>
                </div>
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Address Line 1" required>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={companyForm.address_line1}
                  onChange={e => setCompanyForm(f => ({ ...f, address_line1: e.target.value }))}
                  placeholder="Level 10, 123 George Street" />
              </Field>
              <Field label="Address Line 2">
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={companyForm.address_line2}
                  onChange={e => setCompanyForm(f => ({ ...f, address_line2: e.target.value }))} />
              </Field>
              <Field label="Suburb / City" required>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={companyForm.city}
                  onChange={e => setCompanyForm(f => ({ ...f, city: e.target.value }))}
                  placeholder="Sydney" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="State" required>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" value={companyForm.state}
                    onChange={e => setCompanyForm(f => ({ ...f, state: e.target.value }))}>
                    <option value="">Select</option>
                    {['NSW','VIC','QLD','WA','SA','TAS','ACT','NT'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Postcode" required>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" value={companyForm.postcode}
                    onChange={e => setCompanyForm(f => ({ ...f, postcode: e.target.value }))} placeholder="2000" />
                </Field>
              </div>
              <Field label="Accounts Email" required hint="Shown on invoices as reply-to contact">
                <input type="email" className="w-full border rounded-lg px-3 py-2 text-sm" value={companyForm.email}
                  onChange={e => setCompanyForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="accounts@yourcompany.com.au" />
              </Field>
              <Field label="Contact Phone" required>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={companyForm.phone}
                  onChange={e => setCompanyForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+61 2 9000 0000" />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Accounts Contact Name" hint="Optional — name on invoice contact line">
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={companyForm.accounts_contact_name}
                  onChange={e => setCompanyForm(f => ({ ...f, accounts_contact_name: e.target.value }))} />
              </Field>
              <Field label="Support Email" hint="Optional — customer-facing support email">
                <input type="email" className="w-full border rounded-lg px-3 py-2 text-sm" value={companyForm.support_email}
                  onChange={e => setCompanyForm(f => ({ ...f, support_email: e.target.value }))} />
              </Field>
              <Field label="Logo URL" hint="Optional — shown on PDF invoices if display toggle is on">
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={companyForm.logo_url}
                  onChange={e => setCompanyForm(f => ({ ...f, logo_url: e.target.value }))} placeholder="https://…" />
              </Field>
              <Field label="Website">
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={companyForm.website}
                  onChange={e => setCompanyForm(f => ({ ...f, website: e.target.value }))} placeholder="https://…" />
              </Field>
            </div>

            <div className="pt-2">
              <button
                onClick={() => companyMutation.mutate(companyForm)}
                disabled={companyMutation.isPending}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {companyMutation.isPending ? 'Saving…' : 'Save Company Profile'}
              </button>
            </div>
          </Section>

          {/* ── Bank / Payment Instruction ── */}
          <Section
            title="Payment Instructions"
            description="At least one payment path is required for invoice readiness: bank transfer, Stripe, or custom note."
            badge={<ReadinessBadge ready={readiness?.payment_instruction?.ready ?? false} />}
          >
            <p className="text-xs text-gray-500 -mt-1">
              Payment path: {readiness?.payment_instruction?.path ?? 'none'} —{' '}
              {readiness?.payment_instruction?.ready ? '✅ satisfied' : '❌ not satisfied'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Bank Name">
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={companyForm.bank_name}
                  onChange={e => setCompanyForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="Commonwealth Bank" />
              </Field>
              <Field label="Account Name">
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={companyForm.bank_account_name}
                  onChange={e => setCompanyForm(f => ({ ...f, bank_account_name: e.target.value }))} />
              </Field>
              <Field label="BSB">
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={companyForm.bank_bsb}
                  onChange={e => setCompanyForm(f => ({ ...f, bank_bsb: e.target.value }))} placeholder="062-000" />
              </Field>
              <Field label="Account Number">
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={companyForm.bank_account_number}
                  onChange={e => setCompanyForm(f => ({ ...f, bank_account_number: e.target.value }))} />
              </Field>
            </div>
            <div className="pt-2">
              <button
                onClick={() => companyMutation.mutate(companyForm)}
                disabled={companyMutation.isPending}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {companyMutation.isPending ? 'Saving…' : 'Save Bank Details'}
              </button>
            </div>
          </Section>

          {/* ── Invoice Profile ── */}
          <Section
            title="Invoice Profile"
            description="Invoice-specific configuration: numbering, terms, and display options."
            badge={<ReadinessBadge ready={readiness?.invoice_profile?.ready ?? false} />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Invoice Prefix" required hint="Appears before invoice number (e.g. INV-00001)">
                <input className="w-full border rounded-lg px-3 py-2 text-sm" value={profileForm.invoice_prefix}
                  onChange={e => setP('invoice_prefix', e.target.value.toUpperCase())} placeholder="INV" />
              </Field>
              <Field label="Payment Terms (days)" required hint="Days after issue date that payment is due">
                <input type="number" min={0} className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={profileForm.invoice_terms_days}
                  onChange={e => setP('invoice_terms_days', parseInt(e.target.value) || 7)} />
              </Field>
              <Field label="Currency" required>
                <select className="w-full border rounded-lg px-3 py-2 text-sm" value={profileForm.currency}
                  onChange={e => setP('currency', e.target.value)}>
                  {['AUD','NZD','USD','GBP','EUR'].map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Timezone" required>
                <select className="w-full border rounded-lg px-3 py-2 text-sm" value={profileForm.timezone}
                  onChange={e => setP('timezone', e.target.value)}>
                  {AU_TIMEZONES.map(tz => <option key={tz}>{tz}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Invoice Header Title" hint="Optional — override 'TAX INVOICE' heading if needed">
              <input className="w-full border rounded-lg px-3 py-2 text-sm" value={profileForm.invoice_header_title}
                onChange={e => setP('invoice_header_title', e.target.value)} placeholder="TAX INVOICE" />
            </Field>
            <Field label="Thank You Message" hint="Optional — shown near the top of invoice">
              <input className="w-full border rounded-lg px-3 py-2 text-sm" value={profileForm.thank_you_message}
                onChange={e => setP('thank_you_message', e.target.value)}
                placeholder="Thank you for choosing our services." />
            </Field>
            <Field label="Invoice Footer Note" hint="Optional — shown at the bottom of each invoice">
              <textarea rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                value={profileForm.invoice_footer_note}
                onChange={e => setP('invoice_footer_note', e.target.value)}
                placeholder="Payment due within 7 days of invoice date. Thank you for your business." />
            </Field>
            <Field label="Custom Payment Note" hint="Optional — if not using bank transfer. Shown on invoice payment section.">
              <textarea rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                value={profileForm.payment_note}
                onChange={e => setP('payment_note', e.target.value)}
                placeholder="Payment via card link will be sent separately." />
            </Field>

            {/* Display toggles */}
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Invoice Display Toggles</p>
              <p className="text-xs text-gray-400 mb-3">
                The platform controls the invoice template structure. These toggles allow you to show/hide specific data sections.
              </p>
              <div className="divide-y divide-gray-100">
                {[
                  { k: 'show_logo',                 l: 'Show company logo'             },
                  { k: 'show_legal_name',            l: 'Show legal company name'       },
                  { k: 'show_trading_name',          l: 'Show trading name'             },
                  { k: 'show_abn',                   l: 'Show ABN'                      },
                  { k: 'show_gst_breakdown',         l: 'Show GST breakdown'            },
                  { k: 'show_booking_reference',     l: 'Show booking reference'        },
                  { k: 'show_vehicle_details',       l: 'Show vehicle details'          },
                  { k: 'show_payment_instructions',  l: 'Show payment instructions'     },
                  { k: 'show_footer_note',           l: 'Show footer note'              },
                  { k: 'show_company_profile',       l: 'Show company description'      },
                ].map(({ k, l }) => (
                  <Toggle key={k} label={l}
                    checked={profileForm[k as keyof typeof profileForm] as boolean}
                    onChange={v => setP(k as any, v)} />
                ))}
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => profileMutation.mutate(profileForm)}
                disabled={profileMutation.isPending}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {profileMutation.isPending ? 'Saving…' : 'Save Invoice Profile'}
              </button>
            </div>
          </Section>

          {/* ── Template Ownership Notice ── */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Platform Template Ownership</p>
            <p className="text-xs text-gray-500">
              The invoice PDF layout, structure, section ordering, typography, totals block, and visual composition
              are owned and standardized by the platform. Tenants control company data, payment instructions,
              and the display toggles above. No custom invoice layouts are supported.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
