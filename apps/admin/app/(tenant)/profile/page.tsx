'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Toast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
      <div className="pb-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export default function ProfilePage() {
  const qc = useQueryClient();
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  // ── Profile form ──────────────────────────────────────────────────────────
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    phone_country_code: '+61',
    phone_number: '',
  });

  const { data: me, isLoading } = useQuery({
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
    mutationFn: (data: typeof profile) => api.patch('/auth/profile', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth-me'] });
      setToast({ message: 'Profile updated', tone: 'success' });
    },
    onError: () => setToast({ message: 'Failed to update profile', tone: 'error' }),
  });

  // ── Password form ─────────────────────────────────────────────────────────
  const [pwd, setPwd] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwdErrors, setPwdErrors] = useState<Record<string, string>>({});

  const pwdMutation = useMutation({
    mutationFn: (data: { current_password: string; new_password: string }) =>
      api.patch('/auth/change-password', data),
    onSuccess: () => {
      setPwd({ current_password: '', new_password: '', confirm_password: '' });
      setToast({ message: 'Password changed successfully', tone: 'success' });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Failed to change password';
      setToast({ message: msg, tone: 'error' });
    },
  });

  function handlePasswordSave() {
    const errors: Record<string, string> = {};
    if (!pwd.current_password) errors.current_password = 'Required';
    if (pwd.new_password.length < 8) errors.new_password = 'Minimum 8 characters';
    if (pwd.new_password !== pwd.confirm_password) errors.confirm_password = 'Passwords do not match';
    setPwdErrors(errors);
    if (Object.keys(errors).length) return;
    pwdMutation.mutate({ current_password: pwd.current_password, new_password: pwd.new_password });
  }

  // ── Avatar initials ───────────────────────────────────────────────────────
  const initials = [profile.first_name, profile.last_name]
    .filter(Boolean)
    .map(n => n[0]?.toUpperCase())
    .join('') || me?.email?.[0]?.toUpperCase() || '?';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}

      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account details and password</p>
      </div>

      {/* Avatar + email (read-only) */}
      <div className="flex items-center gap-5 bg-white border border-gray-200 rounded-xl p-6">
        <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-2xl font-bold text-white select-none shrink-0">
          {initials}
        </div>
        <div>
          <div className="text-lg font-semibold text-gray-900">
            {[profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Admin'}
          </div>
          <div className="text-sm text-gray-500">{me?.email}</div>
          <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
            Admin
          </div>
        </div>
      </div>

      {/* Personal Info */}
      <Section title="Personal Information" description="Update your name and contact number">
        <div className="grid grid-cols-2 gap-4">
          <Field label="First Name">
            <Input value={profile.first_name} onChange={e => setProfile(p => ({ ...p, first_name: e.target.value }))}
              placeholder="John" />
          </Field>
          <Field label="Last Name">
            <Input value={profile.last_name} onChange={e => setProfile(p => ({ ...p, last_name: e.target.value }))}
              placeholder="Smith" />
          </Field>
        </div>

        <Field label="Phone Number">
          <div className="flex gap-2">
            <select
              value={profile.phone_country_code}
              onChange={e => setProfile(p => ({ ...p, phone_country_code: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white w-24 shrink-0"
            >
              {['+61','+1','+44','+64','+852','+65','+86','+81','+82'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <Input value={profile.phone_number}
              onChange={e => setProfile(p => ({ ...p, phone_number: e.target.value }))}
              placeholder="412 345 678" className="flex-1" />
          </div>
        </Field>

        <Field label="Email Address">
          <div className="flex items-center gap-2">
            <Input value={me?.email ?? ''} disabled className="flex-1 bg-gray-50 text-gray-500 cursor-not-allowed" />
            <span className="text-xs text-gray-400 whitespace-nowrap">Contact support to change</span>
          </div>
        </Field>

        <div className="pt-2">
          <Button
            onClick={() => profileMutation.mutate(profile)}
            disabled={profileMutation.isPending}
          >
            {profileMutation.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </Section>

      {/* Change Password */}
      <Section title="Change Password" description="Use a strong password of at least 8 characters">
        <Field label="Current Password">
          <Input
            type="password"
            value={pwd.current_password}
            onChange={e => { setPwd(p => ({ ...p, current_password: e.target.value })); setPwdErrors({}); }}
            placeholder="Enter current password"
          />
          {pwdErrors.current_password && (
            <p className="text-xs text-red-500 mt-1">{pwdErrors.current_password}</p>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="New Password">
            <Input
              type="password"
              value={pwd.new_password}
              onChange={e => { setPwd(p => ({ ...p, new_password: e.target.value })); setPwdErrors({}); }}
              placeholder="Min. 8 characters"
            />
            {pwdErrors.new_password && (
              <p className="text-xs text-red-500 mt-1">{pwdErrors.new_password}</p>
            )}
          </Field>
          <Field label="Confirm New Password">
            <Input
              type="password"
              value={pwd.confirm_password}
              onChange={e => { setPwd(p => ({ ...p, confirm_password: e.target.value })); setPwdErrors({}); }}
              placeholder="Repeat new password"
            />
            {pwdErrors.confirm_password && (
              <p className="text-xs text-red-500 mt-1">{pwdErrors.confirm_password}</p>
            )}
          </Field>
        </div>

        {/* Password strength indicator */}
        {pwd.new_password.length > 0 && (
          <div className="space-y-1">
            <div className="flex gap-1">
              {[...Array(4)].map((_, i) => {
                const strength = Math.min(
                  (pwd.new_password.length >= 8 ? 1 : 0) +
                  (/[A-Z]/.test(pwd.new_password) ? 1 : 0) +
                  (/[0-9]/.test(pwd.new_password) ? 1 : 0) +
                  (/[^A-Za-z0-9]/.test(pwd.new_password) ? 1 : 0),
                  4
                );
                return (
                  <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i < strength
                      ? strength <= 1 ? 'bg-red-400'
                        : strength === 2 ? 'bg-orange-400'
                        : strength === 3 ? 'bg-yellow-400'
                        : 'bg-green-500'
                      : 'bg-gray-200'
                  }`} />
                );
              })}
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

        <div className="pt-2">
          <Button
            onClick={handlePasswordSave}
            disabled={pwdMutation.isPending}
          >
            {pwdMutation.isPending ? 'Changing…' : 'Change Password'}
          </Button>
        </div>
      </Section>

      {/* Account Info */}
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
  );
}
