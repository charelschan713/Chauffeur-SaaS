'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import Link from 'next/link';
import { AuthShell, AuthLogo, AuthCard, GoldButton, ErrorAlert, inputCls, labelCls } from '@/components/AuthLogo';

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm)  { setError('Passwords do not match.'); return; }
    if (!token)                { setError('Invalid or missing reset token.'); return; }
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/customer-auth/reset-password', { token, password });
      const accessToken = data?.accessToken ?? data?.access_token;
      if (accessToken) {
        localStorage.setItem('driver_token', accessToken);
        setDone(true);
        setTimeout(() => router.push('/dashboard'), 2000);
      } else {
        setDone(true);
        setTimeout(() => router.push('/login'), 2000);
      }
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <AuthLogo subtitle="Set a new password" />
      <AuthCard>
        {done ? (
          <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-4 rounded-xl text-sm">
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Password updated! Redirecting…
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            {error && <ErrorAlert message={error} />}

            <div>
              <label className={labelCls}>New password</label>
              <input
                type="password"
                className={inputCls}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className={labelCls}>Confirm new password</label>
              <input
                type="password"
                className={inputCls}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter your password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <GoldButton type="submit" loading={loading}>
              {loading ? 'Saving…' : 'Set New Password'}
            </GoldButton>
          </form>
        )}

        <p className="mt-6 text-sm text-center">
          <Link href="/login" className="text-[#c8a96b]/70 hover:text-[#c8a96b] transition-colors text-sm">
            ← Back to sign in
          </Link>
        </p>
      </AuthCard>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
