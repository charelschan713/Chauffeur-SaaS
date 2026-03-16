'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';

interface BookingChangeRequest {
  id: string;
  status: string;
  old_snapshot: Record<string, any>;
  new_snapshot: Record<string, any>;
  price_delta_minor?: number | null;
  created_at: string;
}

export function BookingChangePanel({ booking }: { booking: any }) {
  const [changePayload, setChangePayload] = useState('');
  const [requests, setRequests] = useState<BookingChangeRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const bookingId = booking?.id;

  const defaultPayload = useMemo(() => {
    if (!booking) return '';
    const snapshot = {
      pickup_address: booking.pickup_address,
      dropoff_address: booking.dropoff_address,
      pickup_at: booking.pickup_at,
      passenger_count: booking.passenger_count,
      luggage_count: booking.luggage_count,
      notes: booking.notes,
    };
    return JSON.stringify(snapshot, null, 2);
  }, [booking]);

  useEffect(() => {
    if (!changePayload && defaultPayload) {
      setChangePayload(defaultPayload);
    }
  }, [defaultPayload, changePayload]);

  useEffect(() => {
    if (!bookingId) return;
    api.get(`/bookings/${bookingId}/change-requests`).then((res) => {
      setRequests(res.data ?? []);
    });
  }, [bookingId]);

  async function submitProposal() {
    if (!bookingId) return;
    setLoading(true);
    setError('');
    try {
      const parsed = JSON.parse(changePayload || '{}');
      await api.post(`/bookings/${bookingId}/change-requests`, { change_payload: parsed });
      const res = await api.get(`/bookings/${bookingId}/change-requests`);
      setRequests(res.data ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to submit proposal');
    } finally {
      setLoading(false);
    }
  }

  const latest = requests[0];

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Booking Change Proposal</h3>
        {latest?.status && (
          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
            {latest.status}
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-gray-50 p-3 text-xs">
          <p className="text-gray-500 mb-2">Current booking</p>
          <pre className="whitespace-pre-wrap">{JSON.stringify({
            pickup_address: booking?.pickup_address,
            dropoff_address: booking?.dropoff_address,
            pickup_at: booking?.pickup_at,
            passenger_count: booking?.passenger_count,
            luggage_count: booking?.luggage_count,
          }, null, 2)}</pre>
        </div>
        <div className="rounded-lg border bg-gray-50 p-3 text-xs">
          <p className="text-gray-500 mb-2">Latest proposed change</p>
          <pre className="whitespace-pre-wrap">{latest ? JSON.stringify(latest.new_snapshot, null, 2) : 'No proposals'}</pre>
        </div>
      </div>

      {latest && (
        <div className="mt-3 text-sm text-gray-700">
          Old total: {latest.old_snapshot?.pricing_snapshot?.final_fare_minor ?? latest.old_snapshot?.total_price_minor ?? '—'} / New total: {latest.new_snapshot?.pricing_snapshot?.final_fare_minor ?? latest.new_snapshot?.total_price_minor ?? '—'} / Δ {latest.price_delta_minor ?? '—'}
        </div>
      )}

      <div className="mt-4">
        <label className="text-xs text-gray-500">Proposed change payload (JSON)</label>
        <textarea
          className="mt-2 w-full h-36 rounded-lg border p-3 text-xs font-mono"
          value={changePayload}
          onChange={(e) => setChangePayload(e.target.value)}
        />
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        <Button className="mt-3" onClick={submitProposal} disabled={loading}>
          {loading ? 'Submitting…' : 'Submit Proposal'}
        </Button>
      </div>
    </div>
  );
}
