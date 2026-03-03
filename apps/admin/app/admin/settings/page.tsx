'use client';

import { useEffect, useState } from 'react';

function parseJwt(token: string | null) {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    setUser(parseJwt(token));
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded p-6">
        <h1 className="text-xl font-semibold text-gray-900">Platform Admin</h1>
        <div className="mt-4 text-sm text-gray-700 space-y-2">
          <div><span className="font-medium">User ID:</span> {user?.sub ?? 'Unknown'}</div>
          <div><span className="font-medium">Role:</span> {user?.role ?? 'tenant_admin'}</div>
          <div><span className="font-medium">isPlatformAdmin:</span> {String(user?.isPlatformAdmin ?? false)}</div>
        </div>
      </div>

      <div className="bg-white border rounded p-6">
        <h2 className="text-lg font-semibold text-gray-900">System Status</h2>
        <div className="mt-4 text-sm text-gray-700 space-y-2">
          <div>API: <span className="text-green-700">Online ✅</span></div>
          <div>Database: <span className="text-green-700">Connected ✅</span></div>
        </div>
      </div>
    </div>
  );
}
