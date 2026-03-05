'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import Link from 'next/link';

export function RegisterClient() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', phone: '' });
  const [tenantSlug, setTenantSlug] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const slug = localStorage.getItem('tenant_slug');
    if (slug) setTenantSlug(slug);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/customer-auth/register', { tenantSlug, ...form });
      setAuth(data.accessToken, data.customerId, tenantSlug);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create account</h1>
        {error && <p className="mb-4 text-sm text-red-600 bg-red-50 rounded p-3">{error}</p>}
        <form onSubmit={submit} className="space-y-4">
          {!tenantSlug && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tenant Slug</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value)} required />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
              <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.firstName} onChange={f('firstName')} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
              <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.lastName} onChange={f('lastName')} required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.email} onChange={f('email')} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone (optional)</label>
            <input type="tel" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.phone} onChange={f('phone')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={form.password} onChange={f('password')} required minLength={8} />
          </div>
          <button type="submit" disabled={loading} className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Creating...' : 'Create account'}
          </button>
        </form>
        <p className="mt-4 text-sm text-center text-gray-600">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
