'use client';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import api from '@/lib/api';

export function LoyaltyBanner() {
  const { token } = useAuthStore();
  const [info, setInfo] = useState<{ tier?: string; discount_rate?: number } | null>(null);

  useEffect(() => {
    if (!token) { setInfo(null); return; }
    api.get('/customer-portal/me')
      .then(r => setInfo(r.data))
      .catch(() => {});
  }, [token]);

  if (!info || (!info.tier || info.tier === 'STANDARD') && !(Number(info.discount_rate) > 0)) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9998] flex items-center justify-center gap-2 px-4 py-1.5"
      style={{ background: 'linear-gradient(90deg, #1A1A2E 0%, #222236 100%)', borderBottom: '1px solid #C8A87033' }}>
      {info.tier && info.tier !== 'STANDARD' && (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
          style={{ backgroundColor: '#333355' }}>
          {info.tier}
        </span>
      )}
      {Number(info.discount_rate) > 0 && (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: '#C8A870', color: '#1A1A2E' }}>
          {Number(info.discount_rate).toFixed(0)}% OFF — Applied to all bookings
        </span>
      )}
    </div>
  );
}
