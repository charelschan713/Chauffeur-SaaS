'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Bell } from 'lucide-react';

interface AdminTopbarProps {
  tenantName?: string;
  onLogout?: () => void;
}

const SEGMENT_LABELS: Record<string, string> = {
  admin: 'Admin',
  bookings: 'Bookings',
  drivers: 'Drivers',
  customers: 'Customers',
  vehicles: 'Vehicles',
  dispatch: 'Dispatch',
  pricing: 'Pricing',
  settings: 'Settings',
  dashboard: 'Dashboard',
  tenants: 'Tenants',
  overview: 'Overview',
  new: 'New',
  general: 'General',
  cities: 'Cities',
  templates: 'Templates',
  integrations: 'Integrations',
  'car-types': 'Car Types',
  'service-types': 'Service Types',
};

const UUID_RE = /^[0-9a-fA-F-]{20,}$/;

function friendlySegment(seg: string): string | null {
  if (UUID_RE.test(seg)) return 'Details';
  if (SEGMENT_LABELS[seg]) return SEGMENT_LABELS[seg];
  return seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AdminTopbar({ tenantName = 'Tenant', onLogout }: AdminTopbarProps) {
  const pathname = usePathname();
  const rawSegments = pathname?.split('/').filter(Boolean) ?? [];
  const crumbs = rawSegments
    .map((seg) => friendlySegment(seg))
    .filter((label): label is string => label !== null);

  const pageTitle = crumbs[crumbs.length - 1] ?? 'Dashboard';

  return (
    <header className="flex items-center justify-between h-14 border-b border-gray-200 bg-white px-6 shrink-0">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
        {crumbs.length > 1 ? (
          crumbs.map((crumb, i) => (
            <React.Fragment key={i}>
              {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-300" />}
              <span
                className={
                  i === crumbs.length - 1
                    ? 'font-semibold text-gray-900'
                    : 'text-gray-400 hover:text-gray-600'
                }
              >
                {crumb}
              </span>
            </React.Fragment>
          ))
        ) : (
          <span className="font-semibold text-gray-900">{pageTitle}</span>
        )}
      </nav>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Notification bell (UI only) */}
        <button className="relative p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors">
          <Bell className="w-4 h-4" />
        </button>

        {/* Tenant name + avatar → links to profile */}
        <Link href="/profile" className="flex items-center gap-2 pl-3 border-l border-gray-200 hover:opacity-80 transition-opacity">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-semibold text-white select-none">
            {tenantName?.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-gray-700 max-w-[120px] truncate">
            {tenantName}
          </span>
        </Link>
      </div>
    </header>
  );
}
