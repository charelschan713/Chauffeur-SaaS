'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ListPage } from '@/components/patterns/ListPage';
import api from '@/lib/api';

export default function VehiclesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['tenant-vehicles'],
    queryFn: async () => {
      const res = await api.get('/vehicles');
      return res.data ?? [];
    },
  });

  const { data: platformVehicles = [] } = useQuery({
    queryKey: ['platform-vehicles-public'],
    queryFn: async () => {
      const res = await api.get('/platform/vehicles/public');
      return res.data ?? [];
    },
  });

  const vehicles = data ?? [];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    platform_vehicle_id: '',
    year: '',
    colour: '',
    plate: '',
    passenger_capacity: 4,
    luggage_capacity: 2,
    notes: '',
  });

  const editing = useMemo(() => vehicles.find((v: any) => v.id === editingId) ?? null, [vehicles, editingId]);

  function loadForm(v: any) {
    setForm({
      platform_vehicle_id: v.platform_vehicle_id ?? '',
      year: v.year ?? '',
      colour: v.colour ?? '',
      plate: v.plate ?? '',
      passenger_capacity: v.passenger_capacity ?? 4,
      luggage_capacity: v.luggage_capacity ?? 2,
      notes: v.notes ?? '',
    });
  }

  async function handleUpdate() {
    if (!editingId) return;
    await api.patch(`/vehicles/${editingId}`, {
      platform_vehicle_id: form.platform_vehicle_id || null,
      year: form.year ? Number(form.year) : null,
      colour: form.colour || null,
      plate: form.plate || null,
      passenger_capacity: Number(form.passenger_capacity) || 4,
      luggage_capacity: Number(form.luggage_capacity) || 2,
      notes: form.notes || null,
    });
    setEditingId(null);
    await queryClient.invalidateQueries({ queryKey: ['tenant-vehicles'] });
  }

  async function deactivate(id: string) {
    await api.patch(`/vehicles/${id}`, { active: false });
    await queryClient.invalidateQueries({ queryKey: ['tenant-vehicles'] });
  }

  return (
    <ListPage
      title="Fleet Vehicles"
      subtitle="Manage your tenant fleet"
      actions={
        <Link
          href="/vehicles/new"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Add Vehicle
        </Link>
      }
      table={
        isLoading ? (
          <div className="p-6 text-sm text-gray-500">Loading...</div>
        ) : (
          <div>
            {editingId && (
              <div className="bg-white border rounded p-4 mb-4 space-y-3">
                <h3 className="text-sm font-semibold">Edit Vehicle</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <select
                    className="border rounded px-3 py-2 text-sm"
                    value={form.platform_vehicle_id}
                    onChange={(e) => setForm((p) => ({ ...p, platform_vehicle_id: e.target.value }))}
                  >
                    <option value="">Select Platform Vehicle</option>
                    {(platformVehicles as any[]).map((pv) => (
                      <option key={pv.id} value={pv.id}>{pv.make} {pv.model}</option>
                    ))}
                  </select>
                  <input className="border rounded px-3 py-2 text-sm" placeholder="Year" value={form.year} onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))} />
                  <input className="border rounded px-3 py-2 text-sm" placeholder="Colour" value={form.colour} onChange={(e) => setForm((p) => ({ ...p, colour: e.target.value }))} />
                  <input className="border rounded px-3 py-2 text-sm" placeholder="Plate" value={form.plate} onChange={(e) => setForm((p) => ({ ...p, plate: e.target.value }))} />
                  <input className="border rounded px-3 py-2 text-sm" placeholder="Passenger Capacity" value={form.passenger_capacity} onChange={(e) => setForm((p) => ({ ...p, passenger_capacity: Number(e.target.value) }))} />
                  <input className="border rounded px-3 py-2 text-sm" placeholder="Luggage Capacity" value={form.luggage_capacity} onChange={(e) => setForm((p) => ({ ...p, luggage_capacity: Number(e.target.value) }))} />
                  <input className="border rounded px-3 py-2 text-sm" placeholder="Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleUpdate} className="px-4 py-2 rounded bg-blue-600 text-white text-sm">Save</button>
                  <button onClick={() => setEditingId(null)} className="px-4 py-2 rounded border text-sm">Cancel</button>
                </div>
              </div>
            )}
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {['Vehicle', 'Year', 'Colour', 'Plate', 'Capacity', 'Status', ''].map((h) => (
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
                {vehicles.map((v: any) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{v.make} {v.model}</div>
                    </td>
                    <td className="px-6 py-4 text-sm">{v.year ?? '—'}</td>
                    <td className="px-6 py-4 text-sm">{v.colour ?? '—'}</td>
                    <td className="px-6 py-4 text-sm">{v.plate ?? '—'}</td>
                    <td className="px-6 py-4 text-sm">
                      {v.passenger_capacity} pax / {v.luggage_capacity} bags
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          v.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {v.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right space-x-2">
                      <button className="text-blue-600 hover:underline" onClick={() => { setEditingId(v.id); loadForm(v); }}>Edit</button>
                      {v.active && (
                        <button className="text-red-600 hover:underline" onClick={() => deactivate(v.id)}>Deactivate</button>
                      )}
                    </td>
                  </tr>
                ))}
                {vehicles.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-gray-500">
                      No vehicles yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )
      }
    />
  );
}
