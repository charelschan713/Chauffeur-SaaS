'use client';
import { createContext, useContext, useEffect, useState } from 'react';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'https://chauffeur-saas-production.up.railway.app';

export interface TenantTheme {
  id: string;
  name: string;
  slug: string;
  currency: string;
  timezone: string;
  logo_url?: string | null;
  // ── Step B: tenant-specific CSS overrides ──
  primary_color?: string | null;        // hsl string e.g. "39 46% 60%"
  primary_foreground?: string | null;   // hsl string
  font_family?: string | null;          // e.g. "Playfair Display"
  cancel_window_hours?: number;
}

const TenantContext = createContext<TenantTheme | null>(null);

export function useTenant() {
  return useContext(TenantContext);
}

function getTenantSlugFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  return (
    document.cookie
      .split('; ')
      .find((r) => r.startsWith('tenant_slug='))
      ?.split('=')[1] ?? null
  );
}

function applyTenantTheme(tenant: TenantTheme) {
  const root = document.documentElement;

  // ── Primary brand color (Step B: tenant overrides platform default) ──
  if (tenant.primary_color) {
    root.style.setProperty('--primary', tenant.primary_color);
    root.style.setProperty('--ring', tenant.primary_color);
    root.style.setProperty('--gold', tenant.primary_color);
  }
  if (tenant.primary_foreground) {
    root.style.setProperty('--primary-foreground', tenant.primary_foreground);
  }

  // ── Display font (Step B) ──
  if (tenant.font_family) {
    root.style.setProperty('--font-display', `'${tenant.font_family}', Georgia, serif`);
  }
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<TenantTheme | null>(null);

  useEffect(() => {
    const slug = getTenantSlugFromCookie();
    if (!slug) return;

    fetch(`${API_URL}/public/tenant-info?tenant_slug=${slug}`)
      .then((r) => r.json())
      .then((data: TenantTheme) => {
        if (data?.id) {
          setTenant(data);
          applyTenantTheme(data);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <TenantContext.Provider value={tenant}>
      {children}
    </TenantContext.Provider>
  );
}
