'use client';
import React from 'react';

export function AuthLogo({ subtitle }: { subtitle?: string }) {
  return (
    <div className="text-center w-full lg:hidden">
      <div className="flex flex-col items-center gap-1">
        <span
          className="text-[#c8a96b] text-base font-medium tracking-[0.18em] uppercase"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Chauffeur Solutions
        </span>
        <div className="w-40 h-px bg-[#c8a96b]/50" />
        <span className="text-[#c8a96b]/60 text-[9px] tracking-[0.12em] uppercase italic">
          Driver Portal
        </span>
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
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center relative overflow-hidden">
        {/* gradient bg */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#1e1500_0%,_#0d0f14_65%)]" />
        {/* decorative rings */}
        <div className="absolute w-[700px] h-[700px] rounded-full border border-[#c8a96b]/4" />
        <div className="absolute w-[520px] h-[520px] rounded-full border border-[#c8a96b]/6" />
        <div className="absolute w-[360px] h-[360px] rounded-full border border-[#c8a96b]/10" />
        <div className="absolute w-[200px] h-[200px] rounded-full border border-[#c8a96b]/15" />
        {/* content */}
        <div className="relative flex flex-col items-center text-center gap-8 max-w-sm px-12">
          <BrandPanel />
          <div className="w-32 h-px bg-gradient-to-r from-transparent via-[#c8a96b]/40 to-transparent" />
          <p className="text-white/25 text-sm leading-relaxed tracking-wider font-light">
            Operational companion portal.<br />
            Built for driver workflows.
          </p>
        </div>
        <p className="absolute bottom-8 text-[10px] text-white/12 tracking-[0.2em] uppercase">
          © {new Date().getFullYear()} Chauffeur Solutions
        </p>
      </div>

      {/* ── Right form panel ──────────────────────────────────── */}
      <div className="flex-1 lg:w-1/2 flex flex-col relative">
        {/* mobile gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#1a1200_0%,_#0d0f14_60%)] pointer-events-none lg:hidden" />
        {/* desktop subtle gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#0f1118_0%,_#0d0f14_100%)] pointer-events-none hidden lg:block" />
        {/* divider line on desktop */}
        <div className="hidden lg:block absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[#c8a96b]/15 to-transparent" />
        <div className="relative flex-1 flex items-center justify-center px-6 py-12 lg:px-16">
          <div className="w-full max-w-md flex flex-col items-stretch gap-8">
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
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[#c8a96b] text-xl font-medium tracking-[0.18em] uppercase"
        style={{ fontFamily: "'Playfair Display', serif" }}>
        Chauffeur Solutions
      </span>
      <div className="w-40 h-px bg-[#c8a96b]/50" />
      <span className="text-[#c8a96b]/60 text-[10px] tracking-[0.12em] uppercase italic">
        Driver Portal
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
    <div className="w-full bg-white/[0.03] border border-[#c8a96b]/20 rounded-2xl p-8 lg:p-10 backdrop-blur-sm shadow-[0_24px_64px_rgba(0,0,0,0.5)]">
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
