'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/Button';

interface AdminTopbarProps {
  tenantName?: string;
  onLogout?: () => void;
}

function formatSegment(segment: string) {
  return segment
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AdminTopbar({ tenantName = 'Tenant', onLogout }: AdminTopbarProps) {
  const pathname = usePathname();
  const segments = pathname?.split('/').filter(Boolean) ?? [];
  const breadcrumb = segments.map((seg) => formatSegment(seg));
  const pageTitle = breadcrumb[breadcrumb.length - 1] ?? 'Dashboard';

  return (
    <div className="flex items-center justify-between h-14 border-b border-gray-200 bg-white px-6">
      <div className="space-y-1">
        <div className="text-sm text-gray-500">
          {breadcrumb.length > 0 ? breadcrumb.join(' / ') : 'Dashboard'}
        </div>
        <div className="text-lg font-semibold text-gray-900">{pageTitle}</div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-sm text-gray-500">{tenantName}</div>
        <div className="w-8 h-8 rounded-full bg-gray-200" aria-label="User menu" />
        <Button variant="ghost" onClick={onLogout} className="text-gray-600">
          Logout
        </Button>
      </div>
    </div>
  );
}
