'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (!payload.isPlatformAdmin) {
        router.push('/tenant/dashboard');
        return;
      }
      setReady(true);
    } catch {
      router.push('/login');
    }
  }, [router]);

  if (!ready) return null;

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-lg font-bold">Platform Admin</h1>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <Link
            href="/platform/overview"
            className="block px-3 py-2 rounded hover:bg-gray-700"
          >
            Overview
          </Link>
          <Link
            href="/platform/tenants"
            className="block px-3 py-2 rounded hover:bg-gray-700"
          >
            Tenants
          </Link>
        </nav>
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={async () => {
              await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/auth/logout`,
                { method: 'POST', credentials: 'include' }
              );
              sessionStorage.removeItem('access_token');
              router.push('/login');
            }}
            className="w-full text-left px-3 py-2 text-gray-400 hover:text-white"
          >
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">
        {children}
      </main>
    </div>
  );
}
