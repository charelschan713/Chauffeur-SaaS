'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import {
  LayoutDashboard,
  CalendarCheck,
  MapPin,
  Users,
  Car,
  Truck,
  Tag,
  Layers,
  Settings,
  Building2,
  Map,
  Puzzle,
  LogOut,
  ChevronRight,
  FileText,
  BadgePercent,
  UserCircle,
} from 'lucide-react';

const NAV_SECTIONS = [
  {
    title: 'Bookings',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/bookings', label: 'All Bookings', icon: CalendarCheck },
      { href: '/bookings/new', label: 'Create Booking', icon: CalendarCheck },
      { href: '/bookings/new?job_type=DRIVER_JOB', label: 'Create Driver Job', icon: CalendarCheck },
    ],
  },
  {
    title: 'Dispatch',
    items: [
      { href: '/dispatch', label: 'Dispatch Board', icon: MapPin },
    ],
  },
  {
    title: 'Drivers',
    items: [
      { href: '/drivers', label: 'Drivers', icon: Car },
      { href: '/vehicles', label: 'Vehicles', icon: Truck },
      { href: '/driver-invoices', label: 'Driver Payouts', icon: FileText },
    ],
  },
  {
    title: 'Payments',
    items: [
      { href: '/invoices', label: 'Invoices', icon: FileText },
      { href: '/discounts', label: 'Discounts', icon: BadgePercent },
    ],
  },
  {
    title: 'Customers',
    items: [
      { href: '/customers', label: 'Customers', icon: Users },
    ],
  },
  {
    title: 'Pricing',
    items: [
      { href: '/pricing/car-types', label: 'Car Types', icon: Tag },
      { href: '/pricing/service-types', label: 'Service Types', icon: Layers },
      { href: '/pricing/surcharges', label: 'Surcharges', icon: BadgePercent },
      { href: '/pricing/parking', label: 'Airport Parking', icon: BadgePercent },
    ],
  },
  {
    title: 'Settings',
    items: [
      { href: '/settings/general', label: 'General', icon: Settings },
      { href: '/projects', label: 'Projects', icon: FileText },
      { href: '/settings/invoice', label: 'Invoice Setup', icon: FileText },
      { href: '/settings/cities', label: 'Cities', icon: Building2 },
      { href: '/settings/templates', label: 'Templates', icon: Map },
      { href: '/settings/notification-logs', label: 'Notification Logs', icon: FileText },
      { href: '/settings/integrations', label: 'Integrations', icon: Puzzle },
      { href: '/settings/widget', label: 'Widget', icon: Puzzle },
    ],
  },
];

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // Mount-time auth guard: redirect to /login if no token present.
  // This prevents unauthenticated users from seeing the tenant admin shell.
  // Note: actual API calls are also guarded by the backend JWT; this guard
  // is for immediate UX — no flash of the admin shell before redirect.
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.replace('/login');
    }
  }, [router]);

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
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-[#0f1117] text-gray-400 min-h-screen flex flex-col shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-white/5">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <Car className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-white tracking-tight">Chauffeur Admin</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-5">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              <div className="px-3 mb-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                {section.title}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href || pathname?.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                        isActive
                          ? 'bg-white/10 text-white'
                          : 'hover:bg-white/5 hover:text-gray-200'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300'
                        }`}
                      />
                      <span className="flex-1">{item.label}</span>
                      {isActive && (
                        <ChevronRight className="w-3 h-3 text-gray-600" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 border-t border-white/5 space-y-0.5">
          <Link
            href="/profile"
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
              pathname === '/profile'
                ? 'bg-white/10 text-white'
                : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
            }`}
          >
            <UserCircle className={`w-4 h-4 shrink-0 ${pathname === '/profile' ? 'text-blue-400' : 'text-gray-500'}`} />
            My Profile
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0 text-gray-500" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <AdminTopbar tenantName="ASChauffeured" onLogout={handleLogout} />
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
