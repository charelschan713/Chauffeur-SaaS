'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import Link from 'next/link';
import { AuthShell, AuthLogo, AuthCard, GoldButton, ErrorAlert, inputCls, labelCls } from '@/components/AuthLogo';

export function LoginClient() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({ email: '', password: '' });
  const [tenantSlug, setTenantSlug] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cookieSlug = document.cookie.split('; ').find(r => r.startsWith('tenant_slug='))?.split('=')[1];
    const slug = cookieSlug || localStorage.getItem('tenant_slug') || '';
    if (slug) setTenantSlug(slug);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/customer-auth/login', { tenantSlug, email: form.email, password: form.password });
      setAuth(data.accessToken, data.customerId, tenantSlug);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <AuthLogo subtitle="Sign in to your account" />
      <AuthCard>
        {error && <ErrorAlert message={error} />}
        <form onSubmit={submit} className="space-y-5">
          {!tenantSlug && (
            <div>
              <label className={labelCls}>Company</label>
              <input className={inputCls} value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} placeholder="your-company" required />
            </div>
          )}
          <div>
            <label className={labelCls}>Email address</label>
            <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="your@email.com" required />
          </div>
          <div>
            <label className={labelCls}>Password</label>
            <input type="password" className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" required />
          </div>
          <GoldButton type="submit" loading={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </GoldButton>
        </form>
        <div className="mt-6 space-y-2 text-center">
          <p className="text-sm text-white/30">
            <Link href="/forgot-password" className="text-[#c8a96b]/70 hover:text-[#c8a96b] transition-colors">Forgot password?</Link>
          </p>
          <p className="text-sm text-white/30">
            No account?{' '}
            <Link href="/register" className="text-[#c8a96b]/70 hover:text-[#c8a96b] transition-colors">Register</Link>
          </p>
        </div>
      </AuthCard>
    </AuthShell>
  );
}
