'use client';
import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://chauffeur-saas-production.up.railway.app';

interface TenantBranding {
  company_name: string;
  logo_url?: string;
  tagline?: string;
}

function getTenantSlug(): string {
  if (typeof window === 'undefined') return '';
  const cookieSlug = document.cookie.split('; ')
    .find(r => r.startsWith('tenant_slug='))?.split('=')[1];
  return cookieSlug || localStorage.getItem('tenant_slug') || '';
}

export function AuthLogo({ subtitle }: { subtitle?: string }) {
  const [branding, setBranding] = useState<TenantBranding | null>(null);

  useEffect(() => {
    const slug = getTenantSlug();
    if (!slug) return;
    fetch(`${API_URL}/public/tenant-info?tenant_slug=${slug}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setBranding(d); })
      .catch(() => {});
  }, []);

  const name = branding?.company_name ?? 'Chauffeur Services';
  const logoUrl = branding?.logo_url;

  return (
    <div className="text-center mb-10">
      <div className="flex flex-col items-center gap-1 mb-4">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={name}
            className="h-12 w-auto object-contain mb-2"
            style={{ filter: 'brightness(1.1)' }}
          />
        ) : (
          <>
            <span
              className="text-[#c8a96b] text-base font-medium tracking-[0.18em] uppercase"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {name}
            </span>
            <div className="w-40 h-px bg-[#c8a96b]/50" />
            <span className="text-[#c8a96b]/60 text-[9px] tracking-[0.12em] uppercase italic">
              Premium Chauffeur Services
            </span>
          </>
        )}
      </div>
      {subtitle && (
        <p className="text-white/30 text-sm">{subtitle}</p>
      )}
    </div>
  );
}

/** Shared page shell for auth pages */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen bg-[#0d0f14] flex items-center justify-center px-4"
      style={{
        paddingTop: 'max(48px, env(safe-area-inset-top))',
        paddingBottom: 'max(32px, env(safe-area-inset-bottom))',
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#1a1200_0%,_#0d0f14_60%)] pointer-events-none" />
      <div className="relative w-full max-w-sm">
        {children}
        <p className="text-center text-xs text-white/15 mt-8 tracking-widest uppercase">
          © {new Date().getFullYear()} Chauffeur Solutions
        </p>
      </div>
    </div>
  );
}

export const inputCls = "w-full h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#c8a96b]/50 transition-all";
export const labelCls = "block text-xs font-semibold uppercase tracking-widest text-[#c8a96b]/60 mb-2";

export function GoldButton({ loading, children, disabled, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={loading || disabled}
      className="w-full h-12 rounded-xl font-semibold text-sm tracking-widest uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
      style={{ background: 'linear-gradient(135deg, #c8a96b, #a8853d)', color: '#0d0f14' }}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-[#0d0f14]/30 border-t-[#0d0f14] rounded-full animate-spin" />
          {children}
        </span>
      ) : children}
    </button>
  );
}

export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white/[0.03] border border-[#c8a96b]/20 rounded-2xl p-8 backdrop-blur-sm shadow-2xl">
      {children}
    </div>
  );
}

export function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm mb-5">
      <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
      {message}
    </div>
  );
}
