'use client';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

const NAV_SECTIONS = [
  {
    title: 'Operations',
    items: [
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
      { href: '/settings/integrations', label: 'Integrations' },
      { href: '/settings/templates', label: 'Templates' },
      { href: '/settings/cities', label: 'Cities' },
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <aside className="w-64 bg-gray-900 text-white min-h-screen flex flex-col">
          <div className="px-6 py-4 text-lg font-semibold">Chauffeur Admin</div>
          <nav className="flex-1 px-4 space-y-5">
            {NAV_SECTIONS.map((section) => (
              <div key={section.title} className="space-y-2">
                <div className="px-2 text-xs text-gray-400 tracking-wider uppercase">
                  {section.title}
                </div>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`block px-3 py-2 rounded-md text-sm transition ${
                          isActive
                            ? 'bg-gray-800 text-white border-l-2 border-blue-500'
                            : 'text-gray-300 hover:bg-gray-800 hover:text-white'
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
          <div className="p-4 border-t border-gray-800">
            <button
              onClick={async () => {
                await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
                  method: 'POST',
                  credentials: 'include',
                });
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                router.push('/login');
              }}
              className="w-full px-3 py-2 text-sm rounded-md bg-gray-800 text-gray-200 hover:bg-gray-700"
            >
              Sign out
            </button>
          </div>
        </aside>
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
