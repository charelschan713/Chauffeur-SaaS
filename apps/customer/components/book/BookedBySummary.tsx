'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';

interface ProfileSummary {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_country_code?: string;
  phone_number?: string;
}

export function BookedBySummary() {
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.get('/customer-portal/profile')
      .then(({ data }) => {
        if (!active) return;
        setProfile(data ?? null);
      })
      .catch(() => {
        if (!active) return;
        setProfile(null);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <div className="space-y-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Booked by</p>
          <p className="text-base font-semibold text-[hsl(var(--foreground))]">
            {loading ? 'Loading…' : `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || '—'}
          </p>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {loading ? ' ' : (profile?.email ?? '—')}
          </p>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {loading ? ' ' : ((profile?.phone_country_code && profile?.phone_number)
              ? `${profile.phone_country_code} ${profile.phone_number}`
              : '—')}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { if (typeof window !== 'undefined') window.location.href = '/profile'; }}>
          Edit Profile
        </Button>
      </div>
    </div>
  );
}
