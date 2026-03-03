'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface VehicleRow {
  id: string;
  make: string;
  model: string;
  active: boolean;
}

function ActiveBadge({ active }: { active: boolean }) {
  return <span className={`px-2 py-1 rounded text-xs ${active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>{active ? 'Active' : 'Inactive'}</span>;
}

export default function VehiclesPage() {
  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ['platform-vehicles'],
    queryFn: async () => {
      const res = await api.get('/platform/vehicles');
      return res.data ?? [];
    },
  });

  const [form, setForm] = useState({ make: '', model: '' });
  const [editingId, setEditingId] = useState<string | null>(null);

  const vehicles = data as VehicleRow[];
  const editing = useMemo(() => vehicles.find((v) => v.id === editingId) ?? null, [vehicles, editingId]);

  async function handleCreate() {
    await api.post('/platform/vehicles', form);
    setForm({ make: '', model: '' });
    await refetch();
  }

  async function handleUpdate() {
    if (!editingId) return;
    await api.patch(`/platform/vehicles/${editingId}`, {
      make: form.make,
      model: form.model,
    });
    setEditingId(null);
    setForm({ make: '', model: '' });
    await refetch();
  }

  async function deactivate(id: string) {
    await api.patch(`/platform/vehicles/${id}`, { active: false });
    await refetch();
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded p-6 space-y-4">
        <h1 className="text-xl font-semibold">Platform Vehicles</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            value={form.make}
            onChange={(e) => setForm((prev) => ({ ...prev, make: e.target.value }))}
            placeholder="Make"
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            value={form.model}
            onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))}
            placeholder="Model"
            className="border rounded px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={editingId ? handleUpdate : handleCreate}
              className="px-4 py-2 rounded bg-blue-600 text-white text-sm"
            >
              {editingId ? 'Update' : 'Create'}
            </button>
            {editingId && (
              <button
                onClick={() => { setEditingId(null); setForm({ make: '', model: '' }); }}
                className="px-4 py-2 rounded border text-sm"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
        <div className="bg-white border rounded">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Make', 'Model', 'Status', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {vehicles.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{row.make}</td>
                  <td className="px-4 py-3">{row.model}</td>
                  <td className="px-4 py-3"><ActiveBadge active={row.active} /></td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => {
                        setEditingId(row.id);
                        setForm({ make: row.make, model: row.model });
                      }}
                      className="text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                    {row.active && (
                      <button
                        onClick={() => deactivate(row.id)}
                        className="text-red-600 hover:underline"
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
