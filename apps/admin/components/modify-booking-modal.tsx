'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { DateTimePicker } from '@/components/ui/DateTimePicker';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { PlacesAutocomplete } from '@/components/ui/PlacesAutocomplete';

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
  const [waypointList, setWaypointList] = useState<string[]>([]);
  const [serviceTypeId, setServiceTypeId] = useState('');
  const [carTypeId, setCarTypeId] = useState('');
  const [passengerCount, setPassengerCount] = useState(1);
  const [luggageCount, setLuggageCount] = useState(0);
  const [flightNumber, setFlightNumber] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');

  const [passengerFirst, setPassengerFirst] = useState('');
  const [passengerLast, setPassengerLast] = useState('');
  const [passengerPhoneCode, setPassengerPhoneCode] = useState('+61');
  const [passengerPhone, setPassengerPhone] = useState('');
  const [pickupPlaceId, setPickupPlaceId] = useState<string>('');
  const [dropoffPlaceId, setDropoffPlaceId] = useState<string>('');

  const [newTotal, setNewTotal] = useState('');

  useEffect(() => {
    if (!booking || !isOpen) return;
    setPickupAt(booking.pickup_at_utc ?? '');
    setReturnAt(booking.return_pickup_at_utc ?? '');
    setPickupAddr(booking.pickup_address_text ?? booking.pickup_address ?? '');
    setDropoffAddr(booking.dropoff_address_text ?? booking.dropoff_address ?? '');
    setWaypointList(Array.isArray(booking.waypoints) ? booking.waypoints.map((w: any) => String(w ?? '')) : []);
    setServiceTypeId(booking.service_type_id ?? '');
    setCarTypeId(booking.service_class_id ?? '');
    setPassengerCount(Number(booking.passenger_count ?? 1));
    setLuggageCount(Number(booking.luggage_count ?? 0));
    setFlightNumber(booking.flight_number ?? '');
    setSpecialRequests(booking.special_requests ?? '');
    setPassengerFirst(booking.passenger_first_name ?? booking.customer_first_name ?? '');
    setPassengerLast(booking.passenger_last_name ?? booking.customer_last_name ?? '');
    setPassengerPhoneCode(booking.passenger_phone_country_code ?? booking.customer_phone_country_code ?? '+61');
    setPassengerPhone(booking.passenger_phone_number ?? booking.customer_phone_number ?? '');
    setPickupPlaceId('');
    setDropoffPlaceId('');
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
      if (!pickupAddr?.trim() || !dropoffAddr?.trim()) {
        setError('Pickup and drop-off addresses are required.');
        return;
      }
      if (pickupAddr.trim().toLowerCase() === dropoffAddr.trim().toLowerCase()) {
        setError('Pickup and drop-off cannot be the same.');
        return;
      }

      const payload: any = {
        pickup_address_text: pickupAddr,
        dropoff_address_text: dropoffAddr,
        pickup_at_utc: pickupAt,
        return_pickup_at_utc: returnAt || null,
        waypoints: waypointList.map((w) => w.trim()).filter(Boolean),
        service_type_id: serviceTypeId || null,
        service_class_id: carTypeId || null,
        passenger_count: passengerCount,
        luggage_count: luggageCount,
        flight_number: flightNumber || null,
        special_requests: specialRequests || null,
        passenger_first_name: passengerFirst || null,
        passenger_last_name: passengerLast || null,
        passenger_phone_country_code: passengerPhoneCode || null,
        passenger_phone_number: passengerPhone || null,
        pickup_place_id: pickupPlaceId || null,
        dropoff_place_id: dropoffPlaceId || null,
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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-5 md:p-7 shadow-[0_24px_60px_rgba(0,0,0,0.2)] max-h-[92vh] overflow-y-auto my-4">
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-white z-10 pb-2">
          <h2 className="text-lg font-semibold">Modify Booking</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {error && <ErrorAlert message={error} />}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DateTimePicker label="Pickup Date & Time" value={pickupAt} onChange={setPickupAt} />
          <DateTimePicker label="Return Date & Time (optional)" value={returnAt} onChange={setReturnAt} />

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Pickup Address</label>
            <PlacesAutocomplete
              value={pickupAddr}
              onChange={(val, placeId) => { setPickupAddr(val); setPickupPlaceId(placeId ?? ''); }}
              placeholder="Search pickup address"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Drop-off Address</label>
            <PlacesAutocomplete
              value={dropoffAddr}
              onChange={(val, placeId) => { setDropoffAddr(val); setDropoffPlaceId(placeId ?? ''); }}
              placeholder="Search drop-off address"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium text-gray-700 block mb-2">Stops</label>
            <div className="space-y-2">
              {waypointList.map((stop, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    value={stop}
                    onChange={(e) => setWaypointList((prev) => prev.map((v, i) => i === idx ? e.target.value : v))}
                    placeholder={`Stop ${idx + 1}`}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setWaypointList((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                onClick={() => setWaypointList((prev) => [...prev, ''])}
              >
                + Add Stop
              </Button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Service Type</label>
            <Select value={serviceTypeId} onChange={(e) => setServiceTypeId(e.target.value)}>
              <option value="">Select service type...</option>
              {serviceTypes.map((s: any) => <option key={s.id} value={s.id}>{s.display_name ?? s.name}</option>)}
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Car Type</label>
            <Select value={carTypeId} onChange={(e) => setCarTypeId(e.target.value)}>
              <option value="">Select car type...</option>
              {carTypes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>

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

          <div className="md:col-span-2 pt-1">
            <h3 className="text-sm font-semibold text-gray-800">Passenger Details</h3>
            <p className="text-xs text-gray-500 mt-0.5">Customer profile is not editable here. Update passenger name/phone only.</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Passenger First Name</label>
            <Input value={passengerFirst} onChange={(e) => setPassengerFirst(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Passenger Last Name</label>
            <Input value={passengerLast} onChange={(e) => setPassengerLast(e.target.value)} />
          </div>
          <div className="flex gap-2 md:col-span-2">
            <div className="w-28">
              <label className="text-sm font-medium text-gray-700 block mb-1">Country</label>
              <Input value={passengerPhoneCode} onChange={(e) => setPassengerPhoneCode(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 block mb-1">Passenger Phone</label>
              <Input value={passengerPhone} onChange={(e) => setPassengerPhone(e.target.value)} />
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

        <div className="mt-5 flex justify-end gap-2 sticky bottom-0 bg-white pt-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>{loading ? 'Saving…' : 'Save changes'}</Button>
        </div>
      </div>
    </div>
  );
}
