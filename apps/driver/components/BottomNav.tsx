'use client';
import Link from 'next/link';

const TABS = [
  { href: '/dashboard', label: 'Home',    icon: '🏠' },
  { href: '/jobs',      label: 'Jobs',    icon: '🚗' },
  { href: '/invoices',  label: 'Earnings',icon: '💰' },
  { href: '/profile',   label: 'Profile', icon: '👤' },
];

export default function BottomNav({ active }: { active: string }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-[hsl(var(--border))] bg-[hsl(var(--popover))] pb-safe">
      {TABS.map((t) => {
        const isActive = active === t.href.replace('/', '');
        return (
          <Link
            key={t.href}
            href={t.href}
            className="flex flex-1 flex-col items-center gap-1.5 py-2.5 text-[10px]"
          >
            <span className="text-[20px]">{t.icon}</span>
            <span
              className={
                isActive
                  ? 'font-semibold text-[hsl(var(--primary))]'
                  : 'text-[hsl(var(--muted-foreground))]'
              }
            >
              {t.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
