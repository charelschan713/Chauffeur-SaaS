'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import api from '@/lib/api';

interface TenantBranding {
  id: string;
  name: string;
  slug: string;
  currency: string;
  primary_color: string;
  logo_url?: string;
  company_name?: string;
  contact_email?: string;
  contact_phone?: string;
}

const TenantContext = createContext<TenantBranding | null>(null);

export function useTenant() {
  return useContext(TenantContext);
}

export function TenantProvider({
  children,
  slug,
}: {
  children: React.ReactNode;
  slug?: string;
}) {
  const [tenant, setTenant] = useState<TenantBranding | null>(null);

  useEffect(() => {
    const resolvedSlug = slug ?? (typeof window !== 'undefined' ? localStorage.getItem('tenant_slug') : null);
    if (!resolvedSlug) return;

    api
      .get(`/customer-portal/tenant-info?slug=${resolvedSlug}`)
      .then((r) => {
        const t = r.data;
        setTenant(t);
        // Apply CSS variables
        const root = document.documentElement;
        root.style.setProperty('--color-primary', t.primary_color ?? '#2563eb');
      })
      .catch(() => {});
  }, [slug]);

  return <TenantContext.Provider value={tenant}>{children}</TenantContext.Provider>;
}
