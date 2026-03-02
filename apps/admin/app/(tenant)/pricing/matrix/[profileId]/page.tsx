'use client';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { DetailPage, DetailSection } from '@/components/patterns/DetailPage';

type ItemState = { type: string; label: string; amount: string; enabled: boolean };

type PricingProfile = {
  id: string;
  service_type_id: string;
  service_class_id: string;
  service_type_code: string;
  service_type_name: string;
  service_class_name: string;
};

const PTP_ITEMS = [
  { type: 'BASE_FARE', label: 'Base Fare ($)' },
  { type: 'PER_KM', label: 'Per KM ($)' },
  { type: 'DRIVING_TIME', label: 'Per Min Driving ($)' },
  { type: 'WAITING_TIME', label: 'Waiting Per Min ($)' },
  { type: 'MINIMUM_FARE', label: 'Minimum Fare ($)' },
  { type: 'WAYPOINT', label: 'Waypoint ($)' },
  { type: 'INFANT_SEAT', label: 'Infant Seat ($)' },
  { type: 'TODDLER_SEAT', label: 'Toddler Seat ($)' },
  { type: 'BOOSTER_SEAT', label: 'Booster Seat ($)' },
];

const HOURLY_ITEMS = [
  { type: 'HOURLY_RATE', label: 'Hourly Rate ($)' },
  { type: 'PER_KM', label: 'Per KM Excess ($)' },
  { type: 'WAYPOINT', label: 'Waypoint ($)' },
  { type: 'INFANT_SEAT', label: 'Infant Seat ($)' },
  { type: 'TODDLER_SEAT', label: 'Toddler Seat ($)' },
  { type: 'BOOSTER_SEAT', label: 'Booster Seat ($)' },
];

export default function PricingMatrixEditorPage() {
  const params = useParams();
  const profileId = String(params.profileId);
  const [saving, setSaving] = useState(false);

  const { data: profiles = [] } = useQuery({
    queryKey: ['pricing-profiles'],
    queryFn: async () => {
      const res = await api.get('/pricing-profiles');
      return res.data ?? [];
    },
  });

  const profile = (profiles as PricingProfile[]).find((p) => p.id === profileId);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['pricing-profile-items', profileId],
    queryFn: async () => {
      const res = await api.get(`/pricing-profiles/${profileId}/items`);
      return res.data;
    },
  });

  const defaultItems = useMemo(() => {
    const base = profile?.service_type_code === 'HOURLY_CHARTER' ? HOURLY_ITEMS : PTP_ITEMS;
    return base.map((item) => ({
      ...item,
      amount: '',
      enabled: false,
    }));
  }, [profile?.service_type_code]);

  const itemsState = useMemo<ItemState[]>(() => {
    const existing = new Map<string, any>();
    for (const item of data?.items ?? []) {
      existing.set(item.item_type, item);
    }
    return defaultItems.map((item) => {
      const current = existing.get(item.type);
      return {
        type: item.type,
        label: item.label,
        amount: current ? (Number(current.amount_minor) / 100).toFixed(2) : '',
        enabled: current ? Boolean(current.active) : false,
      };
    });
  }, [data?.items, defaultItems]);

  const [items, setItems] = useState<ItemState[]>(itemsState);

  const hourlyConfig = data?.hourlyConfig ?? null;
  const [minimumHours, setMinimumHours] = useState(
    hourlyConfig?.minimum_hours ?? 2,
  );
  const [kmPerHourIncluded, setKmPerHourIncluded] = useState(
    hourlyConfig?.km_per_hour_included ?? 0,
  );

  if (!profile) {
    return <div className="text-sm text-gray-500">Loading profile...</div>;
  }

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading pricing...</div>;
  }

  async function save() {
    setSaving(true);
    await api.put(`/pricing-profiles/${profileId}/items`, {
      items: items.map((item) => ({
        type: item.type,
        amount: Number(item.amount || 0),
        enabled: item.enabled,
      })),
      hourlyConfig:
        profile.service_type_code === 'HOURLY_CHARTER'
          ? {
              minimum_hours: Number(minimumHours || 0),
              km_per_hour_included: Number(kmPerHourIncluded || 0),
            }
          : undefined,
    });
    await refetch();
    setSaving(false);
  }

  return (
    <DetailPage
      title="Pricing Profile"
      subtitle={`${profile.service_type_name} · ${profile.service_class_name}`}
      actions={
        <button
          onClick={save}
          disabled={saving}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      }
      primary={
        <DetailSection title="Pricing Items">
          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={item.type} className="flex flex-col md:flex-row gap-4 md:items-center">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {item.label}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={item.amount}
                    onChange={(e) => {
                      const next = [...items];
                      next[index] = { ...next[index], amount: e.target.value };
                      setItems(next);
                    }}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={(e) => {
                      const next = [...items];
                      next[index] = { ...next[index], enabled: e.target.checked };
                      setItems(next);
                    }}
                  />
                  Enabled
                </label>
              </div>
            ))}
          </div>
        </DetailSection>
      }
      secondary={
        profile.service_type_code === 'HOURLY_CHARTER' ? (
          <DetailSection title="Hourly Configuration">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Minimum Hours
                </label>
                <input
                  type="number"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={minimumHours}
                  onChange={(e) => setMinimumHours(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  KM per Hour Included
                </label>
                <input
                  type="number"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={kmPerHourIncluded}
                  onChange={(e) => setKmPerHourIncluded(Number(e.target.value))}
                />
              </div>
            </div>
          </DetailSection>
        ) : (
          <DetailSection title="Hourly Configuration">
            <p className="text-sm text-gray-500">Not required for point-to-point pricing.</p>
          </DetailSection>
        )
      }
    />
  );
}
