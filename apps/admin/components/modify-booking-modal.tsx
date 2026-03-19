'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { DateTimePicker } from '@/components/ui/DateTimePicker';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { ErrorAlert } from '@/components/ui/ErrorAlert';

interface ModifyBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: any;
  serviceTypes: any[];
  carTypes: any[];
  onModified: (result: { assignmentId?: string | null }) => void;
}

function toMoney(minor: number, currency = 'AUD') {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format((minor ?? 0) / 100);
}

export function ModifyBookingModal({ isOpen, onClose, booking, serviceTypes, carTypes, onModified }: ModifyBookingModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pickupAt, setPickupAt] = useState('');
  const [returnAt, setReturnAt] = useState('');
  const [pickupAddr, setPickupAddr] = useState('');
  const [dropoffAddr, setDropoffAddr] = useState('');
  const [waypoints, setWaypoints] = useState('');
  const [serviceTypeId, setServiceTypeId] = useState('');
  const [carTypeId, setCarTypeId] = useState('');
  const [passengerCount, setPassengerCount] = useState(1);
  const [luggageCount, setLuggageCount] = useState(0);
  const [flightNumber, setFlightNumber] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');

  const [customerFirst, setCustomerFirst] = useState('');
  const [customerLast, setCustomerLast] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhoneCode, setCustomerPhoneCode] = useState('+61');
  const [customerPhone, setCustomerPhone] = useState('');

  const [newTotal, setNewTotal] = useState('');

  useEffect(() => {
    if (!booking || !isOpen) return;
    setPickupAt(booking.pickup_at_utc ?? '');
    setReturnAt(booking.return_pickup_at_utc ?? '');
    setPickupAddr(booking.pickup_address_text ?? booking.pickup_address ?? '');
    setDropoffAddr(booking.dropoff_address_text ?? booking.dropoff_address ?? '');
    setWaypoints(Array.isArray(booking.waypoints) ? booking.waypoints.join('\n') : '');
    setServiceTypeId(booking.service_type_id ?? '');
    setCarTypeId(booking.service_class_id ?? '');
    setPassengerCount(Number(booking.passenger_count ?? 1));
    setLuggageCount(Number(booking.luggage_count ?? 0));
    setFlightNumber(booking.flight_number ?? '');
    setSpecialRequests(booking.special_requests ?? '');
    setCustomerFirst(booking.customer_first_name ?? '');
    setCustomerLast(booking.customer_last_name ?? '');
    setCustomerEmail(booking.customer_email ?? '');
    setCustomerPhoneCode(booking.customer_phone_country_code ?? '+61');
    setCustomerPhone(booking.customer_phone_number ?? '');
    setNewTotal(booking.total_price_minor ? (booking.total_price_minor / 100).toFixed(2) : '');
    setError(null);
  }, [booking, isOpen]);

  const currentTotal = booking?.total_price_minor ?? 0;
  const currency = booking?.currency ?? 'AUD';

  if (!isOpen) return null;

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const payload: any = {
        pickup_address_text: pickupAddr,
        dropoff_address_text: dropoffAddr,
        pickup_at_utc: pickupAt,
        return_pickup_at_utc: returnAt || null,
        waypoints: waypoints.split(/\n|\r/).map((w) => w.trim()).filter(Boolean),
        service_type_id: serviceTypeId || null,
        service_class_id: carTypeId || null,
        passenger_count: passengerCount,
        luggage_count: luggageCount,
        flight_number: flightNumber || null,
        special_requests: specialRequests || null,
        customer_first_name: customerFirst || null,
        customer_last_name: customerLast || null,
        customer_email: customerEmail || null,
        customer_phone_country_code: customerPhoneCode || null,
        customer_phone_number: customerPhone || null,
      };

      const totalMinor = Math.round(Number(newTotal || 0) * 100);
      payload.total_price_minor = Number.isFinite(totalMinor) ? totalMinor : null;

      const res = await api.post(`/bookings/${booking.id}/modify-admin`, payload);
      onModified({ assignmentId: res.data?.assignment_id ?? null });
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Modify failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Modify Booking</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {error && <ErrorAlert message={error} />}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DateTimePicker label="Pickup Date & Time" value={pickupAt} onChange={setPickupAt} />
          <DateTimePicker label="Return Date & Time (optional)" value={returnAt} onChange={setReturnAt} />

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Pickup Address</label>
            <Input value={pickupAddr} onChange={(e) => setPickupAddr(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Drop-off Address</label>
            <Input value={dropoffAddr} onChange={(e) => setDropoffAddr(e.target.value)} />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Waypoints (one per line)</label>
            <Input value={waypoints} onChange={(e) => setWaypoints(e.target.value)} />
          </div>

          <Select label="Service Type" value={serviceTypeId} onChange={(e) => setServiceTypeId(e.target.value)}>
            <option value="">Select service type...</option>
            {serviceTypes.map((s: any) => <option key={s.id} value={s.id}>{s.display_name ?? s.name}</option>)}
          </Select>

          <Select label="Car Type" value={carTypeId} onChange={(e) => setCarTypeId(e.target.value)}>
            <option value="">Select car type...</option>
            {carTypes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Passenger Count</label>
            <Input type="number" value={passengerCount} onChange={(e) => setPassengerCount(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Luggage Count</label>
            <Input type="number" value={luggageCount} onChange={(e) => setLuggageCount(Number(e.target.value))} />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Flight Number (optional)</label>
            <Input value={flightNumber} onChange={(e) => setFlightNumber(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Special Requests</label>
            <Input value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Customer First Name</label>
            <Input value={customerFirst} onChange={(e) => setCustomerFirst(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Customer Last Name</label>
            <Input value={customerLast} onChange={(e) => setCustomerLast(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Customer Email</label>
            <Input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 block mb-1">Country</label>
              <Input value={customerPhoneCode} onChange={(e) => setCustomerPhoneCode(e.target.value)} />
            </div>
            <div className="flex-[2]">
              <label className="text-sm font-medium text-gray-700 block mb-1">Phone</label>
              <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="mt-5 p-4 rounded-xl bg-gray-50 border border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Current total</span>
            <span className="font-semibold">{toMoney(currentTotal, currency)}</span>
          </div>
          <div className="mt-3">
            <label className="text-sm font-medium text-gray-700 block mb-1">New Total (manual)</label>
            <Input value={newTotal} onChange={(e) => setNewTotal(e.target.value)} placeholder="e.g. 420.00" />
            <p className="text-xs text-gray-400 mt-1">Price changes are manual — no automatic charge/refund.</p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>{loading ? 'Saving…' : 'Save changes'}</Button>
        </div>
      </div>
    </div>
  );
}
