'use client';
import React from 'react';
import { useTenant } from './TenantProvider';

/**
 * AuthLogo — tenant-branded mark for auth screens (login, register, etc.)
 *
 * Reads tenant branding from TenantProvider context.
 * TenantProvider fetches /public/tenant-info once at root layout mount.
 * This component DOES NOT fetch independently — zero duplicate API calls.
 *
 * Fallback: if TenantProvider hasn't resolved yet or tenant has no logo,
 * shows company name as styled text with gold divider line.
 */
export function AuthLogo({ subtitle }: { subtitle?: string }) {
  const tenant = useTenant();

  const name   = tenant?.name ?? 'ASChauffeured';
  const logoUrl = tenant?.logo_url;

  return (
    <div className="text-center w-full">
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
              className="text-primary text-base font-medium tracking-[0.18em] uppercase"
              style={{ fontFamily: "var(--font-display, 'Playfair Display', serif)" }}
            >
              {name}
            </span>
            <div className="w-40 h-px bg-primary/50" />
            <span className="text-primary/60 text-[9px] tracking-[0.12em] uppercase italic">
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

/**
 * AuthShell — full-screen split layout for auth pages.
 * Left panel: brand (desktop only). Right panel: form.
 * Colors use CSS variables for tenant theme support.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-[hsl(var(--background))] overflow-y-auto">
      {/* unified luxury background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#1a1200_0%,_#0d0f14_70%)]" />
      <div className="relative min-h-screen flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md flex flex-col items-stretch gap-6">
          {children}
        </div>
        <p className="mt-10 text-center text-xs text-white/20 tracking-widest uppercase">
          © {new Date().getFullYear()} Chauffeur Solutions
        </p>
      </div>
    </div>
  );
}

/**
 * BrandPanel — logo or company name wordmark for the desktop left panel.
 * Reads from TenantProvider context — no independent fetch.
 */
function BrandPanel() {
  const tenant = useTenant();
  const name   = tenant?.name ?? 'ASChauffeured';
  const logoUrl = tenant?.logo_url;

  if (logoUrl) {
    return (
      <img src={logoUrl} alt={name}
        style={{ height: '80px', width: 'auto', objectFit: 'contain' }}
        onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
    );
  }
  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className="text-primary text-xl font-medium tracking-[0.18em] uppercase"
        style={{ fontFamily: "var(--font-display, 'Playfair Display', serif)" }}
      >
        {name}
      </span>
      <div className="w-40 h-px bg-primary/50" />
      <span className="text-primary/60 text-[10px] tracking-[0.12em] uppercase italic">
        Premium Chauffeur Services
      </span>
    </div>
  );
}

export const inputCls = "w-full h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-primary/50 transition-all";
export const labelCls = "block text-xs font-semibold uppercase tracking-widest text-primary/60 mb-2";

export function GoldButton({
  loading,
  children,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={loading || disabled}
      className="w-full h-12 rounded-xl font-semibold text-sm tracking-widest uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] bg-primary text-primary-foreground hover:opacity-90"
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
          {children}
        </span>
      ) : children}
    </button>
  );
}

export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full bg-white/[0.03] border border-primary/20 rounded-2xl p-8 lg:p-10 backdrop-blur-sm shadow-[0_24px_64px_rgba(0,0,0,0.5)]">
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
