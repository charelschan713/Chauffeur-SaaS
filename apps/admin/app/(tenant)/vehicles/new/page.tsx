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
  const [step, setStep] = useState<'select' | 'details'>('select');
  const [details, setDetails] = useState({
    year: '',
    colour: '',
    plate: '',
    passenger_capacity: 4,
    luggage_capacity: 2,
    notes: '',
  });

  useEffect(() => {
    api.get('/platform/vehicles/public').then((res) => setVehicles(res.data ?? []));
  }, []);

  const steps = [
    { id: 'select', label: 'Select Platform Vehicle' },
    { id: 'details', label: 'Vehicle Details' },
  ];

  async function handleSubmit() {
    if (!selectedId) {
      setError('Please select a vehicle');
      return;
    }
    if (step === 'select') {
      setStep('details');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/vehicles', {
        platform_vehicle_id: selectedId,
        year: details.year ? Number(details.year) : null,
        colour: details.colour || null,
        plate: details.plate || null,
        passenger_capacity: Number(details.passenger_capacity) || 4,
        luggage_capacity: Number(details.luggage_capacity) || 2,
        notes: details.notes || null,
      });
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
      currentStepId={step}
      footer={
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? 'Saving...' : step === 'select' ? 'Next' : 'Save Vehicle'}
        </button>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded text-sm">{error}</div>
        )}
        {step === 'select' && (
          <div className="space-y-2">
            {vehicles.map((v) => (
              <label key={v.id} className="flex items-center gap-3 p-3 border rounded-lg">
                <input
                  type="radio"
                  name="vehicle"
                  checked={selectedId === v.id}
                  onChange={() => setSelectedId(v.id)}
                />
                <div>
                  <div className="font-medium text-gray-900">{v.make} {v.model}</div>
                </div>
              </label>
            ))}
          </div>
        )}
        {step === 'details' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input className="border rounded px-3 py-2 text-sm" placeholder="Year" value={details.year} onChange={(e) => setDetails((p) => ({ ...p, year: e.target.value }))} />
            <input className="border rounded px-3 py-2 text-sm" placeholder="Colour" value={details.colour} onChange={(e) => setDetails((p) => ({ ...p, colour: e.target.value }))} />
            <input className="border rounded px-3 py-2 text-sm" placeholder="Plate" value={details.plate} onChange={(e) => setDetails((p) => ({ ...p, plate: e.target.value }))} />
            <input className="border rounded px-3 py-2 text-sm" placeholder="Passenger Capacity" value={details.passenger_capacity} onChange={(e) => setDetails((p) => ({ ...p, passenger_capacity: Number(e.target.value) }))} />
            <input className="border rounded px-3 py-2 text-sm" placeholder="Luggage Capacity" value={details.luggage_capacity} onChange={(e) => setDetails((p) => ({ ...p, luggage_capacity: Number(e.target.value) }))} />
            <input className="border rounded px-3 py-2 text-sm md:col-span-2" placeholder="Notes" value={details.notes} onChange={(e) => setDetails((p) => ({ ...p, notes: e.target.value }))} />
          </div>
        )}
      </div>
    </WizardLayout>
  );
}
