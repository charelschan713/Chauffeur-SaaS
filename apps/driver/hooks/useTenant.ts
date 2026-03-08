'use client';

import { useEffect, useState } from 'react';

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  currency: string;
  timezone: string;
  logo_url?: string;
  primary_color?: string;
  company_name?: string;
  contact_email?: string;
  contact_phone?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://chauffeur-saas-production.up.railway.app';

function getTenantSlug(): string | null {
  if (typeof document === 'undefined') return null;
  return (
    document.cookie
      .split('; ')
      .find(r => r.startsWith('tenant_slug='))
      ?.split('=')[1] ?? null
  );
}

export function useTenant() {
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const slug = getTenantSlug();
    if (!slug) {
      setError('No tenant slug found');
      setLoading(false);
      return;
    }

    fetch(`${API_URL}/customer-portal/tenant-info?slug=${slug}`)
      .then(r => r.json())
      .then(data => {
        if (data?.id) {
          setTenant(data);
          // Apply branding CSS variable
          const color = data.primary_color || '#2563eb';
          document.documentElement.style.setProperty('--primary', color);
        } else {
          setError('Tenant not found');
        }
      })
      .catch(() => setError('Failed to load tenant'))
      .finally(() => setLoading(false));
  }, []);

  return { tenant, loading, error, slug: getTenantSlug() };
}
