'use client';

import React from 'react';

interface TableProps {
  headers: string[];
  children: React.ReactNode;
  empty?: React.ReactNode;
}

export function Table({ headers, children, empty }: TableProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {children}
        </tbody>
      </table>
      {empty && <div className="px-6 py-10 text-center text-sm text-gray-500">{empty}</div>}
    </div>
  );
}
