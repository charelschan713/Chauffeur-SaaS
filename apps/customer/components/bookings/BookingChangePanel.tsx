'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';

const DIRECT_EDIT = new Set(['PENDING','PENDING_CONFIRMATION','PENDING_ADMIN_CONFIRMATION','AWAITING_CONFIRMATION']);
const REQUEST_ONLY = new Set(['CONFIRMED','ASSIGNED']);
const LOCKED = new Set(['ON_THE_WAY','ARRIVED','POB','JOB_DONE','FULFILLED','COMPLETED']);

interface BookingChangeRequest {
  id: string;
  status: string;
  old_snapshot: Record<string, any>;
  new_snapshot: Record<string, any>;
  price_delta_minor?: number | null;
  created_at: string;
}

export function BookingChangePanel({ booking }: { booking: any }) {
  const [payload, setPayload] = useState('');
  const [requests, setRequests] = useState<BookingChangeRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const bookingId = booking?.id;
  const status = booking?.operational_status;

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
    if (!payload && defaultPayload) setPayload(defaultPayload);
  }, [defaultPayload, payload]);

  useEffect(() => {
    if (!bookingId) return;
    api.get(`/customer-portal/bookings/${bookingId}/change-requests`).then((res) => {
      setRequests(res.data ?? []);
    });
  }, [bookingId]);

  async function submitChange() {
    if (!bookingId) return;
    setLoading(true);
    setError('');
    try {
      const parsed = JSON.parse(payload || '{}');
      await api.patch(`/customer-portal/bookings/${bookingId}`, { change_payload: parsed });
      const res = await api.get(`/customer-portal/bookings/${bookingId}/change-requests`);
      setRequests(res.data ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to submit change');
    } finally {
      setLoading(false);
    }
  }

  async function approve(id: string) {
    await api.post(`/customer-portal/bookings/${bookingId}/change-requests/${id}/approve`);
    const res = await api.get(`/customer-portal/bookings/${bookingId}/change-requests`);
    setRequests(res.data ?? []);
  }

  async function reject(id: string) {
    await api.post(`/customer-portal/bookings/${bookingId}/change-requests/${id}/reject`);
    const res = await api.get(`/customer-portal/bookings/${bookingId}/change-requests`);
    setRequests(res.data ?? []);
  }

  if (LOCKED.has(status)) {
    return (
      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
        This booking is already in progress and can no longer be modified. Please contact support.
      </div>
    );
  }

  const latest = requests[0];
  const pendingCustomer = requests.find((r) => r.status === 'PENDING_CUSTOMER_APPROVAL');

  return (
    <div className="mt-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <h3 className="text-lg font-semibold">Modify Booking</h3>

      {pendingCustomer && (
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs">
          <p className="font-semibold text-blue-700">Admin proposed change</p>
          <pre className="mt-2 whitespace-pre-wrap">{JSON.stringify(pendingCustomer.new_snapshot, null, 2)}</pre>
          <div className="mt-2 text-blue-700">
            Old total: {pendingCustomer.old_snapshot?.pricing_snapshot?.final_fare_minor ?? pendingCustomer.old_snapshot?.total_price_minor ?? '—'} / New total: {pendingCustomer.new_snapshot?.pricing_snapshot?.final_fare_minor ?? pendingCustomer.new_snapshot?.total_price_minor ?? '—'} / Δ {pendingCustomer.price_delta_minor ?? '—'}
          </div>
          <div className="mt-2 flex gap-2">
            <Button onClick={() => approve(pendingCustomer.id)}>Approve</Button>
            <Button variant="outline" onClick={() => reject(pendingCustomer.id)}>Reject</Button>
          </div>
        </div>
      )}

      {DIRECT_EDIT.has(status) || REQUEST_ONLY.has(status) ? (
        <>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
            {DIRECT_EDIT.has(status)
              ? 'You can edit this booking directly before admin confirmation.'
              : 'Changes require admin review and approval.'}
          </p>
          <textarea
            className="mt-3 w-full h-36 rounded-lg border p-3 text-xs font-mono"
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
          />
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          <Button className="mt-3" onClick={submitChange} disabled={loading}>
            {loading ? 'Submitting…' : DIRECT_EDIT.has(status) ? 'Save Changes' : 'Request Change'}
          </Button>
        </>
      ) : null}

      {latest && (
        <div className="mt-4 text-xs text-[hsl(var(--muted-foreground))]">
          Latest request status: {latest.status}
        </div>
      )}
    </div>
  );
}
