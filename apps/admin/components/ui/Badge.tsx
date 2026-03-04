'use client';

import React from 'react';

type Variant = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant;
};

const VARIANT_CLASSES: Record<Variant, string> = {
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger: 'bg-red-100 text-red-700',
  neutral: 'bg-gray-100 text-gray-700',
  info: 'bg-blue-100 text-blue-700',
};

export function Badge({ variant = 'neutral', className = '', ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        VARIANT_CLASSES[variant]
      } ${className}`}
    />
  );
}
