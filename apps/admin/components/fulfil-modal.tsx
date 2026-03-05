'use client';

import { useState } from 'react';
import api from '@/lib/api';

interface FulfilModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  bookingRef: string;
  originalMinor: number;
  currency: string;
  driverReport?: {
    extra_waypoints?: string[];
    waiting_minutes?: number;
    extra_toll?: number;
    extra_parking?: number;
    notes?: string;
  } | null;
  onFulfilled: () => void;
}

function fmt(minor: number, currency: string) {
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

export function FulfilModal({
  isOpen,
  onClose,
  bookingId,
  bookingRef,
  originalMinor,
  currency,
  driverReport,
  onFulfilled,
}: FulfilModalProps) {
  const [extraAmount, setExtraAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const extraMinor = Math.round((parseFloat(extraAmount) || 0) * 100);
  const totalMinor = originalMinor + extraMinor;
  const hasExtra = extraMinor > 0;

  async function handleFulfil() {
    setLoading(true);
    setError(null);
    try {
      await api.post(`/bookings/${bookingId}/fulfil`, {
        extra_amount_minor: extraMinor,
        note: note.trim() || null,
      });
      onFulfilled();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to fulfil booking');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h3 className="font-semibold text-gray-900">Review & Fulfil</h3>
            <p className="text-xs text-gray-500 mt-0.5">{bookingRef}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="p-6 space-y-5">

          {/* Driver Report (reference) */}
          {driverReport && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-1.5">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Driver Report</p>
              {driverReport.extra_waypoints?.length ? (
                <p className="text-sm text-amber-800">📍 Extra stops: {driverReport.extra_waypoints.join(' → ')}</p>
              ) : null}
              {driverReport.waiting_minutes ? (
                <p className="text-sm text-amber-800">⏱ Waiting: {driverReport.waiting_minutes} min</p>
              ) : null}
              {driverReport.extra_toll ? (
                <p className="text-sm text-amber-800">🚗 Toll: {currency} {driverReport.extra_toll.toFixed(2)}</p>
              ) : null}
              {driverReport.extra_parking ? (
                <p className="text-sm text-amber-800">🅿️ Parking: {currency} {driverReport.extra_parking.toFixed(2)}</p>
              ) : null}
              {driverReport.notes ? (
                <p className="text-sm text-amber-800 italic">"{driverReport.notes}"</p>
              ) : null}
            </div>
          )}

          {/* Original charge */}
          <div className="bg-gray-50 rounded-lg p-4 flex justify-between items-center">
            <span className="text-sm text-gray-600">Original Charged</span>
            <span className="font-semibold text-gray-900">{fmt(originalMinor, currency)}</span>
          </div>

          {/* Extra amount */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Extra Amount
            </label>
            <div className="flex items-center border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
              <span className="px-3 py-2.5 bg-gray-50 text-gray-500 text-sm border-r">{currency}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={extraAmount}
                onChange={e => setExtraAmount(e.target.value)}
                className="flex-1 px-3 py-2.5 text-sm outline-none"
              />
            </div>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Note / Reason
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Extra waiting 30 min + toll via M5"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Total */}
          <div className={`rounded-lg p-4 flex justify-between items-center ${hasExtra ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50'}`}>
            <span className="text-sm font-medium text-gray-700">Total to Charge</span>
            <span className={`text-lg font-bold ${hasExtra ? 'text-blue-700' : 'text-gray-900'}`}>
              {fmt(totalMinor, currency)}
            </span>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border rounded-lg py-2.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleFulfil}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {loading ? 'Processing…' : hasExtra ? '💳 Charge Extra & Fulfil' : '✅ Mark Fulfilled'}
          </button>
        </div>

      </div>
    </div>
  );
}
