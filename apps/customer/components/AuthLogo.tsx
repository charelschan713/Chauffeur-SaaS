'use client';
import React, { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://chauffeur-saas-production.up.railway.app';

interface TenantBranding {
  company_name: string;
  logo_url?: string;
  tagline?: string;
}

function getTenantSlug(): string {
  if (typeof window === 'undefined') return '';
  // 1. Cookie
  const cookieSlug = document.cookie.split('; ')
    .find(r => r.startsWith('tenant_slug='))?.split('=')[1];
  if (cookieSlug) return cookieSlug;
  // 2. localStorage
  const lsSlug = localStorage.getItem('tenant_slug');
  if (lsSlug) return lsSlug;
  // 3. Subdomain (e.g. aschauffeured.chauffeurssolution.com)
  const host = window.location.hostname;
  const sub = host.split('.')[0];
  if (sub && sub !== 'www' && sub !== 'chauffeurssolution') return sub;
  return '';
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

  const name = branding?.company_name ?? 'ASChauffeured';
  const logoUrl = branding?.logo_url;

  return (
    <div className="text-center w-full lg:hidden">
      <div className="flex flex-col items-center gap-1">
        {logoUrl ? (
          <div style={{ background: 'transparent' }}>
            <img
              src={logoUrl}
              alt={name}
              style={{ height: '110px', width: 'auto', objectFit: 'contain', display: 'block' }}
              onError={(e) => {
                (e.target as HTMLImageElement).parentElement!.style.display = 'none';
              }}
            />
          </div>
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
        <p className="text-white/30 text-sm mt-3">{subtitle}</p>
      )}
    </div>
  );
}

/** Shared page shell for auth pages */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-[#0d0f14] overflow-y-auto flex flex-col lg:flex-row">

      {/* ── Left brand panel (desktop only) ─────────────────── */}
      <div className="hidden lg:flex lg:w-[45%] flex-col items-center justify-center relative overflow-hidden px-12">
        {/* gradient bg */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#251a00_0%,_#0d0f14_70%)]" />
        {/* decorative rings */}
        <div className="absolute w-[600px] h-[600px] rounded-full border border-[#c8a96b]/5" />
        <div className="absolute w-[450px] h-[450px] rounded-full border border-[#c8a96b]/8" />
        <div className="absolute w-[300px] h-[300px] rounded-full border border-[#c8a96b]/10" />
        {/* content */}
        <div className="relative flex flex-col items-center text-center gap-6 max-w-xs">
          <BrandPanel />
          <div className="w-24 h-px bg-[#c8a96b]/30" />
          <p className="text-white/30 text-sm leading-relaxed tracking-wide">
            Premium chauffeur services.<br />
            Luxury at your fingertips.
          </p>
        </div>
        <p className="absolute bottom-6 text-xs text-white/15 tracking-widest uppercase">
          © {new Date().getFullYear()} Chauffeur Solutions
        </p>
      </div>

      {/* ── Right form panel ──────────────────────────────────── */}
      <div className="flex-1 lg:w-[55%] flex flex-col relative">
        {/* mobile gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#1a1200_0%,_#0d0f14_60%)] pointer-events-none lg:hidden" />
        {/* divider line on desktop */}
        <div className="hidden lg:block absolute left-0 top-[10%] bottom-[10%] w-px bg-[#c8a96b]/10" />
        <div className="relative flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm flex flex-col items-center gap-8">
            {children}
          </div>
        </div>
        <p className="relative text-center text-xs text-white/15 tracking-widest uppercase pb-6 lg:hidden">
          © {new Date().getFullYear()} Chauffeur Solutions
        </p>
      </div>
    </div>
  );
}

/** Brand content used inside the left panel */
function BrandPanel() {
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const [name, setName] = React.useState('ASChauffeured');

  React.useEffect(() => {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const sub = host.split('.')[0];
    const slug = (sub && sub !== 'www' && sub !== 'chauffeurssolution') ? sub : '';
    if (!slug) return;
    const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://chauffeur-saas-production.up.railway.app';
    fetch(`${API_URL}/public/tenant-info?tenant_slug=${slug}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setName(d.company_name ?? 'ASChauffeured'); if (d.logo_url) setLogoUrl(d.logo_url); } })
      .catch(() => {});
  }, []);

  if (logoUrl) {
    return (
      <img src={logoUrl} alt={name}
        style={{ height: '120px', width: 'auto', objectFit: 'contain' }}
        onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
    );
  }
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[#c8a96b] text-xl font-medium tracking-[0.18em] uppercase"
        style={{ fontFamily: "'Playfair Display', serif" }}>{name}</span>
      <div className="w-40 h-px bg-[#c8a96b]/50" />
      <span className="text-[#c8a96b]/60 text-[10px] tracking-[0.12em] uppercase italic">
        Premium Chauffeur Services
      </span>
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
