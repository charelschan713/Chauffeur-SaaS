'use client';

import React from 'react';

interface TableProps {
  headers: string[];
  children: React.ReactNode;
  empty?: React.ReactNode;
}

export function Table({ headers, children, empty }: TableProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200/70 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50/80">
          <tr className="border-b border-gray-200/70">
            {headers.map((h) => (
              <th
                key={h}
                className="px-6 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {children}
        </tbody>
      </table>
      {empty && <div className="px-6 py-10 text-center text-sm text-gray-500">{empty}</div>}
    </div>
  );
}
