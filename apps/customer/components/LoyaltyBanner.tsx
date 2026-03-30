'use client';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import api from '@/lib/api';

export function LoyaltyBanner() {
  const { token } = useAuthStore();
  const [info, setInfo] = useState<{ tier?: string; discount_rate?: number } | null>(null);

  useEffect(() => {
    if (!token) { setInfo(null); return; }
    api.get('/customer-portal/profile')
      .then(r => setInfo(r.data))
      .catch(() => {});
  }, [token]);

  if (!info) return null;
  const rate = Number(info.discount_rate ?? 0);
  const tier = info.tier && info.tier !== 'STANDARD' ? info.tier : null;
  if (!tier && rate <= 0) return null;

  // Build label: "VIP Member — 20% OFF" or "Loyalty Member — 10% OFF"
  const tierLabel = tier ? `${tier} Member` : 'Loyalty Member';
  const label = rate > 0 ? `${tierLabel} — ${rate.toFixed(0)}% OFF applied to all bookings` : tierLabel;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9998] flex items-center justify-center gap-2 px-4 py-1.5"
      style={{ background: 'linear-gradient(90deg, #1A1A2E 0%, #222236 100%)', borderBottom: '1px solid #C8A87033' }}>
      {tier && (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
          style={{ backgroundColor: '#333355' }}>
          {tier}
        </span>
      )}
      <span className="text-[10px] font-semibold"
        style={{ color: '#C8A870' }}>
        {label}
      </span>
    </div>
  );
}
