'use client';
import Link from 'next/link';

const GOLD = '#C8A870';
const MUTED = '#6B7280';

const TABS = [
  { href: '/dashboard', label: 'Home',    icon: '🏠' },
  { href: '/jobs',      label: 'Jobs',    icon: '🚗' },
  { href: '/invoices',  label: 'Earnings',icon: '💰' },
  { href: '/profile',   label: 'Profile', icon: '👤' },
];

export default function BottomNav({ active }: { active: string }) {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
      background: '#16162A', borderTop: '0.5px solid #333355',
      display: 'flex', paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {TABS.map(t => {
        const isActive = active === t.href.replace('/', '');
        return (
          <Link key={t.href} href={t.href} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '10px 0 8px', textDecoration: 'none', gap: 3,
          }}>
            <span style={{ fontSize: 20 }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400, color: isActive ? GOLD : MUTED }}>
              {t.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
