'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  useEffect(() => { setTenantSlug(localStorage.getItem('tenant_slug') ?? ''); }, []);
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
    <div className="min-h-screen bg-[#0d0f14] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#1a1200_0%,_#0d0f14_60%)] pointer-events-none" />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="flex flex-col items-center gap-1 mb-6">
            <span className="text-[#c8a96b] text-base font-medium tracking-[0.18em] uppercase"
              style={{ fontFamily: "'Playfair Display', serif" }}>
              ASCHAUFFEURED
            </span>
            <div className="w-40 h-px bg-[#c8a96b]/50" />
            <span className="text-[#c8a96b]/60 text-[9px] tracking-[0.12em] uppercase italic">
              Mercedes-Benz &amp; Maybach Specialist Chauffeurs
            </span>
          </div>
          <p className="text-white/30 text-sm">Reset your password</p>
        </div>

        <div className="bg-white/[0.03] border border-[#c8a96b]/20 rounded-2xl p-8 backdrop-blur-sm shadow-2xl">
          {sent ? (
            <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-4 rounded-xl text-sm">
              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              If that email is registered, you&apos;ll receive a reset link shortly.
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              {error && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-[#c8a96b]/60 mb-2">
                  Email address
                </label>
                <input
                  type="email"
                  className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#c8a96b]/50 transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl font-semibold text-sm tracking-widest uppercase transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #c8a96b, #a8853d)', color: '#0d0f14' }}
              >
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
          )}

          <p className="mt-6 text-sm text-center">
            <Link href="/login" className="text-[#c8a96b]/70 hover:text-[#c8a96b] transition-colors text-sm">
              ← Back to sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-white/15 mt-8 tracking-widest uppercase">
          © {new Date().getFullYear()} AS Concierges Pty Ltd
        </p>
      </div>
    </div>
  );
}
