'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <aside className="w-64 bg-blue-900 text-white min-h-screen flex flex-col">
          <div className="px-6 py-4 text-lg font-semibold">Chauffeur Admin</div>
          <nav className="flex-1 px-4 space-y-1">
            <Link href="/dashboard" className="block px-3 py-2 rounded hover:bg-blue-800">
              Dashboard
            </Link>
            <Link href="/dispatch" className="block px-3 py-2 rounded hover:bg-blue-800">
              Dispatch
            </Link>
            <Link href="/drivers" className="block px-3 py-2 rounded hover:bg-blue-800">
              Drivers
            </Link>
            <Link href="/pricing/car-types" className="block px-3 py-2 rounded hover:bg-blue-800">
              Car Types
            </Link>
            <Link href="/pricing/service-types" className="block px-3 py-2 rounded hover:bg-blue-800">
              Service Types
            </Link>
            <Link href="/vehicles" className="block px-3 py-2 rounded hover:bg-blue-800">
              Vehicles
            </Link>
            <Link href="/bookings" className="block px-3 py-2 rounded hover:bg-blue-800">
              Bookings
            </Link>
            <Link href="/customers" className="block px-3 py-2 rounded hover:bg-blue-800">
              Customers
            </Link>
            <Link href="/settings/integrations" className="block px-3 py-2 rounded hover:bg-blue-800">
              Settings
            </Link>
            <Link href="/settings/general" className="block px-3 py-2 rounded hover:bg-blue-800">
              General
            </Link>
            <Link href="/settings/cities" className="block px-3 py-2 rounded hover:bg-blue-800">
              Cities
            </Link>
            <Link href="/settings/templates" className="block px-3 py-2 rounded hover:bg-blue-800">
              Templates
            </Link>
          </nav>
          <div className="p-4 border-t border-blue-800">
            <button
              onClick={async () => {
                await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
                  method: 'POST',
                  credentials: 'include',
                });
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                router.push('/login');
              }}
              className="w-full px-3 py-2 text-sm rounded bg-blue-800 hover:bg-blue-700"
            >
              Sign out
            </button>
          </div>
        </aside>
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
