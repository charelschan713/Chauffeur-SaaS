'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WizardLayout } from '@/components/patterns/Wizard';
import api from '@/lib/api';

export default function ClaimVehiclePage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/vehicles/platform-vehicles').then((res) => setVehicles(res.data ?? []));
  }, []);

  const steps = [{ id: 'select', label: 'Select Platform Vehicle' }];

  async function handleSubmit() {
    if (!selectedId) {
      setError('Please select a vehicle');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/vehicles', { platformVehicleId: selectedId });
      router.push('/vehicles');
    } catch {
      setError('Failed to claim vehicle');
    } finally {
      setLoading(false);
    }
  }

  return (
    <WizardLayout
      steps={steps}
      currentStepId="select"
      footer={
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? 'Saving...' : 'Claim Vehicle'}
        </button>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded text-sm">{error}</div>
        )}
        <div className="space-y-2">
          {vehicles.map((v) => (
            <label key={v.id} className="flex items-center gap-3 p-3 border rounded-lg">
              <input
                type="radio"
                name="vehicle"
                value={v.id}
                checked={selectedId === v.id}
                onChange={() => setSelectedId(v.id)}
              />
              <div>
                <div className="font-medium text-gray-900">{v.make} {v.model}</div>
                <div className="text-xs text-gray-500">{v.vehicle_type_name} • {v.year}</div>
              </div>
            </label>
          ))}
          {vehicles.length === 0 && (
            <div className="text-sm text-gray-500">No platform vehicles available</div>
          )}
        </div>
      </div>
    </WizardLayout>
  );
}
