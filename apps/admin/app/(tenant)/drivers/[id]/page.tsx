'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Toast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { InlineSpinner } from '@/components/ui/LoadingSpinner';

const AU_STATES = ['NSW','VIC','QLD','WA','SA','TAS','ACT','NT'];
const TABS = ['Personal','Licence & Accreditation','Emergency Contact','Banking','Notes'] as const;
type Tab = typeof TABS[number];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function Inp({ value, onChange, placeholder, type = 'text', disabled }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      disabled={disabled}
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400" />
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  );
}

function ExpiryBadge({ date }: { date?: string | null }) {
  if (!date) return <span className="text-gray-400 text-xs">—</span>;
  const d = new Date(date);
  const now = new Date();
  const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded">Expired</span>;
  if (diff < 30) return <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded">Expires {Math.ceil(diff)}d</span>;
  return <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded">Valid</span>;
}

const empty = {
  first_name: '', last_name: '', phone_country_code: '+61', phone_number: '', email: '',
  dob: '', address_line1: '', address_line2: '', city: '', state: '', postcode: '', avatar_url: '', abn: '',
  driver_license_number: '', driver_license_state: '', driver_license_expiry: '', driver_license_class: '',
  vehicle_hire_license_number: '', vehicle_hire_license_expiry: '',
  emergency_contact_name: '', emergency_contact_phone_code: '+61', emergency_contact_phone: '', emergency_contact_relationship: '',
  bank_name: '', bank_account_name: '', bank_bsb: '', bank_account_number: '',
  notes: '',
};

export default function DriverProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('Personal');
  const [form, setForm] = useState(empty);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['driver-profile', id],
    queryFn: async () => { const res = await api.get(`/drivers/${id}/profile`); return res.data; },
  });

  useEffect(() => {
    if (!profile) return;
    setForm({
      first_name: profile.first_name ?? '',
      last_name: profile.last_name ?? '',
      phone_country_code: profile.phone_country_code ?? '+61',
      phone_number: profile.phone_number ?? '',
      email: profile.email ?? '',
      dob: profile.dob?.slice(0, 10) ?? '',
      address_line1: profile.address_line1 ?? '',
      address_line2: profile.address_line2 ?? '',
      city: profile.city ?? '',
      state: profile.state ?? '',
      postcode: profile.postcode ?? '',
      avatar_url: profile.avatar_url ?? '',
      abn: profile.abn ?? '',
      driver_license_number: profile.driver_license_number ?? '',
      driver_license_state: profile.driver_license_state ?? '',
      driver_license_expiry: profile.driver_license_expiry?.slice(0, 10) ?? '',
      driver_license_class: profile.driver_license_class ?? '',
      vehicle_hire_license_number: profile.vehicle_hire_license_number ?? '',
      vehicle_hire_license_expiry: profile.vehicle_hire_license_expiry?.slice(0, 10) ?? '',
      emergency_contact_name: profile.emergency_contact_name ?? '',
      emergency_contact_phone_code: (() => { const p = profile.emergency_contact_phone ?? ''; const m = p.match(/^(\+\d{1,3})/); return m ? m[1] : '+61'; })(),
      emergency_contact_phone: (() => { const p = profile.emergency_contact_phone ?? ''; return p.replace(/^\+\d{1,3}\s?/, ''); })(),
      emergency_contact_relationship: profile.emergency_contact_relationship ?? '',
      bank_name: profile.bank_name ?? '',
      bank_account_name: profile.bank_account_name ?? '',
      bank_bsb: profile.bank_bsb ?? '',
      bank_account_number: profile.bank_account_number ?? '',
      notes: profile.notes ?? '',
    });
  }, [profile]);

  const set = (key: keyof typeof empty) => (val: string) => setForm(f => ({ ...f, [key]: val }));

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.patch(`/drivers/${id}/profile`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['driver-profile', id] });
      setToast({ message: 'Profile saved', tone: 'success' });
    },
    onError: () => setToast({ message: 'Failed to save', tone: 'error' }),
  });

  function handleSave() {
    const payload = {
      ...form,
      emergency_contact_phone: form.emergency_contact_phone
        ? `${form.emergency_contact_phone_code}${form.emergency_contact_phone}`
        : '',
    };
    saveMutation.mutate(payload);
  }

  const initials = [form.first_name, form.last_name].filter(Boolean).map(n => n[0].toUpperCase()).join('') || '?';

  const statusVariant: Record<string, 'success' | 'warning' | 'neutral' | 'danger'> = {
    active: 'success', inactive: 'neutral', suspended: 'danger',
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!profile) return (
    <div className="text-center py-16 text-gray-400">Driver not found</div>
  );

  return (
    <div className="max-w-2xl space-y-6">
      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}

      {/* Back */}
      <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
        ← Back to Drivers
      </button>

      {/* Header card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-2xl font-bold text-white shrink-0 select-none">
          {form.avatar_url
            ? <img src={form.avatar_url} alt="avatar" className="w-16 h-16 rounded-full object-cover" /> // eslint-disable-line
            : initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xl font-bold text-gray-900">{[form.first_name, form.last_name].filter(Boolean).join(' ') || 'Driver'}</div>
          <div className="text-sm text-gray-500">{form.email}</div>
          <div className="flex gap-2 mt-2 flex-wrap">
            <Badge variant={statusVariant[profile.membership_status] ?? 'neutral'}>
              {profile.membership_status?.charAt(0).toUpperCase() + profile.membership_status?.slice(1)}
            </Badge>
            {profile.joined_at && (
              <span className="text-xs text-gray-400">
                Joined {new Date(profile.joined_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
            {form.abn && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">ABN: {form.abn}</span>}
          </div>
        </div>
        {/* Licence expiry summary */}
        <div className="text-right shrink-0 space-y-1">
          <div className="text-xs text-gray-400">Driver Licence</div>
          <ExpiryBadge date={form.driver_license_expiry} />
          <div className="text-xs text-gray-400 mt-2">VHL</div>
          <ExpiryBadge date={form.vehicle_hire_license_expiry} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b gap-0 overflow-x-auto -mb-2">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── Personal ─────────────────────────────────────────────────────── */}
      {activeTab === 'Personal' && (
        <div className="space-y-5">
          <Section title="Personal Information">
            <div className="grid grid-cols-2 gap-4">
              <Field label="First Name"><Inp value={form.first_name} onChange={set('first_name')} placeholder="John" /></Field>
              <Field label="Last Name"><Inp value={form.last_name} onChange={set('last_name')} placeholder="Smith" /></Field>
            </div>
            <Field label="Email Address"><Inp value={form.email} onChange={() => {}} disabled placeholder="email@example.com" /></Field>
            <Field label="Phone">
              <div className="flex gap-2">
                <select value={form.phone_country_code} onChange={e => set('phone_country_code')(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white w-24 shrink-0">
                  {['+61','+1','+44','+64','+852','+65','+86'].map(c => <option key={c}>{c}</option>)}
                </select>
                <Inp value={form.phone_number} onChange={set('phone_number')} placeholder="412 345 678" />
              </div>
            </Field>
            <Field label="Date of Birth"><Inp type="date" value={form.dob} onChange={set('dob')} /></Field>
            <Field label="ABN" hint="If driver operates as sole trader / company">
              <Inp value={form.abn} onChange={set('abn')} placeholder="12 345 678 901" />
            </Field>
          </Section>

          <Section title="Home Address">
            <Field label="Address Line 1"><Inp value={form.address_line1} onChange={set('address_line1')} placeholder="123 Main St" /></Field>
            <Field label="Address Line 2"><Inp value={form.address_line2} onChange={set('address_line2')} placeholder="(optional)" /></Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="City"><Inp value={form.city} onChange={set('city')} placeholder="Sydney" /></Field>
              <Field label="State">
                <select value={form.state} onChange={e => set('state')(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">—</option>
                  {AU_STATES.map(s => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Postcode"><Inp value={form.postcode} onChange={set('postcode')} placeholder="2000" /></Field>
            </div>
            <Field label="Avatar URL" hint="Direct link to profile photo">
              <Inp value={form.avatar_url} onChange={set('avatar_url')} placeholder="https://..." />
            </Field>
          </Section>

          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <><InlineSpinner /> Saving…</> : 'Save Personal Info'}
          </Button>
        </div>
      )}

      {/* ── Licence & Accreditation ───────────────────────────────────────── */}
      {activeTab === 'Licence & Accreditation' && (
        <div className="space-y-5">
          <Section title="Driver's Licence">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Licence Number">
                <Inp value={form.driver_license_number} onChange={set('driver_license_number')} placeholder="12345678" />
              </Field>
              <Field label="Issuing State">
                <select value={form.driver_license_state} onChange={e => set('driver_license_state')(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">—</option>
                  {AU_STATES.map(s => <option key={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Expiry Date">
                <Inp type="date" value={form.driver_license_expiry} onChange={set('driver_license_expiry')} />
              </Field>
              <Field label="Licence Class" hint="e.g. C, MR, HR, HC, MC">
                <Inp value={form.driver_license_class} onChange={set('driver_license_class')} placeholder="C" />
              </Field>
            </div>
            {form.driver_license_expiry && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                Status: <ExpiryBadge date={form.driver_license_expiry} />
              </div>
            )}
          </Section>

          <Section title="Vehicle Hire Licence (VHL / PDP)" description="Public Passenger/Hire Vehicle accreditation required for commercial transport">
            <div className="grid grid-cols-2 gap-4">
              <Field label="VHL / Accreditation Number">
                <Inp value={form.vehicle_hire_license_number} onChange={set('vehicle_hire_license_number')} placeholder="ACC-123456" />
              </Field>
              <Field label="Expiry Date">
                <Inp type="date" value={form.vehicle_hire_license_expiry} onChange={set('vehicle_hire_license_expiry')} />
              </Field>
            </div>
            {form.vehicle_hire_license_expiry && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                Status: <ExpiryBadge date={form.vehicle_hire_license_expiry} />
              </div>
            )}
          </Section>

          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <><InlineSpinner /> Saving…</> : 'Save Licence Details'}
          </Button>
        </div>
      )}

      {/* ── Emergency Contact ─────────────────────────────────────────────── */}
      {activeTab === 'Emergency Contact' && (
        <div className="space-y-5">
          <Section title="Emergency Contact" description="Person to contact in case of emergency">
            <Field label="Contact Name">
              <Inp value={form.emergency_contact_name} onChange={set('emergency_contact_name')} placeholder="Jane Smith" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Phone Number">
                <div className="flex gap-2">
                  <select value={form.emergency_contact_phone_code} onChange={e => set('emergency_contact_phone_code')(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white w-24 shrink-0">
                    {['+61','+1','+44','+64','+852','+65','+86'].map(c => <option key={c}>{c}</option>)}
                  </select>
                  <Inp value={form.emergency_contact_phone} onChange={set('emergency_contact_phone')} placeholder="412 345 678" />
                </div>
              </Field>
              <Field label="Relationship">
                <select value={form.emergency_contact_relationship}
                  onChange={e => set('emergency_contact_relationship')(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">— Select —</option>
                  {['Spouse','Partner','Parent','Sibling','Child','Friend','Other'].map(r => <option key={r}>{r}</option>)}
                </select>
              </Field>
            </div>

            {/* Preview */}
            {form.emergency_contact_name && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-2">
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-1">Emergency Contact</p>
                <p className="font-semibold text-gray-900">{form.emergency_contact_name}</p>
                {form.emergency_contact_relationship && <p className="text-sm text-gray-600">{form.emergency_contact_relationship}</p>}
                {form.emergency_contact_phone && <p className="text-sm text-gray-700 font-mono mt-1">{form.emergency_contact_phone_code} {form.emergency_contact_phone}</p>}
              </div>
            )}
          </Section>

          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <><InlineSpinner /> Saving…</> : 'Save Emergency Contact'}
          </Button>
        </div>
      )}

      {/* ── Banking ───────────────────────────────────────────────────────── */}
      {activeTab === 'Banking' && (
        <div className="space-y-5">
          <Section title="Bank Account Details" description="For driver pay settlement">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Bank Name">
                <Inp value={form.bank_name} onChange={set('bank_name')} placeholder="Commonwealth Bank" />
              </Field>
              <Field label="Account Name">
                <Inp value={form.bank_account_name} onChange={set('bank_account_name')} placeholder="John Smith" />
              </Field>
              <Field label="BSB">
                <Inp value={form.bank_bsb} onChange={set('bank_bsb')} placeholder="062-000" />
              </Field>
              <Field label="Account Number">
                <Inp value={form.bank_account_number} onChange={set('bank_account_number')} placeholder="1234 5678" />
              </Field>
            </div>
            {(form.bank_bsb || form.bank_account_number) && (
              <div className="bg-gray-50 border rounded-lg p-4 text-sm space-y-1">
                <p className="font-semibold text-gray-700">EFT Details</p>
                {form.bank_name && <p className="text-gray-600">Bank: {form.bank_name}</p>}
                {form.bank_account_name && <p className="text-gray-600">Account: {form.bank_account_name}</p>}
                {form.bank_bsb && <p className="text-gray-600">BSB: {form.bank_bsb}</p>}
                {form.bank_account_number && <p className="text-gray-600">Acc No: {form.bank_account_number}</p>}
              </div>
            )}
          </Section>

          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <><InlineSpinner /> Saving…</> : 'Save Banking Details'}
          </Button>
        </div>
      )}

      {/* ── Notes ─────────────────────────────────────────────────────────── */}
      {activeTab === 'Notes' && (
        <div className="space-y-5">
          <Section title="Internal Notes" description="Admin-only notes about this driver. Not visible to the driver.">
            <textarea rows={8} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.notes} onChange={e => set('notes')(e.target.value)}
              placeholder="Add any internal notes about this driver here…" />
          </Section>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <><InlineSpinner /> Saving…</> : 'Save Notes'}
          </Button>
        </div>
      )}
    </div>
  );
}
