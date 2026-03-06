'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { ListPage } from '@/components/patterns/ListPage';
import {PageLoader, InlineSpinner} from '@/components/ui/LoadingSpinner';

const TIMEZONES = [
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Brisbane',
  'Australia/Perth',
  'Australia/Adelaide',
  'Australia/Darwin',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Pacific/Auckland',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
];

interface CityRow {
  id: string;
  name: string;
  timezone: string;
  active: boolean;
}

export default function CitiesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['cities'],
    queryFn: async () => {
      const res = await api.get('/cities');
      return res.data ?? [];
    },
  });

  const cities: CityRow[] = data ?? [];
  const [form, setForm] = useState({ name: '', timezone: 'Australia/Sydney', lat: '', lng: '' });
  const [saving, setSaving] = useState(false);

  async function addCity() {
    if (!form.name.trim()) return;
    setSaving(true);
    await api.post('/cities', {
      name: form.name.trim(),
      timezone: form.timezone,
      lat: form.lat ? Number(form.lat) : null,
      lng: form.lng ? Number(form.lng) : null,
    });
    const res = await api.get('/cities');
    queryClient.setQueryData(['cities'], res.data ?? []);
    setForm({ name: '', timezone: 'Australia/Sydney', lat: '', lng: '' });
    await refetch();
    setSaving(false);
  }

  async function toggleActive(city: CityRow) {
    await api.patch(`/cities/${city.id}`, { active: !city.active });
    await refetch();
  }

  async function move(index: number, dir: -1 | 1) {
    const newOrder = [...cities];
    const target = index + dir;
    if (target < 0 || target >= newOrder.length) return;
    [newOrder[index], newOrder[target]] = [newOrder[target], newOrder[index]];
    await api.post('/cities/reorder', { ids: newOrder.map((c) => c.id) });
    await refetch();
  }

  return (
    <ListPage
      title="Cities"
      subtitle="Manage service cities for your tenant"
      filters={
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="Sydney"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
            <select
              value={form.timezone}
              onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Latitude <span className="text-gray-400 font-normal">(for address bias)</span></label>
            <input type="number" step="any" value={form.lat}
              onChange={(e) => setForm((prev) => ({ ...prev, lat: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm" placeholder="-33.8688" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
            <input type="number" step="any" value={form.lng}
              onChange={(e) => setForm((prev) => ({ ...prev, lng: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm" placeholder="151.2093" />
          </div>
          <button
            onClick={addCity}
            disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? <><InlineSpinner />Saving...</> : 'Add City'}
          </button>
        </div>
      }
      table={
        isLoading ? (
          <div className="p-6 text-sm text-gray-500">Loading...</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {['Order', 'Name', 'Timezone', 'Status', ''].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {cities.map((city, idx) => (
                <tr key={city.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 text-sm">
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => move(idx, -1)} disabled={idx === 0}
                        className="px-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs leading-none">▲</button>
                      <button onClick={() => move(idx, 1)} disabled={idx === cities.length - 1}
                        className="px-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs leading-none">▼</button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{city.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{city.timezone}</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        city.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {city.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <button
                      onClick={() => toggleActive(city)}
                      className="text-blue-600 hover:underline"
                    >
                      {city.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
              {cities.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-500">
                    No cities configured yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )
      }
    />
  );
}
