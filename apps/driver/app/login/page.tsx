'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuthStore } from '@/lib/auth-store';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://chauffeur-saas-production.up.railway.app';

type Mode = 'password' | 'otp';
type OtpStep = 'email' | 'code';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpStep, setOtpStep] = useState<OtpStep>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Password login ────────────────────────────────────────────────────────
  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data } = await axios.post(`${API}/auth/mobile/login`, { email, password });
      await finishLogin(data.access_token, data.refresh_token);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Login failed');
    } finally { setLoading(false); }
  };

  // ── Email OTP ─────────────────────────────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await axios.post(`${API}/auth/mobile/otp/send`, { email: otpEmail });
      setOtpStep('code');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Failed to send code');
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data } = await axios.post(`${API}/auth/mobile/otp/verify`, { email: otpEmail, otp: otpCode });
      await finishLogin(data.access_token, data.refresh_token);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Invalid code');
    } finally { setLoading(false); }
  };

  // ── Finish login — verify driver role ─────────────────────────────────────
  const finishLogin = async (accessToken: string, refreshToken: string) => {
    const { data: me } = await axios.get(`${API}/driver-app/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    localStorage.setItem('driver_refresh_token', refreshToken);
    setAuth(accessToken, me.driver_id, me.full_name);
    router.push('/dashboard');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#1A1A2E', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <p style={{ color: '#C8A870', fontSize: 22, fontWeight: 300, letterSpacing: 4, marginBottom: 4 }}>ASCHAUFFEURED</p>
          <p style={{ color: '#9CA3AF', fontSize: 11, letterSpacing: 3, margin: 0 }}>DRIVER PORTAL</p>
          <div style={{ width: 48, height: 1, background: '#C8A870', margin: '12px auto 0' }} />
        </div>

        {/* Mode tabs */}
        <div style={{ display: 'flex', background: '#222236', borderRadius: 10, border: '0.5px solid #333355', marginBottom: 24, overflow: 'hidden' }}>
          {(['password', 'otp'] as Mode[]).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); setOtpStep('email'); }}
              style={{ flex: 1, padding: '12px 0', background: mode === m ? '#333355' : 'transparent',
                color: mode === m ? '#C8A870' : '#9CA3AF', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: mode === m ? 600 : 400 }}>
              {m === 'password' ? 'Password' : 'Email OTP'}
            </button>
          ))}
        </div>

        {/* Forms */}
        <div style={{ background: '#222236', borderRadius: 16, padding: 24, border: '0.5px solid #333355' }}>

          {mode === 'password' && (
            <form onSubmit={handlePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Email" value={email} onChange={setEmail} type="email" />
              <Field label="Password" value={password} onChange={setPassword} type="password" />
              {error && <p style={{ color: '#EF4444', fontSize: 13, margin: 0 }}>{error}</p>}
              <GoldButton loading={loading} disabled={!email || !password}>Sign In</GoldButton>
            </form>
          )}

          {mode === 'otp' && otpStep === 'email' && (
            <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Email Address" value={otpEmail} onChange={setOtpEmail} type="email" placeholder="driver@example.com" />
              {error && <p style={{ color: '#EF4444', fontSize: 13, margin: 0 }}>{error}</p>}
              <GoldButton loading={loading} disabled={!otpEmail}>Send Code</GoldButton>
            </form>
          )}

          {mode === 'otp' && otpStep === 'code' && (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ color: '#9CA3AF', fontSize: 13, margin: 0 }}>Code sent to <strong style={{ color: '#fff' }}>{otpEmail}</strong></p>
              <Field label="6-Digit Code" value={otpCode} onChange={setOtpCode} type="text"
                placeholder="000000" maxLength={6} style={{ textAlign: 'center', letterSpacing: 8, fontSize: 24, fontWeight: 700 }} />
              {error && <p style={{ color: '#EF4444', fontSize: 13, margin: 0 }}>{error}</p>}
              <GoldButton loading={loading} disabled={otpCode.length !== 6}>Verify & Sign In</GoldButton>
              <button type="button" onClick={() => { setOtpStep('email'); setOtpCode(''); setError(''); }}
                style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: 12, cursor: 'pointer', padding: 0 }}>
                ← Change email
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 12, marginTop: 20 }}>
          Driver support: +61 415 880 519
        </p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type, placeholder, maxLength, style: extraStyle }: any) {
  return (
    <div>
      <label style={{ display: 'block', color: '#9CA3AF', fontSize: 12, fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} maxLength={maxLength} autoComplete={type === 'password' ? 'current-password' : 'email'}
        style={{ width: '100%', padding: '12px 14px', background: '#1A1A2E', border: '1px solid #333355', borderRadius: 10,
          color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box', ...extraStyle }} />
    </div>
  );
}

function GoldButton({ children, loading, disabled }: any) {
  return (
    <button type="submit" disabled={disabled || loading}
      style={{ width: '100%', padding: '14px 0', background: disabled || loading ? '#C8A87060' : '#C8A870',
        color: '#000', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 14,
        cursor: disabled || loading ? 'not-allowed' : 'pointer', transition: 'opacity 0.2s' }}>
      {loading ? 'Please wait...' : children}
    </button>
  );
}
