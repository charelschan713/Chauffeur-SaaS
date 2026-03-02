'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { WizardLayout } from '@/components/patterns/Wizard';
import api from '@/lib/api';

export default function NewServiceClassPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [surgeMultiplier, setSurgeMultiplier] = useState('1.0');
  const [currency, setCurrency] = useState('AUD');
  const [displayOrder, setDisplayOrder] = useState('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const steps = [{ id: 'details', label: 'Service Class Details' }];

  async function handleSubmit() {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/pricing/service-classes', {
        name,
        description,
        surgeMultiplier: Number(surgeMultiplier),
        currency,
        displayOrder: Number(displayOrder),
      });
      router.push(`/pricing/${res.data.id}`);
    } catch {
      setError('Failed to create service class');
    } finally {
      setLoading(false);
    }
  }

  return (
    <WizardLayout
      steps={steps}
      currentStepId="details"
      footer={
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? 'Saving...' : 'Create Service Class'}
        </button>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded text-sm">{error}</div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Luxury Sedan"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Premium chauffeur service"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Surge Multiplier</label>
            <input
              value={surgeMultiplier}
              onChange={(e) => setSurgeMultiplier(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
            <input
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>
    </WizardLayout>
  );
}
