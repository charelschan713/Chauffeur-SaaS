'use client';

import { Sidebar } from './Sidebar';
import { AdminTopbar } from './AdminTopbar';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <AdminTopbar />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
      <aside className="hidden xl:flex w-64 border-l border-gray-200 bg-white" />
    </div>
  );
}
