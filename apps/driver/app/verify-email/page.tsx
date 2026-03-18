'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AuthShell, AuthLogo, AuthCard, GoldButton, ErrorAlert, inputCls, labelCls } from '@/components/AuthLogo';
import { useAuthStore } from '@/lib/auth-store';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://chauffeur-saas-production.up.railway.app';

function getEmail() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('driver_email');
}

export default function VerifyEmailPage() {
  const router = useRouter();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const setAuth = useAuthStore((s) => s.setAuth);

  // Send OTP on mount
  useEffect(() => {
    const email = getEmail();
    if (!email) { router.replace('/login'); return; }
    handleSend();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handleSend() {
    const email = getEmail();
    if (!email) return;
    setSending(true);
    setError('');
    try {
      await fetch(`${API}/auth/mobile/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setCooldown(60);
    } catch {
      setError('Failed to send verification code. Please try again.');
    } finally {
      setSending(false);
    }
  }

  function handleOtpChange(i: number, val: string) {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[i] = val.slice(-1);
    setOtp(next);
    if (val && i < 5) inputRefs.current[i + 1]?.focus();
  }

  function handleOtpKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  }

  async function handleVerify() {
    const code = otp.join('');
    if (code.length < 6) { setError('Please enter the 6-digit code.'); return; }
    const email = getEmail();
    if (!email) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/auth/mobile/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Verification failed');
      const token = data.access_token ?? data.accessToken;
      if (token) {
        setAuth(token, data?.driver_id ?? 'driver');
      }
      setSuccess(true);
      setTimeout(() => router.replace('/dashboard'), 1500);
    } catch (e: any) {
      setError(e.message ?? 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <AuthLogo subtitle="Verify your email" />
      <AuthCard>
        {success ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white font-semibold text-lg">Email Verified</p>
            <p className="text-gray-400 text-sm mt-1">Redirecting to dashboard…</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-[#c8a96b]/10 border border-[#c8a96b]/20 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-[#c8a96b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm">
                We sent a 6-digit code to your email.<br />Enter it below to verify your account.
              </p>
            </div>

            {error && <ErrorAlert message={error} />}

            {/* OTP inputs */}
            <div className="flex justify-center gap-2">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  className="w-12 h-14 text-center text-2xl font-bold rounded-xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] focus:outline-none focus:border-[#c8a96b]/60 transition-all"
                />
              ))}
            </div>

            <GoldButton loading={loading} onClick={handleVerify}>
              Verify Email
            </GoldButton>

            <div className="text-center">
              <button
                onClick={handleSend}
                disabled={sending || cooldown > 0}
                className="text-sm text-gray-400 hover:text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
              </button>
            </div>
          </div>
        )}
      </AuthCard>
    </AuthShell>
  );
}
