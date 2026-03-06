'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import Link from 'next/link';

export function LoginClient() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({ email: '', password: '' });
  const [tenantSlug, setTenantSlug] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cookieSlug = document.cookie
      .split('; ')
      .find(r => r.startsWith('tenant_slug='))
      ?.split('=')[1];
    const slug = cookieSlug || localStorage.getItem('tenant_slug') || '';
    if (slug) setTenantSlug(slug);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/customer-auth/login', {
        tenantSlug,
        email: form.email,
        password: form.password,
      });
      setAuth(data.accessToken, data.customerId, tenantSlug);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0f14] flex items-center justify-center px-4">
      {/* Background radial */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#1a1200_0%,_#0d0f14_60%)] pointer-events-none" />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="flex flex-col items-center gap-1 mb-6">
            <span
              className="text-[#c8a96b] text-base font-medium tracking-[0.18em] uppercase"
              style={{ fontFamily: "'Playfair Display', serif", letterSpacing: '0.18em' }}
            >
              ASCHAUFFEURED
            </span>
            <div className="w-40 h-px bg-[#c8a96b]/50" />
            <span className="text-[#c8a96b]/60 text-[9px] tracking-[0.12em] uppercase italic">
              Mercedes-Benz &amp; Maybach Specialist Chauffeurs
            </span>
          </div>
          <p className="text-white/30 text-sm">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.03] border border-[#c8a96b]/20 rounded-2xl p-8 backdrop-blur-sm shadow-2xl">
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm mb-5">
              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-5">
            {!tenantSlug && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-[#c8a96b]/60 mb-2">
                  Company
                </label>
                <input
                  className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#c8a96b]/50 transition-all"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value)}
                  placeholder="your-company"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-[#c8a96b]/60 mb-2">
                Email address
              </label>
              <input
                type="email"
                className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#c8a96b]/50 transition-all"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="your@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-[#c8a96b]/60 mb-2">
                Password
              </label>
              <input
                type="password"
                className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#c8a96b]/50 transition-all"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 mt-1 rounded-xl font-semibold text-sm tracking-widest uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #c8a96b, #a8853d)', color: '#0d0f14' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-[#0d0f14]/30 border-t-[#0d0f14] rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-center">
            <p className="text-sm text-white/30">
              <Link href="/forgot-password" className="text-[#c8a96b]/70 hover:text-[#c8a96b] transition-colors">
                Forgot password?
              </Link>
            </p>
            <p className="text-sm text-white/30">
              No account?{' '}
              <Link href="/register" className="text-[#c8a96b]/70 hover:text-[#c8a96b] transition-colors">
                Register
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-white/15 mt-8 tracking-widest uppercase">
          © {new Date().getFullYear()} AS Concierges Pty Ltd
        </p>
      </div>
    </div>
  );
}
