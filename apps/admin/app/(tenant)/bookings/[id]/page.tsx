'use client';
import { useMemo, useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { AssignDriverModal } from '@/components/assign-driver-modal';
import { EditDriverPayModal } from '@/components/edit-driver-pay-modal';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { BookingStatusTimeline } from '@/components/admin/BookingStatusTimeline';
import Link from 'next/link';
import { getBookingStatusBadge } from '@/lib/ui/statusBadge';
import { Toast } from '@/components/ui/Toast';

const CANCELABLE_STATUSES = new Set(['DRAFT', 'PENDING', 'CONFIRMED', 'ASSIGNED']);

const PAY_BADGE: Record<string, 'neutral' | 'warning' | 'success' | 'danger'> = {
  UNPAID: 'warning',
  AUTHORIZED: 'warning',
  PAID: 'success',
  REFUNDED: 'neutral',
  PARTIALLY_REFUNDED: 'neutral',
  FAILED: 'danger',
};

function BookingDetailInner() {
  const params = useParams<{ id: string }>();
  const bookingId = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [isModalOpen, setModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignLeg, setAssignLeg] = useState<'A' | 'B'>('A');
  const [editPayOpen, setEditPayOpen] = useState(false);
  const [editPayAssignmentId, setEditPayAssignmentId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: async () => {
      const res = await api.get(`/bookings/${bookingId}`);
      return res.data;
    },
    enabled: Boolean(bookingId),
  });

  useEffect(() => {
    if (bookingId) {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
    }
  }, [bookingId, queryClient]);

  // Show "Driver assigned" toast when returning from dispatch with ?assigned=1
  useEffect(() => {
    if (searchParams?.get('assigned') === '1') {
      setToast({ message: 'Driver assigned', tone: 'success' });
    }
  }, [searchParams]);

  const booking = data?.booking;
  const assignments = data?.assignments ?? [];
  const latestAssignment = useMemo(() => assignments.at(0), [assignments]);
  const legAAssignment = assignments.find((a: any) => a.leg === 'A') ?? latestAssignment;
  const legBAssignment = assignments.find((a: any) => a.leg === 'B') ?? null;
  const canCancel = booking && CANCELABLE_STATUSES.has(booking.operational_status);

  const cancelMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/bookings/${bookingId}/cancel`, { reason: cancelReason || undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      setModalOpen(false);
      setCancelReason('');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !booking) {
    return <ErrorAlert message="Unable to load booking." onRetry={refetch} />;
  }

  const customerName = `${booking.customer_first_name ?? ''} ${booking.customer_last_name ?? ''}`.trim();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Booking ${booking.booking_reference}`}
        description={`Created ${new Date(booking.created_at).toLocaleString()}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={getBookingStatusBadge(booking.operational_status)}>
              {booking.operational_status}
            </Badge>
            <Badge variant={PAY_BADGE[booking.payment_status] ?? 'neutral'}>
              {booking.payment_status ?? '—'}
            </Badge>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Booking Info">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
              <InfoRow label="Reference" value={booking.booking_reference} />
              <InfoRow label="Service Type" value={booking.service_type_name ?? '—'} />
              <InfoRow label="Car Type" value={booking.service_class_name ?? '—'} />
              <InfoRow label="Pickup Time" value={formatPickupTime(booking.pickup_at_utc, booking.timezone)} />
              {booking.return_pickup_at_utc && (
                <InfoRow label="Return Time" value={formatPickupTime(booking.return_pickup_at_utc, booking.timezone)} />
              )}
            </div>
          </Card>

          <Card title="Route">
            <div className="space-y-2 text-sm text-gray-700">
              <div><span className="text-gray-500">Pickup:</span> {booking.pickup_address_text}</div>
              <div><span className="text-gray-500">Dropoff:</span> {booking.dropoff_address_text}</div>
              {booking.waypoints && booking.waypoints.length > 0 && (
                <div>
                  <div className="text-gray-500">Waypoints:</div>
                  <ul className="list-disc pl-5 space-y-1">
                    {booking.waypoints.map((wp: any, idx: number) => (
                      <li key={idx}>{wp?.address ?? wp?.address_text ?? wp}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>

          <Card title="Customer">
            <div className="space-y-2 text-sm text-gray-700">
              <div>{customerName || '—'}</div>
              <div>{booking.customer_phone ?? '—'}</div>
              <div>{booking.customer_email ?? '—'}</div>
              {booking.customer_tier && (
                <Badge variant="info">{booking.customer_tier}</Badge>
              )}
            </div>
          </Card>

          <Card title="Passenger">
            <div className="space-y-2 text-sm text-gray-700">
              <div>{booking.passenger_name ?? '—'}</div>
              <div>{booking.passenger_phone ?? '—'}</div>
              {booking.passenger_preferences && (
                <div className="text-gray-500">{booking.passenger_preferences}</div>
              )}
            </div>
          </Card>

          <Card title="Notes">
            <div className="text-sm text-gray-700">{booking.special_requests || 'No notes'}</div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Assignment">
            {latestAssignment ? (
              <div className="space-y-2 text-sm text-gray-700">
                <div><span className="text-gray-500">Driver:</span> {latestAssignment.driver_name ?? '—'}</div>
                <div><span className="text-gray-500">Vehicle:</span> {latestAssignment.vehicle_make ?? ''} {latestAssignment.vehicle_model ?? ''} {latestAssignment.vehicle_plate ?? ''}</div>
                <div><span className="text-gray-500">Driver Phone:</span> {latestAssignment.driver_phone ?? '—'}</div>
                <div><span className="text-gray-500">Status:</span> {latestAssignment.status ?? '—'}</div>
                <div className="mt-3">
                  <Link href={`/dispatch?booking_id=${booking.id}&return=/bookings/${booking.id}`}>
                    <Button variant="secondary">Reassign</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm text-gray-500">No driver assigned</div>
                <Link href={`/dispatch?booking_id=${booking.id}&return=/bookings/${booking.id}`}>
                  <Button>Assign Driver</Button>
                </Link>
              </div>
            )}
          </Card>

          <Card title="Status Timeline">
            <BookingStatusTimeline status={booking.operational_status} />
          </Card>

          <Card title="Actions">
            <div className="flex flex-col gap-2">
              {['DRAFT', 'PENDING'].includes(booking.operational_status) && (
                <>
                  <Button variant="secondary" onClick={() => router.push(`/bookings/${booking.id}/edit`)}>
                    Edit
                  </Button>
                  <Button variant="danger" onClick={() => setModalOpen(true)}>
                    Cancel
                  </Button>
                </>
              )}
              {booking.operational_status === 'CONFIRMED' && (
                <Link href={`/dispatch?booking_id=${booking.id}&return=/bookings/${booking.id}`}>
                  <Button>Assign Driver</Button>
                </Link>
              )}
              {booking.operational_status === 'ASSIGNED' && (
                <>
                  <Link href={`/dispatch?booking_id=${booking.id}&return=/bookings/${booking.id}`}>
                    <Button>Reassign</Button>
                  </Link>
                  <Button variant="danger" onClick={() => setModalOpen(true)}>Cancel</Button>
                </>
              )}
              {['IN_PROGRESS', 'JOB_STARTED'].includes(booking.operational_status) && (
                <Button>Mark Completed</Button>
              )}
              {['COMPLETED', 'JOB_COMPLETED'].includes(booking.operational_status) && (
                <Button variant="secondary">View Invoice</Button>
              )}
              {booking.operational_status === 'CANCELLED' && (
                <div className="text-sm text-gray-500">No actions available</div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <ConfirmModal
        title="Cancel booking"
        description="Provide a reason (optional)"
        isOpen={isModalOpen}
        onClose={() => {
          setModalOpen(false);
          setCancelReason('');
        }}
        onConfirm={() => cancelMutation.mutate()}
        confirmText={cancelMutation.isPending ? 'Cancelling...' : 'Confirm cancel'}
        loading={cancelMutation.isPending}
        confirmTone="danger"
      >
        <label className="text-sm font-medium text-gray-700">Reason</label>
        <div className="border rounded px-3 py-2">
          <input
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Optional"
            className="w-full outline-none text-sm"
          />
        </div>
      </ConfirmModal>

      <AssignDriverModal
        isOpen={assignOpen}
        onClose={() => setAssignOpen(false)}
        bookingId={booking?.id ?? ''}
        leg={assignLeg}
        carTypeId={booking?.service_class_id ?? null}
        fromAddress={
          assignLeg === 'B'
            ? (booking?.dropoff_address_text ?? '')
            : (booking?.pickup_address_text ?? '')
        }
        toAddress={
          assignLeg === 'B'
            ? (booking?.return_pickup_address_text ?? booking?.pickup_address_text ?? '')
            : (booking?.dropoff_address_text ?? '')
        }
        timeLabel={
          assignLeg === 'B'
            ? (booking?.return_pickup_at_utc
                ? formatPickupTime(booking.return_pickup_at_utc, booking.timezone)
                : 'Return time not set')
            : formatPickupTime(booking?.pickup_at_utc, booking?.timezone)
        }
        onAssigned={() => {
          setAssignOpen(false);
          refetch();
        }}
      />

      <EditDriverPayModal
        isOpen={editPayOpen}
        onClose={() => {
          setEditPayOpen(false);
          setEditPayAssignmentId(null);
        }}
        assignmentId={editPayAssignmentId}
        onUpdated={() => {
          setEditPayOpen(false);
          setEditPayAssignmentId(null);
          refetch();
        }}
      />

      {toast && (
        <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

export default function BookingDetailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><LoadingSpinner /></div>}>
      <BookingDetailInner />
    </Suspense>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-gray-500">{label}</div>
      <div className="text-sm text-gray-900">{value}</div>
    </div>
  );
}

function formatPickupTime(isoUtc: string, tz: string) {
  if (!isoUtc) return '—';
  const location = tz?.includes('/') ? tz.split('/')[1] : tz;
  const formatted = new Date(isoUtc).toLocaleString('en-AU', {
    timeZone: tz,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${formatted} (${location})`;
}
