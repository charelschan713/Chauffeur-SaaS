'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Toast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { InlineSpinner } from '@/components/ui/LoadingSpinner';

// ── Helpers ──────────────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function Section({ title, description, children, action }: {
  title: string; description?: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
        </div>
        {action}
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  );
}

const AU_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
const TABS = ['My Account', 'Company Information', 'Owner Contact', 'Domain & Branding'] as const;
type Tab = typeof TABS[number];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const qc = useQueryClient();
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('My Account');

  // ── My Account ─────────────────────────────────────────────────────────
  const [profile, setProfile] = useState({
    first_name: '', last_name: '', phone_country_code: '+61', phone_number: '',
  });
  const [pwd, setPwd] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwdErrors, setPwdErrors] = useState<Record<string, string>>({});

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ['auth-me'],
    queryFn: async () => { const res = await api.get('/auth/me'); return res.data; },
  });

  useEffect(() => {
    if (me) {
      setProfile({
        first_name: me.first_name ?? '',
        last_name: me.last_name ?? '',
        phone_country_code: me.phone_country_code ?? '+61',
        phone_number: me.phone_number ?? '',
      });
    }
  }, [me]);

  const profileMutation = useMutation({
    mutationFn: (d: typeof profile) => api.patch('/auth/profile', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['auth-me'] }); setToast({ message: 'Profile updated', tone: 'success' }); },
    onError: () => setToast({ message: 'Failed to update profile', tone: 'error' }),
  });

  const pwdMutation = useMutation({
    mutationFn: (d: { current_password: string; new_password: string }) => api.patch('/auth/change-password', d),
    onSuccess: () => {
      setPwd({ current_password: '', new_password: '', confirm_password: '' });
      setToast({ message: 'Password changed', tone: 'success' });
    },
    onError: (err: any) => setToast({ message: err?.response?.data?.message ?? 'Failed to change password', tone: 'error' }),
  });

  function handlePasswordSave() {
    const errors: Record<string, string> = {};
    if (!pwd.current_password) errors.current_password = 'Required';
    if (pwd.new_password.length < 8) errors.new_password = 'Min 8 characters';
    if (pwd.new_password !== pwd.confirm_password) errors.confirm_password = 'Passwords do not match';
    setPwdErrors(errors);
    if (Object.keys(errors).length) return;
    pwdMutation.mutate({ current_password: pwd.current_password, new_password: pwd.new_password });
  }

  // Password strength
  const pwdStrength = Math.min(
    (pwd.new_password.length >= 8 ? 1 : 0) +
    (/[A-Z]/.test(pwd.new_password) ? 1 : 0) +
    (/[0-9]/.test(pwd.new_password) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(pwd.new_password) ? 1 : 0), 4
  );

  // ── Business / Company ─────────────────────────────────────────────────
  const { data: biz, isLoading: bizLoading } = useQuery({
    queryKey: ['tenant-business'],
    queryFn: async () => { const res = await api.get('/tenants/business'); return res.data; },
  });

  const emptyBiz = {
    business_name: '', abn: '', address_line1: '', address_line2: '',
    city: '', state: '', postcode: '', country: 'Australia',
    logo_url: '', website: '',
  };
  const emptyOwner = {
    name: '', title: '', phone: '', email: '',
  };
  const emptyDomain = {
    slug: '', custom_domain: '',
  };

  const [bizForm, setBizForm] = useState(emptyBiz);
  const [ownerForm, setOwnerForm] = useState(emptyOwner);
  const [domainForm, setDomainForm] = useState(emptyDomain);

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
        logo_url: biz.logo_url ?? '',
        website: biz.website ?? '',
      });
      // Owner contact stored in biz phone/email
      setOwnerForm({
        name: biz.business_name ?? '',
        title: '',
        phone: biz.phone ?? '',
        email: biz.email ?? '',
      });
      setDomainForm({
        slug: biz.slug ?? '',
        custom_domain: biz.custom_domain ?? '',
      });
    }
  }, [biz]);

  const bizMutation = useMutation({
    mutationFn: (d: any) => api.patch('/tenants/business', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenant-business'] }); setToast({ message: 'Saved successfully', tone: 'success' }); },
    onError: () => setToast({ message: 'Failed to save', tone: 'error' }),
  });

  // ── Avatar initials ─────────────────────────────────────────────────────
  const initials = [profile.first_name, profile.last_name].filter(Boolean)
    .map(n => n[0]?.toUpperCase()).join('') || me?.email?.[0]?.toUpperCase() || '?';

  if (meLoading || bizLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">
      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}

      {/* Header card */}
      <div className="flex items-center gap-5 bg-white border border-gray-200 rounded-xl p-6">
        <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-2xl font-bold text-white select-none shrink-0">
          {biz?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={biz.logo_url} alt="logo" className="w-16 h-16 rounded-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : initials}
        </div>
        <div>
          <div className="text-lg font-semibold text-gray-900">
            {bizForm.business_name || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Admin'}
          </div>
          <div className="text-sm text-gray-500">{me?.email}</div>
          <div className="flex gap-2 mt-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />Admin
            </span>
            {biz?.slug && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium font-mono">
                /{biz.slug}
              </span>
            )}
            {biz?.custom_domain && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                🌐 {biz.custom_domain}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b gap-0 -mb-2">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── My Account ───────────────────────────────────────────────────── */}
      {activeTab === 'My Account' && (
        <div className="space-y-5">
          <Section title="Personal Information" description="Your login name and contact number">
            <div className="grid grid-cols-2 gap-4">
              <Field label="First Name">
                <Input value={profile.first_name} onChange={e => setProfile(p => ({ ...p, first_name: e.target.value }))} placeholder="John" />
              </Field>
              <Field label="Last Name">
                <Input value={profile.last_name} onChange={e => setProfile(p => ({ ...p, last_name: e.target.value }))} placeholder="Smith" />
              </Field>
            </div>
            <Field label="Phone Number">
              <div className="flex gap-2">
                <select value={profile.phone_country_code}
                  onChange={e => setProfile(p => ({ ...p, phone_country_code: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white w-24 shrink-0">
                  {['+61','+1','+44','+64','+852','+65','+86','+81','+82'].map(c => <option key={c}>{c}</option>)}
                </select>
                <Input value={profile.phone_number} onChange={e => setProfile(p => ({ ...p, phone_number: e.target.value }))} placeholder="412 345 678" className="flex-1" />
              </div>
            </Field>
            <Field label="Email Address" hint="Contact platform support to change your email">
              <Input value={me?.email ?? ''} disabled className="bg-gray-50 text-gray-500 cursor-not-allowed" />
            </Field>
            <Button onClick={() => profileMutation.mutate(profile)} disabled={profileMutation.isPending}>
              {profileMutation.isPending ? <><InlineSpinner /> Saving…</> : 'Save Changes'}
            </Button>
          </Section>

          <Section title="Change Password" description="Min 8 characters. Use a strong password.">
            <Field label="Current Password">
              <Input type="password" value={pwd.current_password}
                onChange={e => { setPwd(p => ({ ...p, current_password: e.target.value })); setPwdErrors({}); }}
                placeholder="Enter current password" />
              {pwdErrors.current_password && <p className="text-xs text-red-500 mt-1">{pwdErrors.current_password}</p>}
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="New Password">
                <Input type="password" value={pwd.new_password}
                  onChange={e => { setPwd(p => ({ ...p, new_password: e.target.value })); setPwdErrors({}); }}
                  placeholder="Min. 8 characters" />
                {pwdErrors.new_password && <p className="text-xs text-red-500 mt-1">{pwdErrors.new_password}</p>}
              </Field>
              <Field label="Confirm New Password">
                <Input type="password" value={pwd.confirm_password}
                  onChange={e => { setPwd(p => ({ ...p, confirm_password: e.target.value })); setPwdErrors({}); }}
                  placeholder="Repeat new password" />
                {pwdErrors.confirm_password && <p className="text-xs text-red-500 mt-1">{pwdErrors.confirm_password}</p>}
              </Field>
            </div>
            {pwd.new_password.length > 0 && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${
                      i < pwdStrength
                        ? pwdStrength <= 1 ? 'bg-red-400' : pwdStrength === 2 ? 'bg-orange-400' : pwdStrength === 3 ? 'bg-yellow-400' : 'bg-green-500'
                        : 'bg-gray-200'
                    }`} />
                  ))}
                </div>
                <p className="text-xs text-gray-400">
                  {pwd.new_password.length < 8 ? 'Too short'
                    : !/[A-Z]/.test(pwd.new_password) ? 'Add an uppercase letter'
                    : !/[0-9]/.test(pwd.new_password) ? 'Add a number'
                    : !/[^A-Za-z0-9]/.test(pwd.new_password) ? 'Add a special character'
                    : '✓ Strong password'}
                </p>
              </div>
            )}
            <Button onClick={handlePasswordSave} disabled={pwdMutation.isPending}>
              {pwdMutation.isPending ? <><InlineSpinner /> Changing…</> : 'Change Password'}
            </Button>
          </Section>

          <Section title="Account Information">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Member Since</dt>
                <dd className="font-medium text-gray-900 mt-0.5">
                  {me?.created_at ? new Date(me.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">User ID</dt>
                <dd className="font-mono text-xs text-gray-400 mt-0.5">{me?.id?.slice(0, 8)}…</dd>
              </div>
            </dl>
          </Section>
        </div>
      )}

      {/* ── Company Information ───────────────────────────────────────────── */}
      {activeTab === 'Company Information' && (
        <div className="space-y-5">
          <Section title="Company Identity">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Business / Trading Name *">
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={bizForm.business_name}
                  onChange={e => setBizForm(f => ({ ...f, business_name: e.target.value }))} placeholder="AS Concierges Pty Ltd" />
              </Field>
              <Field label="ABN" hint="11-digit Australian Business Number">
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={bizForm.abn}
                  onChange={e => setBizForm(f => ({ ...f, abn: e.target.value }))} placeholder="12 345 678 901" />
              </Field>
            </div>
            <Field label="Logo URL" hint="Direct link to PNG or SVG logo">
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={bizForm.logo_url}
                onChange={e => setBizForm(f => ({ ...f, logo_url: e.target.value }))} placeholder="https://cdn.example.com/logo.png" />
              {bizForm.logo_url && (
                <div className="mt-2 inline-block p-2 border rounded bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={bizForm.logo_url} alt="logo" className="h-10 object-contain"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}
            </Field>
          </Section>

          <Section title="Business Address">
            <Field label="Address Line 1">
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={bizForm.address_line1}
                onChange={e => setBizForm(f => ({ ...f, address_line1: e.target.value }))} placeholder="Unit 1, 123 George St" />
            </Field>
            <Field label="Address Line 2">
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={bizForm.address_line2}
                onChange={e => setBizForm(f => ({ ...f, address_line2: e.target.value }))} placeholder="(optional)" />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="City / Suburb">
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={bizForm.city}
                  onChange={e => setBizForm(f => ({ ...f, city: e.target.value }))} placeholder="Sydney" />
              </Field>
              <Field label="State">
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={bizForm.state}
                  onChange={e => setBizForm(f => ({ ...f, state: e.target.value }))}>
                  <option value="">—</option>
                  {AU_STATES.map(s => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Postcode">
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={bizForm.postcode}
                  onChange={e => setBizForm(f => ({ ...f, postcode: e.target.value }))} placeholder="2000" />
              </Field>
            </div>
          </Section>

          <div>
            <Button onClick={() => bizMutation.mutate(bizForm)} disabled={bizMutation.isPending}>
              {bizMutation.isPending ? <><InlineSpinner /> Saving…</> : 'Save Company Information'}
            </Button>
          </div>
        </div>
      )}

      {/* ── Owner Contact ─────────────────────────────────────────────────── */}
      {activeTab === 'Owner Contact' && (
        <div className="space-y-5">
          <Section title="Owner / Primary Contact"
            description="This contact appears on invoices and is used for platform communications">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Contact Name">
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={ownerForm.name}
                  onChange={e => setOwnerForm(f => ({ ...f, name: e.target.value }))} placeholder="Charles Chan" />
              </Field>
              <Field label="Title / Role">
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={ownerForm.title}
                  onChange={e => setOwnerForm(f => ({ ...f, title: e.target.value }))} placeholder="Director / Owner" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Business Phone">
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={ownerForm.phone}
                  onChange={e => setOwnerForm(f => ({ ...f, phone: e.target.value }))} placeholder="+61 2 9999 9999" />
              </Field>
              <Field label="Business Email">
                <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={ownerForm.email}
                  onChange={e => setOwnerForm(f => ({ ...f, email: e.target.value }))} placeholder="admin@aschauffeured.com.au" />
              </Field>
            </div>
            <Button onClick={() => bizMutation.mutate({ phone: ownerForm.phone, email: ownerForm.email })}
              disabled={bizMutation.isPending}>
              {bizMutation.isPending ? <><InlineSpinner /> Saving…</> : 'Save Owner Contact'}
            </Button>
          </Section>

          {/* Preview */}
          <Section title="Invoice Contact Preview">
            <div className="bg-gray-50 border rounded-lg p-4 text-sm space-y-1">
              <div className="font-semibold text-gray-900">{bizForm.business_name || 'Company Name'}</div>
              {ownerForm.name && <div className="text-gray-600">Attn: {ownerForm.name}{ownerForm.title ? ` · ${ownerForm.title}` : ''}</div>}
              {ownerForm.phone && <div className="text-gray-600">📞 {ownerForm.phone}</div>}
              {ownerForm.email && <div className="text-gray-600">✉ {ownerForm.email}</div>}
            </div>
          </Section>
        </div>
      )}

      {/* ── Domain & Branding ─────────────────────────────────────────────── */}
      {activeTab === 'Domain & Branding' && (
        <div className="space-y-5">
          <Section title="Platform URLs">
            <Field label="Tenant Slug" hint="Your unique identifier on the platform — contact support to change">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-l-lg px-3 py-2">
                  chauffeur-saas.com/
                </span>
                <input className="flex-1 border border-gray-300 rounded-r-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                  value={domainForm.slug} disabled placeholder="aschauffeured" />
              </div>
            </Field>

            <Field label="Custom Domain" hint="Point your domain DNS to this platform, then enter the domain here. e.g. admin.aschauffeured.com.au">
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={domainForm.custom_domain}
                onChange={e => setDomainForm(f => ({ ...f, custom_domain: e.target.value.toLowerCase().trim() }))}
                placeholder="admin.aschauffeured.com.au" />
            </Field>

            {domainForm.custom_domain && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm space-y-2">
                <p className="font-semibold text-blue-800">DNS Setup Instructions</p>
                <p className="text-blue-700">Add the following CNAME record to your domain registrar:</p>
                <div className="bg-white rounded border border-blue-200 p-3 font-mono text-xs space-y-1">
                  <div className="flex gap-6">
                    <span className="text-gray-500 w-16">Type</span><span>CNAME</span>
                  </div>
                  <div className="flex gap-6">
                    <span className="text-gray-500 w-16">Name</span>
                    <span>{domainForm.custom_domain.split('.')[0]}</span>
                  </div>
                  <div className="flex gap-6">
                    <span className="text-gray-500 w-16">Value</span>
                    <span className="text-blue-600">chauffeur-saas-production.up.railway.app</span>
                  </div>
                </div>
                <p className="text-blue-600 text-xs">DNS changes can take up to 24–48 hours to propagate.</p>
              </div>
            )}

            <Button onClick={() => bizMutation.mutate({ custom_domain: domainForm.custom_domain || null })}
              disabled={bizMutation.isPending}>
              {bizMutation.isPending ? <><InlineSpinner /> Saving…</> : 'Save Domain Settings'}
            </Button>
          </Section>

          <Section title="Branding">
            <Field label="Company Website" hint="Shown on invoices and customer-facing pages">
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={bizForm.website}
                onChange={e => setBizForm(f => ({ ...f, website: e.target.value }))} placeholder="https://aschauffeured.com.au" />
            </Field>
            <Field label="Logo URL" hint="Direct link to PNG/SVG — used across invoices and customer portal">
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={bizForm.logo_url}
                onChange={e => setBizForm(f => ({ ...f, logo_url: e.target.value }))} placeholder="https://cdn.example.com/logo.png" />
              {bizForm.logo_url && (
                <div className="mt-2 inline-block p-3 border rounded-lg bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={bizForm.logo_url} alt="logo" className="h-12 object-contain"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}
            </Field>
            <Button onClick={() => bizMutation.mutate({ website: bizForm.website, logo_url: bizForm.logo_url || null })}
              disabled={bizMutation.isPending}>
              {bizMutation.isPending ? <><InlineSpinner /> Saving…</> : 'Save Branding'}
            </Button>
          </Section>
        </div>
      )}
    </div>
  );
}
