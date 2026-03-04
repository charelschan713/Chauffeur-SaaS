'use client';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { AdminTopbar } from '@/components/admin/AdminTopbar';

const NAV_SECTIONS = [
  {
    title: 'Operations',
    items: [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/bookings', label: 'Bookings' },
      { href: '/dispatch', label: 'Dispatch' },
      { href: '/customers', label: 'Customers' },
    ],
  },
  {
    title: 'Fleet',
    items: [
      { href: '/drivers', label: 'Drivers' },
      { href: '/vehicles', label: 'Vehicles' },
    ],
  },
  {
    title: 'Pricing',
    items: [
      { href: '/pricing/car-types', label: 'Car Types' },
      { href: '/pricing/service-types', label: 'Service Types' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { href: '/settings/general', label: 'General' },
      { href: '/settings/cities', label: 'Cities' },
      { href: '/settings/templates', label: 'Templates' },
      { href: '/settings/integrations', label: 'Integrations' },
    ],
  },
];

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <aside className="w-64 bg-gray-900 text-gray-300 min-h-screen flex flex-col px-3 py-4">
          <div className="px-3 py-2 text-lg font-semibold text-white">Chauffeur Admin</div>
          <nav className="flex-1 space-y-5">
            {NAV_SECTIONS.map((section) => (
              <div key={section.title}>
                <div className="mt-4 mb-2 px-3 text-xs text-gray-400 tracking-wider uppercase">
                  {section.title}
                </div>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition ${
                          isActive
                            ? 'bg-gray-800 text-white border-l-2 border-blue-500 pl-[calc(0.75rem-2px)]'
                            : 'hover:bg-gray-800 hover:text-white'
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
          <div className="mt-auto">
            <button
              onClick={handleLogout}
              className="w-full px-3 py-2 rounded-md text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </aside>
        <main className="flex-1">
          <AdminTopbar tenantName="Tenant" onLogout={handleLogout} />
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
