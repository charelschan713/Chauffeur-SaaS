'use client';
import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';

interface AssignDriverModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  leg: 'A' | 'B';
  carTypeId: string | null;
  fromAddress: string;
  toAddress: string;
  timeLabel: string;
  onAssigned: () => void;
}

interface DriverRow {
  id: string;
  full_name: string;
  status?: string;
}

interface VehicleRow {
  id: string;
  make: string;
  model: string;
  year?: string;
  registration_number?: string;
}

const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2';

export function AssignDriverModal({
  isOpen,
  onClose,
  bookingId,
  leg,
  carTypeId,
  fromAddress,
  toAddress,
  timeLabel,
  onAssigned,
}: AssignDriverModalProps) {
  const [step, setStep] = useState(1);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [payType, setPayType] = useState<'FIXED' | 'PERCENTAGE'>('PERCENTAGE');
  const [payValue, setPayValue] = useState('70');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setSelectedDriver(null);
    setSelectedVehicle(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !carTypeId) return;
    api.get(`/vehicles/assignable?car_type_id=${carTypeId}`).then((res) => {
      setVehicles(res.data ?? []);
    });
    api.get('/drivers').then((res) => {
      setDrivers(res.data ?? []);
    });
  }, [isOpen, carTypeId]);

  const title = leg === 'A' ? 'Assign Driver — Outbound' : 'Assign Driver — Return';

  const canNext = useMemo(() => {
    if (step === 1) return !!selectedVehicle;
    if (step === 2) return !!selectedDriver;
    return true;
  }, [step, selectedVehicle, selectedDriver]);

  async function handleAssign() {
    setSaving(true);
    await api.post(`/assignments/bookings/${bookingId}/assign`, {
      driver_id: selectedDriver,
      vehicle_id: selectedVehicle,
      driver_pay_type: payType,
      driver_pay_value: Number(payValue),
      leg,
    });
    setSaving(false);
    onAssigned();
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="text-sm text-gray-600">
            <div><strong>From:</strong> {fromAddress}</div>
            <div><strong>To:</strong> {toAddress}</div>
            <div><strong>Time:</strong> {timeLabel}</div>
          </div>

          {step === 1 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">Select Vehicle</div>
              <div className="space-y-2 max-h-48 overflow-auto">
                {vehicles.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVehicle(v.id)}
                    className={`w-full text-left px-3 py-2 border rounded ${FOCUS} ${
                      selectedVehicle === v.id ? 'border-blue-600 bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    {v.make} {v.model} {v.registration_number ? `(${v.registration_number})` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">Select Driver</div>
              <div className="space-y-2 max-h-48 overflow-auto">
                {drivers.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDriver(d.id)}
                    className={`w-full text-left px-3 py-2 border rounded ${FOCUS} ${
                      selectedDriver === d.id ? 'border-blue-600 bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    {d.full_name} {d.status ? `— ${d.status}` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-700">Driver Pay</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select
                  value={payType}
                  onChange={(e) => setPayType(e.target.value as 'FIXED' | 'PERCENTAGE')}
                  className={`w-full border rounded px-3 py-2 text-sm ${FOCUS}`}
                >
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="FIXED">Fixed</option>
                </select>
                <input
                  value={payValue}
                  onChange={(e) => setPayValue(e.target.value)}
                  className={`w-full border rounded px-3 py-2 text-sm ${FOCUS}`}
                  placeholder={payType === 'FIXED' ? 'Amount' : 'Percent'}
                />
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <div className="flex gap-2">
              {step > 1 && (
                <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
                  Back
                </Button>
              )}
              {step < 3 ? (
                <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
                  Next
                </Button>
              ) : (
                <Button onClick={handleAssign} disabled={saving || !selectedDriver || !selectedVehicle}>
                  {saving ? 'Assigning…' : 'Assign'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
