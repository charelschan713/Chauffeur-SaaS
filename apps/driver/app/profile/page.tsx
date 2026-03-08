'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import api from '@/lib/api';
import BottomNav from '@/components/BottomNav';

const GOLD = '#C8A870', CARD = '#222236', MUTED = '#9CA3AF';

export default function ProfilePage() {
  const router = useRouter();
  const { token, driverName, clearAuth } = useAuthStore();
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    if (!token) { router.replace('/login'); return; }
    api.get('/driver-app/me').then(r => setMe(r.data)).catch(() => {});
  }, [token]);

  const logout = () => { clearAuth(); router.replace('/login'); };

  return (
    <div style={{ minHeight: '100vh', background: '#1A1A2E', paddingBottom: 100 }}>
      <div style={{ padding: '48px 16px 20px', background: '#16162A' }}>
        <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: 0 }}>Profile</h1>
      </div>

      <div style={{ padding: '20px 16px' }}>
        {/* Avatar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: GOLD + '22', border: `2px solid ${GOLD}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <span style={{ color: GOLD, fontSize: 28, fontWeight: 700 }}>
              {(driverName ?? 'D').charAt(0).toUpperCase()}
            </span>
          </div>
          <p style={{ color: '#fff', fontWeight: 600, fontSize: 17, margin: '0 0 4px' }}>{driverName ?? '—'}</p>
          <span style={{ background: GOLD + '22', color: GOLD, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999 }}>DRIVER</span>
        </div>

        {/* Info card */}
        {me && (
          <div style={{ background: CARD, borderRadius: 12, padding: 16, marginBottom: 12, border: '0.5px solid #333355' }}>
            {me.email && <Row label="Email" value={me.email} />}
            {(me.phone_country_code || me.phone_number) && (
              <Row label="Phone" value={`${me.phone_country_code ?? ''}${me.phone_number ?? ''}`} />
            )}
            <Row label="Status" value={
              <span style={{ color: me.availability_status === 'ONLINE' ? '#22C55E' : MUTED }}>
                {me.availability_status ?? 'OFFLINE'}
              </span>
            } />
          </div>
        )}

        {/* Sign out */}
        <button onClick={logout} style={{
          width: '100%', padding: '14px 0', background: 'transparent',
          border: '1px solid #EF4444', borderRadius: 12, color: '#EF4444',
          fontWeight: 600, fontSize: 14, cursor: 'pointer', marginTop: 8,
        }}>
          Sign Out
        </button>
      </div>

      <BottomNav active="profile" />
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
      <span style={{ color: MUTED, fontSize: 13 }}>{label}</span>
      <span style={{ color: '#fff', fontSize: 13 }}>{value}</span>
    </div>
  );
}
