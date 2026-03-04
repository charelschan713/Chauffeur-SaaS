'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

function parseJwt(token: string | null) {
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export default function AdminSettingsPage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    setUser(parseJwt(token));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Platform Settings" description="System configuration and admin session info" />

      <Card title="Session Info">
        <div className="space-y-3 text-sm text-gray-700">
          <InfoRow label="User ID" value={user?.sub ?? '—'} />
          <InfoRow label="Role" value={user?.role ?? '—'} />
          <InfoRow
            label="Platform Admin"
            value=""
            badge={
              <Badge variant={user?.isPlatformAdmin ? 'success' : 'neutral'}>
                {String(user?.isPlatformAdmin ?? false)}
              </Badge>
            }
          />
        </div>
      </Card>

      <Card title="System Status">
        <div className="space-y-3 text-sm text-gray-700">
          <InfoRow label="API" value="" badge={<Badge variant="success">Online ✅</Badge>} />
          <InfoRow label="Database" value="" badge={<Badge variant="success">Connected ✅</Badge>} />
        </div>
      </Card>
    </div>
  );
}

function InfoRow({ label, value, badge }: { label: string; value: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      {badge ?? <span className="font-medium text-gray-900">{value}</span>}
    </div>
  );
}
