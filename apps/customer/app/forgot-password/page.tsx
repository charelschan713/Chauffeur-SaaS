'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import Link from 'next/link';
import { AuthShell, AuthLogo, AuthCard, GoldButton, ErrorAlert, inputCls, labelCls } from '@/components/AuthLogo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  useEffect(() => {
    // 1. localStorage
    const ls = localStorage.getItem('tenant_slug');
    if (ls) { setTenantSlug(ls); return; }
    // 2. Subdomain (e.g. aschauffeured.chauffeurssolution.com)
    const sub = window.location.hostname.split('.')[0];
    if (sub && sub !== 'www' && sub !== 'localhost' && sub !== 'chauffeurssolution') {
      setTenantSlug(sub);
    }
  }, []);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/customer-auth/forgot-password', { tenantSlug, email });
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <AuthLogo subtitle="Reset your password" />
      <AuthCard>
        {sent ? (
          <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-4 rounded-xl text-sm">
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            If that email is registered, you&apos;ll receive a reset link shortly.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            {error && <ErrorAlert message={error} />}
            <div>
              <label className={labelCls}>Email address</label>
              <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" required />
            </div>
            <GoldButton type="submit" loading={loading}>
              {loading ? 'Sending…' : 'Send Reset Link'}
            </GoldButton>
          </form>
        )}
        <p className="mt-6 text-sm text-center">
          <Link href="/login" className="text-[#c8a96b]/70 hover:text-[#c8a96b] transition-colors text-sm">← Back to sign in</Link>
        </p>
      </AuthCard>
    </AuthShell>
  );
}
