'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  {
    href: '/dashboard',
    label: 'Home',
    icon: (active: boolean) => (
      <svg className="w-[22px] h-[22px]" fill={active ? '#1a1a1a' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: '/bookings',
    label: 'Bookings',
    icon: (active: boolean) => (
      <svg className="w-[22px] h-[22px]" fill={active ? '#1a1a1a' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    href: '/quote',
    label: '',
    // Gold floating center button — 1:1 web portal design
    icon: (_active: boolean) => (
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center -mt-7 transition-transform active:scale-95"
        style={{
          backgroundColor: '#c8a96b',
          boxShadow: '0 4px 16px rgba(200,169,107,0.5)',
        }}
      >
        <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </div>
    ),
    isAction: true,
  },
  {
    href: '/invoices',
    label: 'Invoices',
    icon: (active: boolean) => (
      <svg className="w-[22px] h-[22px]" fill={active ? '#1a1a1a' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: (active: boolean) => (
      <svg className="w-[22px] h-[22px]" fill={active ? '#1a1a1a' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

const NAV_PAGES = ['/dashboard', '/bookings', '/invoices', '/profile', '/passengers', '/payment-methods'];

export function BottomNav() {
  const pathname = usePathname();
  const showNav = NAV_PAGES.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (!showNav) return null;

  return (
    <div className="lg:hidden">
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t"
        style={{
          borderTopColor: '#f0f0f0',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="max-w-lg mx-auto flex items-end justify-around px-1 pt-2 pb-2">
          {NAV_ITEMS.map(item => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-1 min-w-[56px] min-h-[44px] transition-all duration-200 active:scale-95',
                  item.isAction ? 'pb-1 justify-end' : 'py-1 justify-center',
                  !item.isAction && (active ? 'text-[#1a1a1a]' : 'text-[#999] hover:text-[#666]'),
                )}
              >
                {item.icon(active)}
                {!item.isAction && (
                  <span className={cn(
                    'text-[10px] font-semibold',
                    active ? 'text-[#1a1a1a]' : 'text-[#999]',
                  )}>
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
