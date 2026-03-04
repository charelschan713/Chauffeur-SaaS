'use client';

import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizeClass = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-12 w-12' : 'h-8 w-8';
  return (
    <div
      className={`animate-spin rounded-full border-2 border-gray-200 border-t-blue-600 ${sizeClass} ${className}`}
    />
  );
}

export function PageLoader({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <LoadingSpinner size="lg" />
      {message && <p className="text-sm text-gray-500">{message}</p>}
    </div>
  );
}

export function InlineSpinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-1.5 opacity-70" />
  );
}
