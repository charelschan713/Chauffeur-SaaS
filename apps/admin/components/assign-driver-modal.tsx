'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';

interface AssignDriverModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  leg: 'A' | 'B';
  carTypeId: string | null;
  fareMinor: number;        // base fare (excl. toll)
  tollParkingMinor: number; // toll/parking
  totalPriceMinor: number;  // grand total
  currency: string;
  onAssigned: () => void;
}

function formatMinor(minor: number, currency: string) {
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

export function AssignDriverModal({
  isOpen,
  onClose,
  bookingId,
  leg,
  carTypeId,
  fareMinor,
  tollParkingMinor,
  totalPriceMinor,
  currency,
  onAssigned,
}: AssignDriverModalProps) {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [payType, setPayType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [payValue, setPayValue] = useState(70);
  const [tollEditable, setTollEditable] = useState(tollParkingMinor / 100);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-calculate driver pay
  const driverPayMinor = useMemo(() => {
    if (payType === 'PERCENTAGE') {
      return Math.round(fareMinor * payValue / 100);
    }
    return Math.round(payValue * 100);
  }, [payType, payValue, fareMinor]);

  const driverTotalMinor = driverPayMinor + Math.round(tollEditable * 100);

  // Load data when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setSelectedDriver('');
    setSelectedVehicle('');
    setError(null);
    setTollEditable(tollParkingMinor / 100);

    // Load all drivers (no status filter)
    api.get('/drivers').then((res) => {
      setDrivers(res.data?.data ?? res.data ?? []);
    });

    // Load assignable vehicles
    if (carTypeId) {
      api.get(`/vehicles/assignable?car_type_id=${carTypeId}`).then((res) => {
        setVehicles(Array.isArray(res.data) ? res.data : (res.data?.data ?? []));
      });
    } else {
      api.get('/vehicles/assignable').then((res) => {
        setVehicles(Array.isArray(res.data) ? res.data : (res.data?.data ?? []));
      });
    }

    // Load tenant default driver pay settings
    api.get('/tenants/settings').then((res) => {
      if (res.data?.default_driver_pay_type) {
        setPayType(res.data.default_driver_pay_type);
      }
      if (res.data?.default_driver_pay_value != null) {
        setPayValue(res.data.default_driver_pay_value);
      }
    });
  }, [isOpen, carTypeId, tollParkingMinor]);

  async function handleAssign() {
    if (!selectedDriver || !selectedVehicle) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/assignments/bookings/${bookingId}/assign`, {
        driver_id: selectedDriver,
        vehicle_id: selectedVehicle,
        driver_pay_type: payType,
        driver_pay_value: payValue,
        toll_parking_minor: Math.round(tollEditable * 100),
        leg,
      });
      onAssigned();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to assign driver. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4">

        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {leg === 'B' ? 'Assign Driver — Return' : 'Assign Driver'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-6 grid grid-cols-2 gap-6">

          {/* Left — Customer Payment Summary (read-only) */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Customer Payment
            </h4>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Base Fare</span>
                <span className="font-medium">{formatMinor(fareMinor, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Toll / Parking</span>
                <span className="font-medium">{formatMinor(tollParkingMinor, currency)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Total Price</span>
                <span>{formatMinor(totalPriceMinor, currency)}</span>
              </div>
            </div>
          </div>

          {/* Right — Driver Pay */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Driver Pay
            </h4>
            <div className="space-y-3">
              {/* Pay type + value */}
              <div className="flex gap-2">
                <select
                  value={payType}
                  onChange={(e) => setPayType(e.target.value as 'PERCENTAGE' | 'FIXED')}
                  className="border rounded px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="PERCENTAGE">% of Fare</option>
                  <option value="FIXED">Fixed Amount</option>
                </select>
                <input
                  type="number"
                  value={payValue}
                  min={0}
                  step={payType === 'PERCENTAGE' ? 1 : 0.01}
                  onChange={(e) => setPayValue(parseFloat(e.target.value) || 0)}
                  className="border rounded px-3 py-2 text-sm w-24 text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={payType === 'PERCENTAGE' ? '70' : '0.00'}
                />
              </div>

              {/* Editable toll */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Toll / Parking</span>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 text-xs">{currency}</span>
                  <input
                    type="number"
                    value={tollEditable}
                    min={0}
                    step={0.01}
                    onChange={(e) => setTollEditable(parseFloat(e.target.value) || 0)}
                    className="border rounded px-2 py-1 text-sm w-24 text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Driver Gets summary */}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex justify-between font-semibold text-sm">
                <span className="text-gray-700">Driver Gets</span>
                <span className="text-blue-700">{formatMinor(driverTotalMinor, currency)}</span>
              </div>

              {/* Breakdown hint */}
              <p className="text-xs text-gray-400">
                {payType === 'PERCENTAGE'
                  ? `${payValue}% of ${formatMinor(fareMinor, currency)} fare + toll passthrough`
                  : `Fixed ${formatMinor(Math.round(payValue * 100), currency)} + toll passthrough`}
              </p>
            </div>
          </div>
        </div>

        {/* Driver + Vehicle Selection */}
        <div className="px-6 pb-4 grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Driver
            </label>
            <select
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
              className="border rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select driver...</option>
              {drivers.map((d) => (
                <option key={d.driver_id ?? d.id} value={d.driver_id ?? d.id}>
                  {d.full_name}
                  {d.membership_status && d.membership_status !== 'active'
                    ? ` (${d.membership_status})`
                    : ''}
                </option>
              ))}
            </select>
            {drivers.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">No drivers found</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Vehicle
            </label>
            <select
              value={selectedVehicle}
              onChange={(e) => setSelectedVehicle(e.target.value)}
              className="border rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select vehicle...</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.make} {v.model} · {v.plate ?? v.registration_number ?? '—'}
                </option>
              ))}
            </select>
            {vehicles.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">
                {carTypeId ? 'No vehicles match this car type' : 'No vehicles available'}
              </p>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedDriver || !selectedVehicle || saving}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Assigning...' : 'Assign Driver'}
          </button>
        </div>
      </div>
    </div>
  );
}
