'use client';
/**
 * GuestActivateOtp — phone OTP verification shown on the booking confirmation (done) step.
 * Lets a guest verify their phone to activate their account and track bookings.
 * Extracted from BookPageClient.tsx.
 */
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';

interface GuestActivateOtpProps {
  email:       string;
  phoneCode:   string;
  phone:       string;
  bookingRef:  string;
  onActivated: () => void;
}

export function GuestActivateOtp({
  email, phoneCode, phone, bookingRef, onActivated,
}: GuestActivateOtpProps) {
  const [stage, setStage]         = useState<'prompt' | 'otp' | 'done'>('prompt');
  const [otp, setOtp]             = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const sendOtp = async () => {
    setLoading(true); setError('');
    try {
      await api.post('/customer-portal/auth/send-otp', {
        phone_country_code: phoneCode, phone_number: phone,
      });
      setStage('otp');
      setCountdown(60);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to send OTP');
    } finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    if (!otp.trim()) return;
    setLoading(true); setError('');
    try {
      const { data } = await api.post('/customer-portal/auth/verify-otp', {
        phone_country_code: phoneCode,
        phone_number: phone,
        otp_code: otp.trim(),
      });
      if (data.accessToken) {
        localStorage.setItem('customer_token', data.accessToken);
        if (data.customerId)   localStorage.setItem('customer_id',    data.customerId);
        if (data.refreshToken) localStorage.setItem('refreshToken',   data.refreshToken);
        useAuthStore.getState().hydrate();
        setStage('done');
        setTimeout(onActivated, 1200);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Invalid OTP. Please try again.');
    } finally { setLoading(false); }
  };

  if (stage === 'done') {
    return (
      <div className="w-full rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-4 text-center">
        <p className="text-emerald-400 font-medium text-sm">Activated! Redirecting…</p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] px-5 py-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-white">Track your booking</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Verify your phone number to access your bookings anytime.
        </p>
      </div>

      {stage === 'prompt' && (
        <>
          <div className="rounded-xl bg-[hsl(var(--card))] px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">
            {phoneCode} {phone}
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <Button size="lg" className="w-full" onClick={sendOtp} disabled={loading}>
            {loading ? 'Sending…' : 'Send OTP to my phone'}
          </Button>
        </>
      )}

      {stage === 'otp' && (
        <>
          <p className="text-xs text-gray-500">
            Enter the 6-digit code sent to {phoneCode} {phone}
          </p>
          <input
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            className="w-full text-center text-2xl tracking-[0.5em] font-mono rounded-xl border border-gray-100 bg-white/5 px-4 py-3 text-[#1a1a1a] placeholder-white/20 focus:outline-none focus:border-[hsl(var(--primary)/0.6)]"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <Button size="lg" className="w-full" onClick={verifyOtp} disabled={loading || otp.length < 6}>
            {loading ? 'Verifying…' : 'Verify & View Booking'}
          </Button>
          <button
            onClick={countdown > 0 ? undefined : sendOtp}
            disabled={countdown > 0}
            className="w-full text-center text-xs text-gray-400 disabled:opacity-50"
          >
            {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
          </button>
        </>
      )}
    </div>
  );
}
