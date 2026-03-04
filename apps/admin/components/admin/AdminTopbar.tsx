'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/Button';

interface AdminTopbarProps {
  tenantName?: string;
  onLogout?: () => void;
}

// Friendly label map for known route segments
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
};

// UUID-like: 20+ hex chars or standard UUID pattern
const UUID_RE = /^[0-9a-fA-F-]{20,}$/;

function friendlySegment(seg: string): string | null {
  if (UUID_RE.test(seg)) return 'Details';
  if (SEGMENT_LABELS[seg]) return SEGMENT_LABELS[seg];
  // fallback: capitalise words
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
    <div className="flex items-center justify-between h-14 border-b border-gray-200 bg-white px-6">
      <div className="space-y-0.5">
        {crumbs.length > 1 && (
          <nav aria-label="Breadcrumb" className="text-xs text-gray-400">
            {crumbs.slice(0, -1).map((crumb, i) => (
              <span key={i}>
                {i > 0 && <span className="mx-1">/</span>}
                <span>{crumb}</span>
              </span>
            ))}
            <span className="mx-1">/</span>
            <span className="text-gray-600 font-medium">{pageTitle}</span>
          </nav>
        )}
        <div className="text-base font-semibold text-gray-900">{pageTitle}</div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-sm text-gray-500">{tenantName}</div>
        <div
          className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500 select-none"
          aria-hidden="true"
        />
        <Button variant="ghost" onClick={onLogout} className="text-gray-600">
          Logout
        </Button>
      </div>
    </div>
  );
}
