'use client';

import React from 'react';

interface PageToolbarProps {
  left?: React.ReactNode;
  right?: React.ReactNode;
}

export function PageToolbar({ left, right }: PageToolbarProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
      <div className="flex items-center gap-3">{left}</div>
      <div className="flex items-center gap-3">{right}</div>
    </div>
  );
}
