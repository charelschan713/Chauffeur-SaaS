'use client';

import React from 'react';

interface KpiCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: string;
  accent?: 'blue' | 'green' | 'orange' | 'purple' | 'gray';
  loading?: boolean;
}

const ACCENT_CLASSES: Record<string, { bg: string; icon: string; bar: string }> = {
  blue:   { bg: 'bg-blue-50',   icon: 'text-blue-600',   bar: 'bg-blue-500' },
  green:  { bg: 'bg-green-50',  icon: 'text-green-600',  bar: 'bg-green-500' },
  orange: { bg: 'bg-orange-50', icon: 'text-orange-600', bar: 'bg-orange-500' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-600', bar: 'bg-purple-500' },
  gray:   { bg: 'bg-gray-50',   icon: 'text-gray-500',   bar: 'bg-gray-400' },
};

export function KpiCard({ title, value, icon, trend, accent = 'blue', loading }: KpiCardProps) {
  const cls = ACCENT_CLASSES[accent] ?? ACCENT_CLASSES.blue;

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 animate-pulse">
        <div className="flex items-center justify-between mb-3">
          <div className="h-3 w-24 bg-gray-200 rounded" />
          <div className="h-8 w-8 bg-gray-200 rounded-lg" />
        </div>
        <div className="h-7 w-16 bg-gray-200 rounded mt-2" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Top color bar */}
      <div className={`h-1 ${cls.bar}`} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">
              {title}
            </p>
            <p className="mt-1.5 text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
            {trend && <p className="mt-1 text-xs text-gray-400">{trend}</p>}
          </div>
          {icon && (
            <div className={`shrink-0 w-9 h-9 rounded-lg ${cls.bg} flex items-center justify-center`}>
              <span className={cls.icon}>{icon}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function KpiSkeleton() {
  return <KpiCard title="" value="" loading />;
}
