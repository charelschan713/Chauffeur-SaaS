'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/tenants', label: 'Tenants' },
  { href: '/admin/bookings', label: 'Bookings' },
  { href: '/admin/customers', label: 'Customers' },
  { href: '/admin/passengers', label: 'Passengers' },
  { href: '/admin/drivers', label: 'Drivers' },
  { href: '/admin/vehicles', label: 'Vehicles' },
  { href: '/admin/discounts', label: 'Discounts' },
  { href: '/admin/settings', label: 'Settings' },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`flex flex-col bg-blue-900 text-white transition-all duration-200 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="flex items-center justify-between px-4 py-4 border-b border-blue-800">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-blue-700" />
          {!collapsed && <span className="font-semibold">Admin Portal</span>}
        </div>
        <button
          onClick={() => setCollapsed((prev) => !prev)}
          className="text-blue-200 hover:text-white text-xs"
          aria-label="Toggle sidebar"
        >
          {collapsed ? '»' : '«'}
        </button>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
                active ? 'bg-blue-800 text-white' : 'text-blue-100 hover:bg-blue-800'
              }`}
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-blue-700 text-xs">
                •
              </span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
