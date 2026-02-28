'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface Booking {
  id: string;
  booking_reference: string;
  customer_first_name: string;
  customer_last_name: string;
  pickup_address_text: string;
  pickup_at_utc: string;
}

interface Driver {
  id: string;
  full_name: string;
  status: string;
}

export default function DispatchPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selected, setSelected] = useState({
    bookingId: '',
    driverId: '',
    vehicleId: '',
  });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/bookings?status=CONFIRMED').then((r) => setBookings(r.data));
    api.get('/drivers/available').then((r) => setDrivers(r.data));
  }, []);

  async function handleOffer() {
    try {
      await api.post('/dispatch/offer', selected);
      setMsg('Driver offered successfully');
    } catch {
      setMsg('Failed to offer driver');
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dispatch Console</h2>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Booking</label>
            <select
              className="w-full border rounded px-3 py-2"
              onChange={(e) => setSelected((s) => ({ ...s, bookingId: e.target.value }))}
            >
              <option value="">Select booking...</option>
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.booking_reference} - {b.customer_first_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Driver</label>
            <select
              className="w-full border rounded px-3 py-2"
              onChange={(e) => setSelected((s) => ({ ...s, driverId: e.target.value }))}
            >
              <option value="">Select driver...</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name} ({d.status})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Vehicle ID</label>
            <input
              className="w-full border rounded px-3 py-2"
              placeholder="Vehicle UUID"
              onChange={(e) => setSelected((s) => ({ ...s, vehicleId: e.target.value }))}
            />
          </div>
        </div>

        <button
          onClick={handleOffer}
          disabled={!selected.bookingId || !selected.driverId}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Offer to Driver
        </button>

        {msg && <p className="mt-3 text-sm text-green-600">{msg}</p>}
      </div>
    </div>
  );
}
