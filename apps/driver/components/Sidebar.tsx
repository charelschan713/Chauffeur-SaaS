'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/auth-store';

const NAV_ITEMS = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: '/jobs',
    label: 'Assigned Jobs',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 17h14M5 7h14M5 12h14" />
      </svg>
    ),
  },
  {
    href: '/invoices',
    label: 'Invoices',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

// Pages that show the sidebar
const NAV_PAGES = ['/dashboard', '/jobs', '/invoices', '/profile'];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { clearAuth } = useAuthStore();
  const showSidebar = NAV_PAGES.some(p => pathname === p || pathname.startsWith(p + '/'));

  if (!showSidebar) return null;

  const handleSignOut = () => {
    clearAuth();
    router.push('/login');
  };

  return (
    <aside
      className="hidden lg:flex flex-col fixed top-0 left-0 h-full w-64 border-r border-white/5 z-40 bg-[hsl(var(--card))]"
    >
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/5">
        <span
          className="text-xl font-semibold text-gradient-gold"
          style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
        >
          Chauffeur Solutions
        </span>
        <div className="mt-2 h-px w-20 bg-gradient-to-r from-transparent via-[hsl(var(--primary))] to-transparent" />
        <p className="text-xs text-white/50 mt-2">Driver Portal</p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
                'font-medium',
                active
                  ? 'bg-[#c8a96b]/10 text-[#c8a96b]'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5',
              )}
              style={{ fontFamily: 'var(--font-geist-sans), sans-serif' }}
            >
              <span className={cn(active ? 'text-[#c8a96b]' : 'text-white/40')}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 pb-6 border-t border-white/5 pt-3">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/40 hover:text-white/70 hover:bg-white/5 transition-all duration-150 w-full"
          style={{ fontFamily: 'var(--font-geist-sans), sans-serif' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
