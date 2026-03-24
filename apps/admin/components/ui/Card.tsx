'use client';

import React from 'react';

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  title?: string;
  actions?: React.ReactNode;
};

export function Card({ title, actions, className = '', children, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={`bg-white rounded-xl border border-gray-200/70 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ${className}`}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/70">
          {title && <div className="text-sm font-semibold text-gray-900">{title}</div>}
          {actions && <div>{actions}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
