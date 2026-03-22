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
  website_url?: string | null;
  branding?: {
    logo_url?: string | null;
    primary_color?: string | null;
    secondary_color?: string | null;
    background_color?: string | null;
    card_color?: string | null;
    text_color?: string | null;
    muted_text_color?: string | null;
    border_color?: string | null;
    font_family?: string | null;
    button_radius?: number | null;
    card_radius?: number | null;
    input_radius?: number | null;
  };
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
  const branding = tenant.branding ?? (tenant as any).theme_json?.branding ?? null;

  // ── Primary brand color ──
  const primary = branding?.primary_color ?? tenant.primary_color;
  if (primary) {
    root.style.setProperty('--primary', primary);
    root.style.setProperty('--ring', primary);
    root.style.setProperty('--gold', primary);
  }
  const primaryFg = branding?.text_color ?? tenant.primary_foreground;
  if (primaryFg) {
    root.style.setProperty('--primary-foreground', primaryFg);
  }

  // ── Base theme colors ──
  if (branding?.background_color) root.style.setProperty('--background', branding.background_color);
  if (branding?.card_color) root.style.setProperty('--card', branding.card_color);
  if (branding?.text_color) root.style.setProperty('--foreground', branding.text_color);
  if (branding?.muted_text_color) root.style.setProperty('--muted-foreground', branding.muted_text_color);
  if (branding?.border_color) root.style.setProperty('--border', branding.border_color);

  // ── Radius tokens ──
  if (branding?.button_radius != null) root.style.setProperty('--radius-button', `${branding.button_radius}px`);
  if (branding?.card_radius != null) root.style.setProperty('--radius-card', `${branding.card_radius}px`);
  if (branding?.input_radius != null) root.style.setProperty('--radius-input', `${branding.input_radius}px`);

  // ── Display font ──
  const font = branding?.font_family ?? tenant.font_family;
  if (font) {
    root.style.setProperty('--font-display', `'${font}', Georgia, serif`);
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
