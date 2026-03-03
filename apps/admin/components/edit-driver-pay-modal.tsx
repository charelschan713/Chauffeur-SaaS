'use client';
import { useState } from 'react';
import api from '@/lib/api';

export function EditDriverPayModal({
  isOpen,
  onClose,
  assignmentId,
  onUpdated,
}: {
  isOpen: boolean;
  onClose: () => void;
  assignmentId: string | null;
  onUpdated: () => void;
}) {
  const [payType, setPayType] = useState<'FIXED' | 'PERCENTAGE'>('PERCENTAGE');
  const [payValue, setPayValue] = useState('70');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!assignmentId) return;
    setSaving(true);
    await api.patch(`/assignments/${assignmentId}/driver-pay`, {
      driver_pay_type: payType,
      driver_pay_value: Number(payValue),
    });
    setSaving(false);
    onUpdated();
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Edit Driver Pay</h3>
        </div>
        <div className="p-6 space-y-4">
          <select
            value={payType}
            onChange={(e) => setPayType(e.target.value as 'FIXED' | 'PERCENTAGE')}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            <option value="PERCENTAGE">Percentage</option>
            <option value="FIXED">Fixed</option>
          </select>
          <input
            value={payValue}
            onChange={(e) => setPayValue(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder={payType === 'FIXED' ? 'Amount' : 'Percent'}
          />
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded border text-sm">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
