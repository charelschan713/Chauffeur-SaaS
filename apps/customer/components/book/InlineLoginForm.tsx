'use client';
/**
 * InlineLoginForm — multi-method login embedded in booking flow.
 * Supports:
 * - Email + Password
 * - Email OTP
 * - SMS OTP
 */
import { useMemo, useState } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

type Mode = 'password' | 'email_otp' | 'sms_otp';

function digitsOnly(v: string) {
  return (v || '').replace(/\D/g, '');
}

function toE164(code: string, localPhone: string) {
  const cc = (code || '+61').trim();
  let n = digitsOnly(localPhone || '');
  if (cc === '+61' && n.startsWith('0')) n = n.slice(1);
  if (n.startsWith('61') && cc === '+61') n = n.slice(2);
  return `${cc}${n}`;
}

interface InlineLoginFormProps {
  onSuccess: () => void;
  onBack: () => void;
}

export function InlineLoginForm({ onSuccess, onBack }: InlineLoginFormProps) {
  const setAuth = useAuthStore((s) => s.setAuth);

  const [mode, setMode] = useState<Mode>('password');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // email+password
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // email otp
  const [otpEmail, setOtpEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);

  // sms otp
  const [phoneCode, setPhoneCode] = useState('+61');
  const [phone, setPhone] = useState('');
  const [smsOtp, setSmsOtp] = useState('');
  const [smsOtpSent, setSmsOtpSent] = useState(false);
  const [smsOtpPhone, setSmsOtpPhone] = useState('');

  const tenantSlug = useMemo(() => {
    if (typeof window === 'undefined') return '';

    const cookieSlug = document.cookie
      .split('; ')
      .find((r) => r.startsWith('tenant_slug='))
      ?.split('=')[1];

    if (cookieSlug) return cookieSlug;

    const host = window.location.hostname;
    if (host.endsWith('.chauffeursolution.com') || host.endsWith('.chauffeurssolution.com')) {
      const sub = host.split('.')[0];
      if (sub && sub !== 'www') return sub;
    }

    const qpSlug = new URLSearchParams(window.location.search).get('tenant_slug');
    return qpSlug || '';
  }, []);

  const loginSuccess = (data: any) => {
    setAuth(data.accessToken || data.access_token, data.customerId || data.customer_id, tenantSlug);
    onSuccess();
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/customer-auth/login', {
        tenantSlug,
        email,
        password,
      });
      loginSuccess(data);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const sendEmailOtp = async () => {
    if (!otpEmail) return;
    setLoading(true);
    setError('');
    try {
      await api.post('/customer-auth/email-otp/send', { tenantSlug, email: otpEmail });
      setEmailOtpSent(true);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Failed to send email OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/customer-auth/email-otp/verify', {
        tenantSlug,
        email: otpEmail,
        otp: emailOtp,
      });
      loginSuccess(data);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Email OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const sendSmsOtp = async () => {
    if (!phone) return;
    setLoading(true);
    setError('');
    try {
      const phoneE164 = toE164(phoneCode, phone);
      await api.post('/customer-auth/otp/send', {
        tenantSlug,
        phone: phoneE164,
      });
      setSmsOtpPhone(phoneE164);
      setSmsOtpSent(true);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Failed to send SMS OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifySmsOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/customer-auth/otp/verify', {
        tenantSlug,
        phoneCode,
        phone: smsOtpPhone || toE164(phoneCode, phone),
        otp: smsOtp,
      });
      loginSuccess(data);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'SMS OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setMode('password')}
          className={`rounded-lg py-2 text-xs font-semibold border ${mode === 'password' ? 'bg-[hsl(var(--primary)/0.18)] border-[hsl(var(--primary)/0.5)] text-[hsl(var(--primary))]' : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]'}`}
        >
          Email Password
        </button>
        <button
          type="button"
          onClick={() => setMode('email_otp')}
          className={`rounded-lg py-2 text-xs font-semibold border ${mode === 'email_otp' ? 'bg-[hsl(var(--primary)/0.18)] border-[hsl(var(--primary)/0.5)] text-[hsl(var(--primary))]' : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]'}`}
        >
          Email OTP
        </button>
        <button
          type="button"
          onClick={() => setMode('sms_otp')}
          className={`rounded-lg py-2 text-xs font-semibold border ${mode === 'sms_otp' ? 'bg-[hsl(var(--primary)/0.18)] border-[hsl(var(--primary)/0.5)] text-[hsl(var(--primary))]' : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]'}`}
        >
          SMS OTP
        </button>
      </div>

      {error && <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>}

      {mode === 'password' && (
        <form onSubmit={submitPassword} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="submit" size="lg" className="flex-1" disabled={loading}>
              {loading && <Spinner className="h-4 w-4 mr-2" />} Sign In
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={onBack}>Back</Button>
          </div>
        </form>
      )}

      {mode === 'email_otp' && (
        <form onSubmit={verifyEmailOtp} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={otpEmail} onChange={(e) => setOtpEmail(e.target.value)} required />
          </div>
          {emailOtpSent && (
            <div className="space-y-1.5">
              <Label>OTP Code</Label>
              <Input value={emailOtp} onChange={(e) => setEmailOtp(e.target.value)} required />
            </div>
          )}

          <div className="flex gap-3 pt-1">
            {!emailOtpSent ? (
              <Button type="button" size="lg" className="flex-1" disabled={loading || !otpEmail} onClick={sendEmailOtp}>
                {loading && <Spinner className="h-4 w-4 mr-2" />} Send OTP
              </Button>
            ) : (
              <Button type="submit" size="lg" className="flex-1" disabled={loading || emailOtp.length < 4}>
                {loading && <Spinner className="h-4 w-4 mr-2" />} Verify & Sign In
              </Button>
            )}
            <Button type="button" variant="outline" size="lg" onClick={onBack}>Back</Button>
          </div>
        </form>
      )}

      {mode === 'sms_otp' && (
        <form onSubmit={verifySmsOtp} className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label>Code</Label>
              <Input value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
          </div>
          {smsOtpSent && (
            <div className="space-y-1.5">
              <Label>OTP Code</Label>
              <Input value={smsOtp} onChange={(e) => setSmsOtp(e.target.value)} required />
            </div>
          )}

          <div className="flex gap-3 pt-1">
            {!smsOtpSent ? (
              <Button type="button" size="lg" className="flex-1" disabled={loading || !phone} onClick={sendSmsOtp}>
                {loading && <Spinner className="h-4 w-4 mr-2" />} Send OTP
              </Button>
            ) : (
              <Button type="submit" size="lg" className="flex-1" disabled={loading || smsOtp.length < 4}>
                {loading && <Spinner className="h-4 w-4 mr-2" />} Verify & Sign In
              </Button>
            )}
            <Button type="button" variant="outline" size="lg" onClick={onBack}>Back</Button>
          </div>
        </form>
      )}
    </div>
  );
}
