'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import api from '@/lib/api';
import StatusTimeline from '@/components/StatusTimeline';
import MessagePanel from '@/components/MessagePanel';

const STATUS_FLOW: Record<string, { label: string; next: string; nextLabel: string } | null> = {
  assigned:             { label: 'Assigned',            next: 'accepted',            nextLabel: 'Accept Job' },
  accepted:             { label: 'Accepted',            next: 'on_the_way',          nextLabel: 'On My Way' },
  on_the_way:           { label: 'On The Way',          next: 'arrived',             nextLabel: 'Arrived at Pickup' },
  arrived:              { label: 'Arrived',             next: 'passenger_on_board',  nextLabel: 'Passenger On Board' },
  passenger_on_board:   { label: 'Passenger On Board',  next: 'job_done',            nextLabel: 'Complete Job' },
  job_done:             null,
};

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Australia/Sydney' });
}

export default function JobDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { token } = useAuthStore();
  const [assignment, setAssignment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { router.replace('/login'); return; }
    api.get(`/driver-app/assignments/${id}`)
      .then(r => { setAssignment(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token, id]);

  const updateStatus = async (newStatus: string) => {
    setUpdating(true); setError('');
    try {
      await api.patch(`/driver-app/assignments/${id}/status`, { new_status: newStatus });
      setAssignment((prev: any) => ({ ...prev, driver_execution_status: newStatus }));
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Failed to update status');
    } finally { setUpdating(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center text-[hsl(var(--primary))]">
      Loading...
    </div>
  );
  if (!assignment) return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center text-red-500">
      Job not found
    </div>
  );

  const b = assignment.booking ?? {};
  const status = assignment.driver_execution_status ?? 'assigned';
  const flow = STATUS_FLOW[status];
  const waypoints: string[] = b.waypoint_addresses ?? [];

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] pb-[120px]">
      {/* Header */}
      <div className="bg-[hsl(var(--popover))] px-4 pt-12 pb-4 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="h-9 w-9 rounded-full bg-[hsl(var(--secondary))] text-white text-lg"
        >
          ←
        </button>
        <div>
          <p className="m-0 font-mono text-[11px] text-white/50">{b.booking_number}</p>
          <h1 className="m-0 text-[18px] font-bold text-white">Job Detail</h1>
        </div>
      </div>

      <div className="px-4 pt-4">
        {/* Status */}
        <div className="mb-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Status</p>
          <span className="inline-flex rounded-full bg-[hsl(var(--primary))]/15 px-3 py-1 text-[12px] font-semibold text-[hsl(var(--primary))]">
            {status.replace(/_/g, ' ').toUpperCase()}
          </span>
        </div>

        <div className="mb-3">
          <StatusTimeline status={status as any} />
        </div>

        {/* Trip details */}
        <div className="mb-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <Row label="Date" value={fmtDate(b.pickup_at)} />
          <Row label="Service" value={b.service_type ?? '—'} />
          {b.vehicle_name && <Row label="Vehicle" value={`${b.vehicle_name}${b.vehicle_plate ? ` · ${b.vehicle_plate}` : ''}`} />}
          <Row label="Passengers" value={b.passengers ?? '—'} />
          {b.luggage && <Row label="Luggage" value={b.luggage} />}
        </div>

        {/* Route */}
        <div className="mb-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Route</p>
          <div className="flex gap-3">
            <div className="flex flex-col items-center pt-1">
              <div className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--primary))]" />
              <div className="my-1 h-full w-px bg-[hsl(var(--border))]" />
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="mb-2 text-[13px] text-white">{b.pickup_location ?? '—'}</p>
              {waypoints.map((w: string, i: number) => (
                <p key={i} className="mb-2 text-[13px] text-[hsl(var(--muted-foreground))]">via {w}</p>
              ))}
              <p className="text-[13px] text-white">{b.dropoff_location ?? '—'}</p>
            </div>
          </div>
        </div>

        {/* Passenger */}
        {b.passenger_name && (
          <div className="mb-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Passenger</p>
            <Row label="Name" value={b.passenger_name} />
            {b.passenger_phone && (
              <Row label="Phone" value={<a href={`tel:${b.passenger_phone}`} className="text-[hsl(var(--primary))]">{b.passenger_phone}</a>} />
            )}
          </div>
        )}

        {/* Notes */}
        {(b.notes || assignment.dispatch_notes) && (
          <div className="mb-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            {assignment.dispatch_notes && <Row label="Dispatch Note" value={assignment.dispatch_notes} />}
            {b.notes && <Row label="Special Requests" value={b.notes} />}
          </div>
        )}

        {/* Driver pay */}
        {assignment.driver_pay_amount && (
          <div className="mb-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
            <Row label="Your Pay" value={<span className="font-bold text-[hsl(var(--primary))]">${assignment.driver_pay_amount.toFixed(2)}</span>} />
          </div>
        )}

        <div className="mb-3">
          <MessagePanel assignmentId={id} />
        </div>

        {error && <p className="mb-3 text-[13px] text-red-500">{error}</p>}
      </div>

      {/* Sticky CTA */}
      {flow && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 pt-3 pb-7">
          <button
            onClick={() => updateStatus(flow.next)}
            disabled={updating}
            className="w-full rounded-xl bg-[hsl(var(--primary))] py-4 text-[15px] font-bold text-black disabled:opacity-60"
          >
            {updating ? 'Updating...' : flow.nextLabel}
          </button>
        </div>
      )}
      {!flow && status === 'job_done' && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 pt-3 pb-7">
          <div className="text-center text-[15px] font-semibold text-emerald-400">✓ Job Completed</div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="mb-2.5 flex items-start justify-between gap-4">
      <span className="text-[12px] text-[hsl(var(--muted-foreground))]">{label}</span>
      <span className="text-right text-[13px] text-white">{value}</span>
    </div>
  );
}
