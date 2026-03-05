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
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Reset password</h1>
        {sent ? (
          <p className="text-green-700 bg-green-50 rounded p-3 text-sm">
            If that email is registered, you&apos;ll receive a reset link shortly.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {error && <p className="text-sm text-red-600 bg-red-50 rounded p-3">{error}</p>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading} className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        )}
        <p className="mt-4 text-sm text-center">
          <Link href="/login" className="text-blue-600 hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
