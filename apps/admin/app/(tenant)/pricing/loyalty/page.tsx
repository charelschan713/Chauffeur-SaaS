'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { ListPage } from '@/components/patterns/ListPage';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type TierCode = 'STANDARD' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'VIP';

interface TierRow {
  tier: TierCode;
  discount_pct: number;
  active: boolean;
  sort_order: number;
}

const FALLBACK: TierRow[] = [
  { tier: 'STANDARD', discount_pct: 0, active: true, sort_order: 10 },
  { tier: 'SILVER', discount_pct: 5, active: true, sort_order: 20 },
  { tier: 'GOLD', discount_pct: 10, active: true, sort_order: 30 },
  { tier: 'PLATINUM', discount_pct: 15, active: true, sort_order: 40 },
  { tier: 'VIP', discount_pct: 20, active: true, sort_order: 50 },
];

export default function LoyaltyPricingPage() {
  const { data, isLoading, refetch } = useQuery<TierRow[]>({
    queryKey: ['loyalty-tiers'],
    queryFn: async () => {
      const res = await api.get('/loyalty/tiers');
      return (res.data ?? FALLBACK) as TierRow[];
    },
  });

  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<TierRow[]>([]);

  const source = rows.length ? rows : (data ?? FALLBACK);

  const updateRow = (tier: TierCode, patch: Partial<TierRow>) => {
    const base = source;
    setRows(base.map((r) => (r.tier === tier ? { ...r, ...patch } : r)));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.post('/loyalty/tiers', {
        tiers: source.map((r) => ({
          tier: r.tier,
          discount_pct: Number(r.discount_pct ?? 0),
          active: !!r.active,
          sort_order: Number(r.sort_order ?? 999),
        })),
      });
      setRows([]);
      await refetch();
      alert('Loyalty tiers saved');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ListPage
      title="Loyalty Tiers"
      subtitle="Configure tier discounts per tenant. Customer override discount_rate still applies on top."
      actions={<Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save tiers'}</Button>}
      table={isLoading ? (
        <div className="p-4 text-sm text-gray-500">Loading…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-2 text-left">Tier</th>
                <th className="px-4 py-2 text-left">Discount %</th>
                <th className="px-4 py-2 text-left">Active</th>
                <th className="px-4 py-2 text-left">Sort</th>
              </tr>
            </thead>
            <tbody>
              {source.map((r) => (
                <tr key={r.tier} className="border-t">
                  <td className="px-4 py-2 font-medium">{r.tier}</td>
                  <td className="px-4 py-2">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={String(r.discount_pct ?? 0)}
                      onChange={(e) => updateRow(r.tier, { discount_pct: Number(e.target.value || 0) })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={!!r.active}
                      onChange={(e) => updateRow(r.tier, { active: e.target.checked })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      type="number"
                      value={String(r.sort_order ?? 999)}
                      onChange={(e) => updateRow(r.tier, { sort_order: Number(e.target.value || 999) })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    />
  );
}
