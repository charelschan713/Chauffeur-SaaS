'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { AuthShell, AuthLogo, AuthCard, GoldButton, ErrorAlert, inputCls, labelCls } from '@/components/AuthLogo';

type Tab = 'password' | 'otp';
type OtpStep = 'email' | 'code';

function decodeSub(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload?.sub ?? null;
  } catch {
    return null;
  }
}

export default function LoginClient() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [tab, setTab] = useState<Tab>('password');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [tenantSlug, setTenantSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [otpStep, setOtpStep] = useState<OtpStep>('email');
  const [otpCode, setOtpCode] = useState('');
  const [countdown, setCountdown] = useState(0);

  const switchTab = (t: Tab) => {
    setTab(t);
    setError('');
    setOtpStep('email');
    setOtpCode('');
    setCountdown(0);
  };

  async function handlePasswordLogin() {
    setLoading(true);
    setError('');
    try {
      if (tenantSlug) document.cookie = `tenant_slug=${tenantSlug}; path=/`;
      const { data } = await api.post('/auth/login', {
        email,
        password,
        tenantSlug: tenantSlug || undefined,
      });
      const driverId = decodeSub(data.accessToken) ?? 'driver';
      setAuth(data.accessToken, driverId, data?.name);
      router.replace('/dashboard');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp() {
    if (!email) return;
    setLoading(true);
    setError('');
    try {
      if (tenantSlug) document.cookie = `tenant_slug=${tenantSlug}; path=/`;
      await api.post('/auth/mobile/otp/send', { email });
      setOtpStep('code');
      setCountdown(60);
      const interval = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(interval);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (!otpCode) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/mobile/otp/verify', {
        email,
        otp: otpCode,
      });
      const driverId = decodeSub(data.access_token) ?? 'driver';
      setAuth(data.access_token, driverId);
      router.replace('/dashboard');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <AuthLogo subtitle="Driver login" />
      <AuthCard>
        {error && <ErrorAlert message={error} />}

        <div className="flex gap-2">
          <button onClick={() => switchTab('password')} className={`flex-1 h-10 rounded-lg text-xs uppercase tracking-widest ${tab === 'password' ? 'bg-white/10 text-white' : 'text-white/40'}`}>
            Password
          </button>
          <button onClick={() => switchTab('otp')} className={`flex-1 h-10 rounded-lg text-xs uppercase tracking-widest ${tab === 'otp' ? 'bg-white/10 text-white' : 'text-white/40'}`}>
            Email OTP
          </button>
        </div>

        <div>
          <label className={labelCls}>Company / Slug</label>
          <input className={inputCls} value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} placeholder="aschauffeured" />
        </div>

        <div>
          <label className={labelCls}>Email</label>
          <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="driver@email.com" />
        </div>

        {tab === 'password' ? (
          <>
            <div>
              <label className={labelCls}>Password</label>
              <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <GoldButton loading={loading} onClick={handlePasswordLogin}>Login</GoldButton>
          </>
        ) : (
          <>
            {otpStep === 'email' ? (
              <GoldButton loading={loading} onClick={handleSendOtp}>Send OTP</GoldButton>
            ) : (
              <>
                <div>
                  <label className={labelCls}>OTP Code</label>
                  <input className={inputCls} value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="123456" />
                </div>
                <GoldButton loading={loading} onClick={handleVerifyOtp}>Verify & Login</GoldButton>
                <button
                  disabled={countdown > 0}
                  onClick={handleSendOtp}
                  className="text-xs text-white/40 mt-2"
                >
                  {countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
                </button>
              </>
            )}
          </>
        )}
      </AuthCard>
    </AuthShell>
  );
}
