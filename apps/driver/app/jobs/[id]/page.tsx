'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import api from '@/lib/api';

const GOLD = '#C8A870', CARD = '#222236', MUTED = '#9CA3AF', BG = '#1A1A2E';

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

  if (loading) return <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', color: GOLD }}>Loading...</div>;
  if (!assignment) return <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444' }}>Job not found</div>;

  const b = assignment.booking ?? {};
  const status = assignment.driver_execution_status ?? 'assigned';
  const flow = STATUS_FLOW[status];
  const waypoints: string[] = b.waypoint_addresses ?? [];

  return (
    <div style={{ minHeight: '100vh', background: BG, paddingBottom: 120 }}>
      {/* Header */}
      <div style={{ padding: '48px 16px 16px', background: '#16162A', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: '#333355', border: 'none', borderRadius: 999, width: 36, height: 36, color: '#fff', cursor: 'pointer', fontSize: 18 }}>←</button>
        <div>
          <p style={{ color: MUTED, fontSize: 11, fontFamily: 'monospace', margin: 0 }}>{b.booking_number}</p>
          <h1 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>Job Detail</h1>
        </div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>

        {/* Status */}
        <div style={{ background: CARD, borderRadius: 12, padding: 16, marginBottom: 12, border: '0.5px solid #333355' }}>
          <p style={{ color: MUTED, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 6px' }}>Status</p>
          <span style={{ background: GOLD + '22', color: GOLD, fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 999 }}>
            {status.replace(/_/g, ' ').toUpperCase()}
          </span>
        </div>

        {/* Trip details */}
        <div style={{ background: CARD, borderRadius: 12, padding: 16, marginBottom: 12, border: '0.5px solid #333355' }}>
          <Row label="Date" value={fmtDate(b.pickup_at)} />
          <Row label="Service" value={b.service_type ?? '—'} />
          {b.vehicle_name && <Row label="Vehicle" value={`${b.vehicle_name}${b.vehicle_plate ? ` · ${b.vehicle_plate}` : ''}`} />}
          <Row label="Passengers" value={b.passengers ?? '—'} />
          {b.luggage && <Row label="Luggage" value={b.luggage} />}
        </div>

        {/* Route */}
        <div style={{ background: CARD, borderRadius: 12, padding: 16, marginBottom: 12, border: '0.5px solid #333355' }}>
          <p style={{ color: MUTED, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px' }}>Route</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 3 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: GOLD }} />
              <div style={{ flex: 1, width: 1, background: '#333355', margin: '4px 0' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22C55E' }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ color: '#fff', fontSize: 13, margin: '0 0 8px' }}>{b.pickup_location ?? '—'}</p>
              {waypoints.map((w: string, i: number) => (
                <p key={i} style={{ color: MUTED, fontSize: 13, margin: '0 0 8px' }}>via {w}</p>
              ))}
              <p style={{ color: '#fff', fontSize: 13, margin: 0 }}>{b.dropoff_location ?? '—'}</p>
            </div>
          </div>
        </div>

        {/* Passenger */}
        {b.passenger_name && (
          <div style={{ background: CARD, borderRadius: 12, padding: 16, marginBottom: 12, border: '0.5px solid #333355' }}>
            <p style={{ color: MUTED, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 10px' }}>Passenger</p>
            <Row label="Name" value={b.passenger_name} />
            {b.passenger_phone && <Row label="Phone" value={<a href={`tel:${b.passenger_phone}`} style={{ color: GOLD }}>{b.passenger_phone}</a>} />}
          </div>
        )}

        {/* Notes */}
        {(b.notes || assignment.dispatch_notes) && (
          <div style={{ background: CARD, borderRadius: 12, padding: 16, marginBottom: 12, border: '0.5px solid #333355' }}>
            {assignment.dispatch_notes && <Row label="Dispatch Note" value={assignment.dispatch_notes} />}
            {b.notes && <Row label="Special Requests" value={b.notes} />}
          </div>
        )}

        {/* Driver pay */}
        {assignment.driver_pay_amount && (
          <div style={{ background: CARD, borderRadius: 12, padding: 16, marginBottom: 12, border: '0.5px solid #333355' }}>
            <Row label="Your Pay" value={<span style={{ color: GOLD, fontWeight: 700 }}>${assignment.driver_pay_amount.toFixed(2)}</span>} />
          </div>
        )}

        {error && <p style={{ color: '#EF4444', fontSize: 13, margin: '0 0 12px' }}>{error}</p>}
      </div>

      {/* Sticky CTA */}
      {flow && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px 28px', background: BG, borderTop: '1px solid #333355' }}>
          <button onClick={() => updateStatus(flow.next)} disabled={updating}
            style={{ width: '100%', padding: '16px 0', background: updating ? GOLD + '80' : GOLD,
              color: '#000', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 15, cursor: updating ? 'not-allowed' : 'pointer' }}>
            {updating ? 'Updating...' : flow.nextLabel}
          </button>
        </div>
      )}
      {!flow && status === 'job_done' && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px 28px', background: BG, borderTop: '1px solid #333355' }}>
          <div style={{ textAlign: 'center', color: '#22C55E', fontWeight: 600, fontSize: 15 }}>✓ Job Completed</div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 16 }}>
      <span style={{ color: MUTED, fontSize: 12, flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#fff', fontSize: 13, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
