'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';

interface KpiCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: string;
}

export function KpiCard({ title, value, icon, trend }: KpiCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">{title}</div>
        {icon && <div className="text-gray-400">{icon}</div>}
      </div>
      <div className="mt-2 text-2xl font-semibold text-gray-900">{value}</div>
      {trend && <div className="mt-1 text-xs text-gray-500">{trend}</div>}
    </Card>
  );
}
