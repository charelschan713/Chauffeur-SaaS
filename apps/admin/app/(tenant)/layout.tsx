'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [tenantName, setTenantName] = useState('');

  useEffect(() => {
    const token = sessionStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.isPlatformAdmin) {
        router.push('/overview');
        return;
      }
      setTenantName(payload.tenant_id ?? '');
      setReady(true);
    } catch {
      router.push('/login');
    }
  }, [router]);

  if (!ready) return null;

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-blue-900 text-white flex flex-col">
        <div className="p-6 border-b border-blue-800">
          <h1 className="text-lg font-bold">Admin Portal</h1>
          <p className="text-xs text-blue-300 mt-1">{tenantName}</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <Link href="/dashboard" className="block px-3 py-2 rounded hover:bg-blue-800">
            Dashboard
          </Link>
          <Link href="/bookings" className="block px-3 py-2 rounded hover:bg-blue-800">
            Bookings
          </Link>
          <Link href="/drivers" className="block px-3 py-2 rounded hover:bg-blue-800">
            Drivers
          </Link>
          <Link href="/dispatch" className="block px-3 py-2 rounded hover:bg-blue-800">
            Dispatch
          </Link>
          <Link href="/bookings" className="block px-3 py-2 rounded hover:bg-blue-800">
            Payments
          </Link>
          <Link href="/dashboard" className="block px-3 py-2 rounded hover:bg-blue-800">
            Settings
          </Link>
        </nav>
        <div className="p-4 border-t border-blue-800">
          <button
            onClick={async () => {
              await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
                method: 'POST',
                credentials: 'include',
              });
              sessionStorage.removeItem('access_token');
              router.push('/login');
            }}
            className="w-full text-left px-3 py-2 text-blue-300 hover:text-white"
          >
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
