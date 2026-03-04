'use client';
import { useMemo, useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
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
import {LoadingSpinner, PageLoader, InlineSpinner} from '@/components/ui/LoadingSpinner';
import { BookingStatusTimeline } from '@/components/admin/BookingStatusTimeline';
import { Toast } from '@/components/ui/Toast';
import Link from 'next/link';
import { getBookingStatusBadge } from '@/lib/ui/statusBadge';
import { formatPhone } from '@/components/ui/PhoneSplitField';

// Statuses that allow cancellation
const CANCELABLE_STATUSES = new Set(['DRAFT', 'PENDING', 'CONFIRMED', 'ASSIGNED']);

// Statuses where assignment actions make no sense
const NO_ASSIGN_STATUSES = new Set(['CANCELLED', 'COMPLETED', 'JOB_COMPLETED', 'NO_SHOW']);

const PAY_BADGE: Record<string, 'neutral' | 'warning' | 'success' | 'danger'> = {
  UNPAID: 'warning',
  AUTHORIZED: 'warning',
  PAID: 'success',
  REFUNDED: 'neutral',
  PARTIALLY_REFUNDED: 'neutral',
  FAILED: 'danger',
};

// ─── Tooltip wrapper for disabled/coming-soon actions ────────────────────────
function ComingSoon({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative group w-full">
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex items-center whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white shadow-lg">
        Coming soon
      </div>
    </div>
  );
}

function BookingDetailInner() {
  const params = useParams<{ id: string }>();
  const bookingId = params.id;
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  const [isModalOpen, setModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);
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

  // Always refetch fresh data on mount
  useEffect(() => {
    if (bookingId) {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
    }
  }, [bookingId, queryClient]);

  // "Driver assigned" toast when returning from dispatch
  useEffect(() => {
    if (searchParams?.get('assigned') === '1') {
      setToast({ message: 'Driver assigned', tone: 'success' });
    }
  }, [searchParams]);

  const booking = data?.booking;
  const assignments = data?.assignments ?? [];
  const latestAssignment = useMemo(() => assignments.at(0), [assignments]);
  const canCancel = booking && CANCELABLE_STATUSES.has(booking.operational_status);
  const canAssign = booking && !NO_ASSIGN_STATUSES.has(booking.operational_status);

  const cancelMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/bookings/${bookingId}/cancel`, { reason: cancelReason || undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      setModalOpen(false);
      setCancelReason('');
      setCancelError(null);
      setToast({ message: 'Booking cancelled', tone: 'success' });
    },
    onError: () => {
      setCancelError('Failed to cancel booking. Please try again.');
    },
  });

  if (isLoading) {
  if (isError) return <ErrorAlert message="Failed to load data." onRetry={() => refetch()} />;
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
  const dispatchHref = `/dispatch?booking_id=${booking.id}&return=/bookings/${booking.id}`;

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

        {/* ── Left column ── */}
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
                  <div className="text-gray-500 mb-1">Waypoints:</div>
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
              <div>{formatPhone(booking.customer_phone_country_code, booking.customer_phone_number)}</div>
              <div>{booking.customer_email ?? '—'}</div>
              {booking.customer_tier && <Badge variant="info">{booking.customer_tier}</Badge>}
            </div>
          </Card>

          <Card title="Passenger">
            <div className="space-y-2 text-sm text-gray-700">
              <div>{booking.passenger_name ?? '—'}</div>
              <div>{formatPhone(booking.passenger_phone_country_code, booking.passenger_phone_number)}</div>
              {booking.passenger_preferences && (
                <div className="text-gray-500">{booking.passenger_preferences}</div>
              )}
            </div>
          </Card>

          <Card title="Notes">
            <div className="text-sm text-gray-700">{booking.special_requests || 'No notes'}</div>
          </Card>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-6">

          {/* Assignment */}
          <Card title="Assignment">
            {latestAssignment ? (
              <div className="space-y-2 text-sm text-gray-700">
                <div><span className="text-gray-500">Driver:</span> {latestAssignment.driver_name ?? '—'}</div>
                <div>
                  <span className="text-gray-500">Vehicle:</span>{' '}
                  {[latestAssignment.vehicle_make, latestAssignment.vehicle_model, latestAssignment.vehicle_plate]
                    .filter(Boolean).join(' ') || '—'}
                </div>
                <div><span className="text-gray-500">Phone:</span> {latestAssignment.driver_phone ?? '—'}</div>
                <div>
                  <span className="text-gray-500">Status:</span>{' '}
                  <Badge variant={getBookingStatusBadge(latestAssignment.status ?? '')}>
                    {latestAssignment.status ?? '—'}
                  </Badge>
                </div>
                {canAssign && (
                  <div className="mt-3">
                    <Link href={dispatchHref}>
                      <Button variant="secondary" className="w-full">Reassign</Button>
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm text-gray-500">No driver assigned</div>
                {canAssign && (
                  <Link href={dispatchHref}>
                    <Button className="w-full">Assign Driver</Button>
                  </Link>
                )}
              </div>
            )}
          </Card>

          {/* Status Timeline */}
          <Card title="Status Timeline">
            <BookingStatusTimeline status={booking.operational_status} />
          </Card>

          {/* Actions */}
          <Card title="Actions">
            <div className="flex flex-col gap-2">

              {/* Cancel — gate by CANCELABLE_STATUSES */}
              {canCancel ? (
                <Button variant="danger" onClick={() => { setCancelError(null); setModalOpen(true); }}>
                  Cancel Booking
                </Button>
              ) : (
                !['CANCELLED', 'COMPLETED', 'JOB_COMPLETED'].includes(booking.operational_status) && (
                  <Button variant="ghost" disabled className="cursor-not-allowed opacity-50">
                    Cancel Booking
                  </Button>
                )
              )}

              {/* Mark Completed — no endpoint yet */}
              {['IN_PROGRESS', 'JOB_STARTED'].includes(booking.operational_status) && (
                <ComingSoon>
                  <Button variant="secondary" disabled className="w-full cursor-not-allowed opacity-60">
                    Mark Completed
                  </Button>
                </ComingSoon>
              )}

              {/* View Invoice — no endpoint yet */}
              {['COMPLETED', 'JOB_COMPLETED'].includes(booking.operational_status) && (
                <ComingSoon>
                  <Button variant="ghost" disabled className="w-full cursor-not-allowed opacity-60">
                    View Invoice
                  </Button>
                </ComingSoon>
              )}

              {/* Terminal — no actions */}
              {booking.operational_status === 'CANCELLED' && (
                <p className="text-xs text-gray-400 text-center py-1">No actions available</p>
              )}

              {/* Inline cancel error */}
              {cancelError && (
                <ErrorAlert message={cancelError} />
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Cancel modal */}
      <ConfirmModal
        title="Cancel booking"
        description="Provide a reason (optional)"
        isOpen={isModalOpen}
        onClose={() => {
          setModalOpen(false);
          setCancelReason('');
          setCancelError(null);
        }}
        onConfirm={() => cancelMutation.mutate()}
        confirmText={cancelMutation.isPending ? 'Cancelling…' : 'Confirm cancel'}
        loading={cancelMutation.isPending}
        confirmTone="danger"
      >
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700" htmlFor="cancel-reason">
            Reason
          </label>
          <input
            id="cancel-reason"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Optional"
            className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          />
        </div>
      </ConfirmModal>

      {/* Assign driver modal (legacy — kept for backward compat) */}
      <AssignDriverModal
        isOpen={assignOpen}
        onClose={() => setAssignOpen(false)}
        bookingId={booking?.id ?? ''}
        leg={assignLeg}
        carTypeId={booking?.service_class_id ?? null}
        fareMinor={booking?.pricing_snapshot?.final_fare_minor ?? booking?.pricing_snapshot?.base_fare_minor ?? booking?.total_price_minor ?? 0}
        tollParkingMinor={booking?.pricing_snapshot?.toll_parking_minor ?? 0}
        totalPriceMinor={booking?.total_price_minor ?? 0}
        currency={booking?.currency ?? 'AUD'}
        onAssigned={() => {
          setAssignOpen(false);
          refetch();
        }}
      />

      {/* Edit driver pay modal */}
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
