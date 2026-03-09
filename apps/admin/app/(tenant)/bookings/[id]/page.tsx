'use client';
import { useMemo, useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatBookingTime } from '@/lib/format-datetime';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { AssignDriverModal } from '@/components/assign-driver-modal';
import { PaymentModal } from '@/components/payment-modal';
import { FulfilModal } from '@/components/fulfil-modal';
import { AssignPartnerModal } from '@/components/assign-partner-modal';
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
import { getVerificationBadge, getTransferBadge } from '@/lib/badges/getVerificationBadge';
import { formatStatus } from '@/lib/ui/formatStatus';

// Statuses that allow cancellation
const CANCELABLE_STATUSES = new Set(['DRAFT', 'PENDING', 'CONFIRMED', 'ASSIGNED', 'AWAITING_CONFIRMATION', 'PENDING_CUSTOMER_CONFIRMATION']);

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
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignPartnerOpen, setAssignPartnerOpen] = useState(false);
  const [showAssignMenu, setShowAssignMenu] = useState(false);
  const [assignLeg, setAssignLeg] = useState<'A' | 'B'>('A');
  const [partnerActionId, setPartnerActionId] = useState<string | null>(null);
  const [partnerActionLoading, setPartnerActionLoading] = useState(false);
  const [editPayOpen, setEditPayOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [fulfilOpen, setFulfilOpen] = useState(false);
  const [driverReport, setDriverReport] = useState<any>(null);
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
  const legAAssignment = useMemo(() => assignments.find((a: any) => a.leg === 'A' || !a.leg) ?? assignments.at(0), [assignments]);
  const legBAssignment = useMemo(() => assignments.find((a: any) => a.leg === 'B'), [assignments]);
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

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner />
    </div>
  );

  if (error || !booking) {
    return <ErrorAlert message="Unable to load booking." onRetry={refetch} />;
  }

  const customerName = `${booking.customer_first_name ?? ''} ${booking.customer_last_name ?? ''}`.trim();
  const passengerName = (booking.passenger_name
    ?? `${booking.passenger_first_name ?? ''} ${booking.passenger_last_name ?? ''}`.trim())
    || customerName;
  const dispatchHref = `/dispatch?booking_id=${booking.id}&return=/bookings/${booking.id}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2 flex-wrap">
            Booking {booking.booking_reference}
            {getTransferBadge(booking).show && (
              <Badge variant="info">
                📥 Transferred from {getTransferBadge(booking).sourceTenantName ?? 'another tenant'}
              </Badge>
            )}
          </span>
        }
        description={`Created ${formatBookingTime(booking.created_at, null, null)}`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={getBookingStatusBadge(booking.operational_status)}>
              {formatStatus(booking.operational_status)}
            </Badge>
            {/* Driver execution status — shown when assigned and driver has acted */}
            {booking.assignments?.[0]?.driver_execution_status &&
             !['assigned'].includes(booking.assignments[0].driver_execution_status) && (
              <Badge variant={getBookingStatusBadge(booking.assignments[0].driver_execution_status)}>
                🚗 {formatStatus(booking.assignments[0].driver_execution_status)}
              </Badge>
            )}
            {booking.payment_status === 'UNPAID' && data?.saved_card ? (
              <Badge variant="info">
                💳 Card saved ····{data.saved_card.card_last4}
              </Badge>
            ) : (
              <Badge variant={PAY_BADGE[booking.payment_status] ?? 'neutral'}>
                {booking.payment_status ?? '—'}
              </Badge>
            )}
            <Button variant="secondary" onClick={() => setPaymentOpen(true)}>
              💳 Payment
            </Button>
            {booking.operational_status === 'COMPLETED' && (
              <Button variant="primary" onClick={async () => {
                try {
                  const assignment = booking.assignments?.[0];
                  if (assignment?.id) {
                    const res = await api.get(`/driver-app/extra-report/${assignment.id}`);
                    setDriverReport(res.data);
                  }
                } catch {}
                setFulfilOpen(true);
              }}>
                ✅ Review & Fulfil
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── PENDING_CUSTOMER_CONFIRMATION banner (widget/guest bookings) ── */}
        {booking.operational_status === 'PENDING_CUSTOMER_CONFIRMATION' && (
          <div className="lg:col-span-3 bg-blue-50 border border-blue-300 rounded-xl p-4 flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-blue-900">📋 New Booking — Pending Confirmation</p>
              <p className="text-sm text-blue-700 mt-1">
                Customer has submitted and saved their card. Confirm to accept this booking.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={async () => {
                  try {
                    await api.patch(`/bookings/${booking.id}/transition`, { newStatus: 'CONFIRMED' });
                    setToast({ message: 'Booking confirmed!', tone: 'success' });
                    refetch();
                  } catch (e: any) {
                    setToast({ message: e.response?.data?.message ?? 'Failed to confirm', tone: 'error' });
                  }
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
              >
                ✅ Confirm Booking
              </button>
              <button
                onClick={() => { setRejectReason(''); setRejectOpen(true); }}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200"
              >
                ✕ Reject
              </button>
            </div>
          </div>
        )}

        {/* ── AWAITING_CONFIRMATION banner ── */}
        {booking.operational_status === 'AWAITING_CONFIRMATION' && (
          <div className="lg:col-span-3 bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-amber-900">⏳ Awaiting Confirmation</p>
              <p className="text-sm text-amber-700 mt-1">
                Customer submitted this booking and saved their card. Review and confirm to charge their card off-session.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={async () => {
                  if (!confirm('Confirm and charge the customer\'s saved card?')) return;
                  try {
                    const res = await api.post(`/bookings/${booking.id}/confirm-and-charge`);
                    if (res.data.success) {
                      setToast({ message: 'Booking confirmed and payment captured!', tone: 'success' });
                    } else {
                      setToast({ message: `Charge failed: ${res.data.error}`, tone: 'error' });
                    }
                    refetch();
                  } catch (e: any) {
                    setToast({ message: e.response?.data?.message ?? 'Failed', tone: 'error' });
                  }
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
              >
                ✅ Confirm &amp; Charge
              </button>
              <button
                onClick={() => { setRejectReason(''); setRejectOpen(true); }}
                className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50"
              >
                ✗ Reject
              </button>
            </div>
          </div>
        )}

        {/* ── PAYMENT_FAILED banner ── */}
        {booking.operational_status === 'PAYMENT_FAILED' && (
          <div className="lg:col-span-3 bg-red-50 border border-red-300 rounded-xl p-4 flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-red-900">❌ Payment Failed</p>
              <p className="text-sm text-red-700 mt-1">
                The off-session charge failed. You can retry or contact the customer to update their payment method.
              </p>
            </div>
            <button
              onClick={async () => {
                if (!confirm('Retry charging the customer\'s saved card?')) return;
                try {
                  const res = await api.post(`/bookings/${booking.id}/confirm-and-charge`);
                  if (res.data.success) {
                    setToast({ message: 'Payment successful!', tone: 'success' });
                  } else {
                    setToast({ message: `Charge failed again: ${res.data.error}`, tone: 'error' });
                  }
                  refetch();
                } catch (e: any) {
                  setToast({ message: e.response?.data?.message ?? 'Failed', tone: 'error' });
                }
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 shrink-0"
            >
              🔄 Retry Charge
            </button>
          </div>
        )}

        {/* ── Left column ── */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="Booking Info">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
              <InfoRow label="Reference" value={booking.booking_reference} />
              <InfoRow label="Service Type" value={booking.service_type_name ?? '—'} />
              <InfoRow label="Car Type" value={booking.service_class_name ?? '—'} />
              <InfoRow label="Pickup Time" value={formatPickupTime(booking.pickup_at_utc, booking.timezone, booking.city_name)} />
              {booking.return_pickup_at_utc && (
                <InfoRow label="Return Time" value={formatPickupTime(booking.return_pickup_at_utc, booking.timezone, booking.city_name)} />
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
              <div>{passengerName || '—'}</div>
              <div>{formatPhone(booking.passenger_phone_country_code, booking.passenger_phone_number)}</div>
              {booking.passenger_preferences && (
                <div className="text-gray-500">{booking.passenger_preferences}</div>
              )}
            </div>
          </Card>

          <Card title="Notes">
            <div className="text-sm text-gray-700">{booking.special_requests || 'No notes'}</div>
          </Card>

          {/* Pricing Breakdown */}
          {booking.pricing_snapshot && (
            <Card title="Pricing">
              <div className="space-y-1 text-sm text-gray-700">
                {(() => {
                  const snap = booking.pricing_snapshot;
                  const cur = booking.currency ?? 'AUD';
                  const fmt = (v: number) => `${cur} ${(v / 100).toFixed(2)}`;
                  // pre_discount_fare_minor = fare before discount (includes base + distance + waypoints + seats, NO toll)
                  // Waypoints and baby seats are already merged into pre_discount_fare_minor — do NOT show separately
                  const baseFare = snap.pre_discount_fare_minor ?? snap.base_calculated_minor ?? snap.base_fare_minor ?? snap.base_price_minor ?? 0;
                  const discountMinor = snap.discount_amount_minor ?? snap.discount_minor ?? 0;
                  const tollMinor = snap.toll_minor ?? 0;
                  const parkingMinor = snap.parking_minor ?? 0;
                  return (<>
                    {/* 1. Base fare (pre-discount, includes waypoints+seats, NO toll) */}
                    {baseFare > 0 && <div className="flex justify-between"><span className="text-gray-500">Base Fare</span><span>{fmt(baseFare)}</span></div>}
                    {/* 2. Surcharges */}
                    {(snap.time_surcharge_minor ?? 0) > 0 && <div className="flex justify-between"><span className="text-gray-500">Time Surcharge</span><span>+{fmt(snap.time_surcharge_minor)}</span></div>}
                    {snap.surcharge_items?.map((item: { label: string; amount_minor: number }, i: number) => (
                      <div key={i} className="flex justify-between"><span className="text-gray-500">{item.label}</span><span>+{fmt(item.amount_minor)}</span></div>
                    ))}
                    {/* 3. Discount (fare only — toll NOT discounted) */}
                    {discountMinor > 0 && (
                      <div className="flex justify-between text-green-600"><span>Discount</span><span>− {fmt(discountMinor)}</span></div>
                    )}
                    {/* 4. Toll / Parking (added AFTER discount, never discounted) */}
                    {tollMinor > 0 && <div className="flex justify-between"><span className="text-gray-500">Road Tolls</span><span>+{fmt(tollMinor)}</span></div>}
                    {parkingMinor > 0 && <div className="flex justify-between"><span className="text-gray-500">Airport Parking</span><span>+{fmt(parkingMinor)}</span></div>}
                    {tollMinor === 0 && parkingMinor === 0 && (snap.toll_parking_minor ?? 0) > 0 && (
                      <div className="flex justify-between"><span className="text-gray-500">Tolls / Parking</span><span>+{fmt(snap.toll_parking_minor)}</span></div>
                    )}
                    {/* 5. Total */}
                    <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                      <span>Total</span>
                      <span>{fmt(snap.grand_total_minor ?? snap.final_fare_minor ?? booking.total_price_minor ?? 0)}</span>
                    </div>
                  </>);
                })()}
                {data?.payments?.summary && (
                  <div className="flex justify-between text-xs text-gray-500 pt-1">
                    <span>Captured</span>
                    <span>{data.payments.summary.currency} {((data.payments.summary.captured_minor) / 100).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* ── Right column ── */}
        <div className="space-y-6">

          {/* Assignment */}
          <Card title="Assignment">
            {latestAssignment ? (
              <div className="space-y-2 text-sm text-gray-700">
                {/* Partner assignment */}
                {latestAssignment.assignment_type === 'PARTNER' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {latestAssignment.status === 'PENDING' && (
                        <Badge variant="warning">⏳ Awaiting Partner</Badge>
                      )}
                      {latestAssignment.status === 'ACCEPTED' && (
                        <Badge variant="info">🤝 Partner Assigned</Badge>
                      )}
                      {latestAssignment.status === 'DECLINED' && (
                        <Badge variant="danger">❌ Partner Declined</Badge>
                      )}
                    </div>
                    <div>
                      <span className="text-gray-500">Partner:</span>{' '}
                      <span className="font-medium">{latestAssignment.partner_tenant_id ?? '—'}</span>
                    </div>
                    {latestAssignment.partner_pay_minor != null && (
                      <div>
                        <span className="text-gray-500">Partner Pay:</span>{' '}
                        {booking?.currency} {((latestAssignment.partner_pay_minor) / 100).toFixed(2)}
                      </div>
                    )}
                    {canAssign && latestAssignment.status === 'PENDING' && (
                      <Button
                        variant="danger"
                        className="w-full mt-2"
                        onClick={async () => {
                          setPartnerActionLoading(true);
                          try {
                            await api.post(`/assignments/${latestAssignment.id}/cancel-transfer`);
                            refetch();
                          } finally {
                            setPartnerActionLoading(false);
                          }
                        }}
                        disabled={partnerActionLoading}
                      >
                        {partnerActionLoading ? 'Cancelling...' : 'Cancel Transfer'}
                      </Button>
                    )}
                    {canAssign && latestAssignment.status === 'DECLINED' && (
                      <div className="flex gap-2 mt-2">
                        <Link href={dispatchHref} className="flex-1">
                          <Button variant="secondary" className="w-full">Assign Driver</Button>
                        </Link>
                        <Button
                          className="flex-1"
                          onClick={() => { setAssignLeg('A'); setAssignPartnerOpen(true); }}
                        >
                          Assign to Partner
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Internal driver assignment */
                  <div className="space-y-2">
                    <div>
                      <span className="text-gray-500">Driver:</span>{' '}
                      {latestAssignment.driver_name ?? '—'}
                      {getVerificationBadge({
                        source_type: latestAssignment.driver_source_type,
                        approval_status: latestAssignment.driver_approval_status,
                        platform_verified: latestAssignment.driver_platform_verified,
                      }).show && <Badge variant="success" className="ml-2 text-xs">✓ Verified</Badge>}
                    </div>
                    <div>
                      <span className="text-gray-500">Vehicle:</span>{' '}
                      {[latestAssignment.vehicle_make, latestAssignment.vehicle_model, latestAssignment.vehicle_plate]
                        .filter(Boolean).join(' ') || '—'}
                      {getVerificationBadge({
                        source_type: latestAssignment.vehicle_source_type,
                        approval_status: latestAssignment.vehicle_approval_status,
                        platform_verified: latestAssignment.vehicle_platform_verified,
                      }).show && <Badge variant="success" className="ml-2 text-xs">✓ Verified</Badge>}
                    </div>
                    <div><span className="text-gray-500">Phone:</span> {latestAssignment.driver_phone ?? '—'}</div>
                    <div>
                      <span className="text-gray-500">Status:</span>{' '}
                      <Badge variant={getBookingStatusBadge(latestAssignment.status ?? '')}>
                        {latestAssignment.status ?? '—'}
                      </Badge>
                    </div>
                    {canAssign && (
                      <div className="mt-3 flex gap-2">
                        <Link href={dispatchHref} className="flex-1">
                          <Button variant="secondary" className="w-full">Reassign Driver</Button>
                        </Link>
                        <Button
                          variant="ghost"
                          className="flex-1 border border-purple-200 text-purple-700 hover:bg-purple-50"
                          onClick={() => { setAssignLeg('A'); setAssignPartnerOpen(true); }}
                        >
                          Assign to Partner
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm text-gray-500">No driver assigned</div>
                {canAssign && (
                  <div className="flex flex-col gap-2">
                    <Button className="w-full" onClick={() => { setAssignLeg('A'); setAssignOpen(true); }}>
                      Assign Internal Driver
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full border border-purple-200 text-purple-700 hover:bg-purple-50"
                      onClick={() => { setAssignLeg('A'); setAssignPartnerOpen(true); }}
                    >
                      Assign to Partner
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Return Trip — Leg B Assignment */}
          {booking.is_return_trip && (
            <Card title="Return Leg (Leg B)">
              <div className="text-xs text-gray-500 mb-3">
                Return pickup: <strong className="text-gray-700">{booking.return_pickup_address_text ?? '—'}</strong>
                {booking.return_pickup_at_utc && (
                  <> · <strong className="text-gray-700">{new Date(booking.return_pickup_at_utc).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}</strong></>
                )}
              </div>
              {legBAssignment ? (
                <div className="space-y-2 text-sm">
                  <div><span className="text-gray-500">Driver:</span> {legBAssignment.driver_name ?? '—'}</div>
                  <div><span className="text-gray-500">Vehicle:</span> {[legBAssignment.vehicle_make, legBAssignment.vehicle_model, legBAssignment.vehicle_plate].filter(Boolean).join(' ') || '—'}</div>
                  <div><span className="text-gray-500">Status:</span>{' '}
                    <Badge variant={getBookingStatusBadge(legBAssignment.status ?? '')}>{legBAssignment.status ?? '—'}</Badge>
                  </div>
                  {canAssign && (
                    <div className="mt-3 flex gap-2">
                      <Button variant="secondary" className="flex-1"
                        onClick={() => { setAssignLeg('B'); setAssignOpen(true); }}>
                        Reassign Leg B
                      </Button>
                      <Button variant="ghost" className="flex-1 border border-purple-200 text-purple-700"
                        onClick={() => { setAssignLeg('B'); setAssignPartnerOpen(true); }}>
                        Partner Leg B
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm text-gray-500">No driver assigned for return leg</div>
                  {canAssign && (
                    <div className="flex flex-col gap-2">
                      <Button className="w-full"
                        onClick={() => { setAssignLeg('B'); setAssignOpen(true); }}>
                        Assign Driver — Return Leg
                      </Button>
                      <Button variant="ghost" className="w-full border border-purple-200 text-purple-700"
                        onClick={() => { setAssignLeg('B'); setAssignPartnerOpen(true); }}>
                        Assign Partner — Return Leg
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* Status Timeline */}
          <Card title="Status Timeline">
            <BookingStatusTimeline status={booking.operational_status} statusHistory={data?.status_history ?? []} />
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

      {/* Reject Booking modal */}
      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Reject Booking</h2>
            <p className="text-sm text-gray-600">
              This will reject <strong>{booking?.booking_reference}</strong> and notify the customer. The card will not be charged.
            </p>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Reason for rejection <span className="text-red-500">*</span></label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
                rows={3}
                placeholder="e.g. No availability for this date, service area not covered..."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
              />
            </div>
            {rejectReason.trim() === '' && <p className="text-xs text-red-500">Please enter a reason before rejecting.</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setRejectOpen(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                disabled={rejectLoading || rejectReason.trim() === ''}
                onClick={async () => {
                  setRejectLoading(true);
                  try {
                    await api.post(`/bookings/${booking.id}/reject`, { reason: rejectReason.trim() });
                    setToast({ message: 'Booking rejected — customer notified', tone: 'success' });
                    setRejectOpen(false);
                    refetch();
                  } catch (e: any) {
                    setToast({ message: e.response?.data?.message ?? 'Failed to reject', tone: 'error' });
                  } finally {
                    setRejectLoading(false);
                  }
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {rejectLoading ? 'Rejecting…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign to Partner modal */}
      <AssignPartnerModal
        isOpen={assignPartnerOpen}
        onClose={() => setAssignPartnerOpen(false)}
        bookingId={booking?.id ?? ''}
        leg={assignLeg}
        fareMinor={booking?.pricing_snapshot?.final_fare_minor ?? booking?.pricing_snapshot?.base_fare_minor ?? booking?.total_price_minor ?? 0}
        tollMinor={booking?.pricing_snapshot?.toll_minor ?? 0}
        parkingMinor={booking?.pricing_snapshot?.parking_minor ?? 0}
        totalPriceMinor={booking?.total_price_minor ?? 0}
        currency={booking?.currency ?? 'AUD'}
        onAssigned={() => {
          setAssignPartnerOpen(false);
          refetch();
          setToast({ message: 'Transfer sent to partner', tone: 'success' });
        }}
      />

      {/* Assign driver modal (legacy — kept for backward compat) */}
      <AssignDriverModal
        isOpen={assignOpen}
        onClose={() => setAssignOpen(false)}
        bookingId={booking?.id ?? ''}
        leg={assignLeg}
        carTypeId={booking?.service_class_id ?? null}
        fareMinor={booking?.pricing_snapshot?.final_fare_minor ?? booking?.pricing_snapshot?.base_fare_minor ?? booking?.total_price_minor ?? 0}
        tollMinor={booking?.pricing_snapshot?.toll_minor ?? 0}
        parkingMinor={booking?.pricing_snapshot?.parking_minor ?? 0}
        totalPriceMinor={booking?.total_price_minor ?? 0}
        currency={booking?.currency ?? 'AUD'}
        pickupAt={booking?.pickup_at_utc ?? booking?.pickup_at ?? undefined}
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

      <FulfilModal
        isOpen={fulfilOpen}
        onClose={() => setFulfilOpen(false)}
        bookingId={booking?.id ?? ''}
        bookingRef={booking?.booking_reference ?? ''}
        originalMinor={booking?.total_price_minor ?? 0}
        currency={booking?.currency ?? 'AUD'}
        driverReport={driverReport}
        onFulfilled={() => {
          setFulfilOpen(false);
          refetch();
          setToast({ message: 'Booking fulfilled', tone: 'success' });
        }}
      />

      <PaymentModal
        isOpen={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        bookingId={booking?.id ?? ''}
        bookingRef={booking?.booking_reference ?? ''}
        totalMinor={booking?.total_price_minor ?? 0}
        currency={booking?.currency ?? 'AUD'}
        customerEmail={booking?.customer_email ?? ''}
        paymentStatus={booking?.payment_status ?? 'UNPAID'}
        onUpdated={() => { setPaymentOpen(false); refetch(); setToast({ message: 'Payment updated', tone: 'success' }); }}
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

function formatPickupTime(isoUtc: string, tz: string, cityName?: string) {
  return formatBookingTime(isoUtc, tz, cityName ?? null);
}
