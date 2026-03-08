'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import Link from 'next/link';
import { AuthShell, AuthLogo, AuthCard, GoldButton, ErrorAlert, inputCls, labelCls } from '@/components/AuthLogo';

const COUNTRY_CODES = [
  { code: '+61', flag: '🇦🇺', label: 'AU' },
  { code: '+64', flag: '🇳🇿', label: 'NZ' },
  { code: '+1',  flag: '🇺🇸', label: 'US' },
  { code: '+44', flag: '🇬🇧', label: 'UK' },
  { code: '+852',flag: '🇭🇰', label: 'HK' },
  { code: '+86', flag: '🇨🇳', label: 'CN' },
  { code: '+65', flag: '🇸🇬', label: 'SG' },
  { code: '+81', flag: '🇯🇵', label: 'JP' },
  { code: '+971',flag: '🇦🇪', label: 'AE' },
  { code: '+91', flag: '🇮🇳', label: 'IN' },
];

type Tab = 'email' | 'otp';
type OtpStep = 'phone' | 'code';

const tabCls = (active: boolean) =>
  `flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
    active
      ? 'bg-[#c8a96b] text-black'
      : 'text-white/50 hover:text-white/80'
  }`;

const selectCls = `h-full bg-transparent text-white text-sm outline-none cursor-pointer pr-1`;

export function LoginClient() {
  const router   = useRouter();
  const setAuth  = useAuthStore((s) => s.setAuth);
  const [tenantSlug, setTenantSlug] = useState('');
  const [tab, setTab]   = useState<Tab>('email');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Email/password state
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  // OTP state
  const [phoneCode, setPhoneCode] = useState('+61');
  const [phoneNum, setPhoneNum]   = useState('');
  const [otpStep, setOtpStep]     = useState<OtpStep>('phone');
  const [otpCode, setOtpCode]     = useState('');
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    const cookieSlug = document.cookie.split('; ').find(r => r.startsWith('tenant_slug='))?.split('=')[1];
    setTenantSlug(cookieSlug || localStorage.getItem('tenant_slug') || '');
  }, []);

  // Resend countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const switchTab = (t: Tab) => {
    setTab(t); setError('');
    setOtpStep('phone'); setOtpCode(''); setCountdown(0);
  };

  // ── Email login ──────────────────────────────────────────────────────────
  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/customer-auth/login', { tenantSlug, email, password });
      setAuth(data.accessToken, data.customerId, tenantSlug);
      // Check email verification
      try {
        const vRes = await api.get('/customer-portal/verification-status');
        if (!vRes.data?.email_verified) {
          router.push('/verify-email');
          return;
        }
      } catch { /* If check fails, let them in */ }
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Login failed');
    } finally { setLoading(false); }
  };

  // ── OTP: send code ───────────────────────────────────────────────────────
  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNum.trim()) { setError('Please enter your phone number'); return; }
    setError(''); setLoading(true);
    try {
      await api.post('/customer-auth/otp/send', { tenantSlug, phoneCode, phone: phoneNum });
      setOtpStep('code');
      setCountdown(60);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Failed to send OTP');
    } finally { setLoading(false); }
  };

  // ── OTP: verify code ─────────────────────────────────────────────────────
  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length < 6) { setError('Please enter the 6-digit code'); return; }
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/customer-auth/otp/verify', { tenantSlug, phone: phoneNum, otp: otpCode });
      setAuth(data.accessToken, data.customerId, tenantSlug);
      try {
        const vRes = await api.get('/customer-portal/verification-status');
        if (!vRes.data?.email_verified) { router.push('/verify-email'); return; }
      } catch { /* fail open */ }
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Invalid or expired code');
    } finally { setLoading(false); }
  };

  return (
    <AuthShell>
      <AuthLogo subtitle="Sign in to your account" />
      <AuthCard>
        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-6">
          <button type="button" className={tabCls(tab === 'email')} onClick={() => switchTab('email')}>
            Email
          </button>
          <button type="button" className={tabCls(tab === 'otp')} onClick={() => switchTab('otp')}>
            Phone OTP
          </button>
        </div>

        {error && <ErrorAlert message={error} />}

        {/* ── Email / Password ── */}
        {tab === 'email' && (
          <form onSubmit={submitEmail} className="space-y-5">
            {!tenantSlug && (
              <div>
                <label className={labelCls}>Company</label>
                <input className={inputCls} value={tenantSlug} onChange={e => setTenantSlug(e.target.value)} placeholder="your-company" required />
              </div>
            )}
            <div>
              <label className={labelCls}>Email address</label>
              <input type="email" className={inputCls} value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required autoComplete="email" />
            </div>
            <div>
              <label className={labelCls}>Password</label>
              <input type="password" className={inputCls} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
            </div>
            <GoldButton type="submit" loading={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </GoldButton>
          </form>
        )}

        {/* ── OTP: enter phone ── */}
        {tab === 'otp' && otpStep === 'phone' && (
          <form onSubmit={sendOtp} className="space-y-5">
            <div>
              <label className={labelCls}>Mobile number</label>
              <div className="flex gap-0 rounded-[--radius] border border-[hsl(var(--input-border))] bg-[hsl(var(--input))] overflow-hidden focus-within:ring-1 focus-within:ring-[#c8a96b]/50">
                <div className="flex items-center pl-3 pr-2 border-r border-white/10">
                  <select
                    className={selectCls}
                    value={phoneCode}
                    onChange={e => setPhoneCode(e.target.value)}
                  >
                    {COUNTRY_CODES.map(c => (
                      <option key={c.code} value={c.code} style={{ background: '#1a1c23' }}>
                        {c.flag} {c.code}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  type="tel"
                  className="flex-1 bg-transparent text-white text-sm px-3 py-3 outline-none placeholder-white/30"
                  value={phoneNum}
                  onChange={e => setPhoneNum(e.target.value.replace(/\D/g, ''))}
                  placeholder="400 000 000"
                  required
                  autoComplete="tel"
                />
              </div>
              <p className="mt-1.5 text-xs text-white/30">We'll send a 6-digit code via SMS</p>
            </div>
            <GoldButton type="submit" loading={loading}>
              {loading ? 'Sending…' : 'Send Code'}
            </GoldButton>
          </form>
        )}

        {/* ── OTP: enter code ── */}
        {tab === 'otp' && otpStep === 'code' && (
          <form onSubmit={verifyOtp} className="space-y-5">
            <div className="text-center text-sm text-white/50 pb-1">
              Code sent to <span className="text-white/80 font-medium">{phoneCode} {phoneNum}</span>
              <button
                type="button"
                onClick={() => { setOtpStep('phone'); setOtpCode(''); setError(''); }}
                className="ml-2 text-[#c8a96b]/70 hover:text-[#c8a96b] text-xs underline"
              >
                Change
              </button>
            </div>
            <div>
              <label className={labelCls}>6-digit code</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                className={inputCls + ' text-center tracking-[0.4em] text-lg font-mono'}
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                required
                autoComplete="one-time-code"
                autoFocus
              />
            </div>
            <GoldButton type="submit" loading={loading} disabled={otpCode.length < 6}>
              {loading ? 'Verifying…' : 'Verify & Sign In'}
            </GoldButton>
            <div className="text-center">
              {countdown > 0 ? (
                <span className="text-xs text-white/30">Resend in {countdown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={() => { setOtpStep('phone'); setOtpCode(''); setError(''); }}
                  className="text-xs text-[#c8a96b]/70 hover:text-[#c8a96b] transition-colors"
                >
                  Resend code
                </button>
              )}
            </div>
          </form>
        )}

        <div className="mt-6 space-y-2 text-center">
          {tab === 'email' && (
            <p className="text-sm text-white/30">
              <Link href="/forgot-password" className="text-[#c8a96b]/70 hover:text-[#c8a96b] transition-colors">Forgot password?</Link>
            </p>
          )}
          <p className="text-sm text-white/30">
            No account?{' '}
            <Link href="/register" className="text-[#c8a96b]/70 hover:text-[#c8a96b] transition-colors">Register</Link>
          </p>
        </div>
      </AuthCard>
    </AuthShell>
  );
}
