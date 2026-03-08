'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { PhoneCountrySelect } from '@/components/PhoneCountrySelect';
import Link from 'next/link';
import { AuthShell, AuthLogo, AuthCard, GoldButton, ErrorAlert, inputCls, labelCls } from '@/components/AuthLogo';

export function RegisterClient() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', phoneCountryCode: '+61', phoneNumber: '' });
  const [tenantSlug, setTenantSlug] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cookieSlug = document.cookie.split('; ').find(r => r.startsWith('tenant_slug='))?.split('=')[1];
    const slug = cookieSlug || localStorage.getItem('tenant_slug');
    if (slug) setTenantSlug(slug);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/customer-auth/register', { tenantSlug, ...form });
      setAuth(data.accessToken, data.customerId, tenantSlug);
      router.push('/verify-email');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <AuthShell>
      <AuthLogo subtitle="Create your account" />
      <AuthCard>
        {error && <ErrorAlert message={error} />}
        <form onSubmit={submit} className="space-y-4">
          {!tenantSlug && (
            <div>
              <label className={labelCls}>Company</label>
              <input className={inputCls} value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} placeholder="your-company" required />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>First name</label>
              <input type="text" className={inputCls} value={form.firstName} onChange={f('firstName')} placeholder="John" required />
            </div>
            <div>
              <label className={labelCls}>Last name</label>
              <input type="text" className={inputCls} value={form.lastName} onChange={f('lastName')} placeholder="Smith" required />
            </div>
          </div>
          <div>
            <label className={labelCls}>Email address</label>
            <input type="email" className={inputCls} value={form.email} onChange={f('email')} placeholder="your@email.com" required />
          </div>
          <div>
            <label className={labelCls}>Phone <span className="normal-case text-white/20 text-xs">(optional)</span></label>
            <div className="flex gap-2">
              <PhoneCountrySelect value={form.phoneCountryCode} onChange={v => setForm(p => ({ ...p, phoneCountryCode: v }))} className="w-28 shrink-0" />
              <input type="tel" className={`${inputCls} flex-1`} value={form.phoneNumber} onChange={f('phoneNumber')} placeholder="4xx xxx xxx" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Password</label>
            <input type="password" className={inputCls} value={form.password} onChange={f('password')} placeholder="Min. 8 characters" required minLength={8} />
          </div>
          <GoldButton type="submit" loading={loading}>
            {loading ? 'Creating…' : 'Create Account'}
          </GoldButton>
        </form>
        <p className="mt-6 text-sm text-center text-white/30">
          Already have an account?{' '}
          <Link href="/login" className="text-[#c8a96b]/70 hover:text-[#c8a96b] transition-colors">Sign in</Link>
        </p>
      </AuthCard>
    </AuthShell>
  );
}
