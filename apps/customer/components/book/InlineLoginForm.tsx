'use client';
/**
 * InlineLoginForm — lightweight email/password login embedded in the booking flow.
 * Used when an unauthenticated user chooses "Sign In" at the AuthGate step.
 * Extracted from BookPageClient.tsx.
 */
import { useState } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

interface InlineLoginFormProps {
  onSuccess: () => void;
  onBack:    () => void;
}

export function InlineLoginForm({ onSuccess, onBack }: InlineLoginFormProps) {
  const setAuth = useAuthStore(s => s.setAuth);
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const slug = document.cookie.split('; ').find(r => r.startsWith('tenant_slug='))?.split('=')[1] ?? '';
      const { data } = await api.post('/customer-auth/login', { tenantSlug: slug, email, password });
      setAuth(data.accessToken, data.customerId, slug);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>}
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label>Password</Label>
        <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
      </div>
      <div className="flex gap-3 pt-1">
        <Button type="submit" size="lg" className="flex-1" disabled={loading}>
          {loading && <Spinner className="h-4 w-4 mr-2" />} Sign In
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={onBack}>Back</Button>
      </div>
    </form>
  );
}
