'use client';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { AssignDriverModal } from '@/components/assign-driver-modal';
import { EditDriverPayModal } from '@/components/edit-driver-pay-modal';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { DetailPage, DetailSection } from '@/components/patterns/DetailPage';

const CANCELABLE_STATUSES = new Set(['DRAFT', 'PENDING', 'CONFIRMED', 'ASSIGNED']);

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>();
  const bookingId = params.id;
  const queryClient = useQueryClient();
  const [isModalOpen, setModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignLeg, setAssignLeg] = useState<'A' | 'B'>('A');
  const [editPayOpen, setEditPayOpen] = useState(false);
  const [editPayAssignmentId, setEditPayAssignmentId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: async () => {
      const res = await api.get(`/bookings/${bookingId}`);
      return res.data;
    },
    enabled: Boolean(bookingId),
  });

  const booking = data?.booking;
  const timeline = data?.status_history ?? [];
  const assignments = data?.assignments ?? [];
  const payments = data?.payments ?? [];
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
    return <div className="text-gray-500">Loading...</div>;
  }

  if (error || !booking) {
    return <ErrorAlert message="Unable to load booking." />;
  }

  return (
    <>
      <DetailPage
        title={`Booking ${booking.booking_reference}`}
        subtitle={`Created ${new Date(booking.created_at).toLocaleString()}`}
        badges={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={booking.operational_status} type="operational" />
            <StatusBadge status={booking.payment_status} type="payment" />
          </div>
        }
        actions={
          canCancel ? (
            <button
              onClick={() => setModalOpen(true)}
              className="px-4 py-2 rounded bg-red-600 text-white text-sm font-medium hover:bg-red-700"
            >
              Cancel Booking
            </button>
          ) : undefined
        }
        primary={
          <>
            <DetailSection title="Booking Overview">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoRow label="Customer">
                  {booking.customer_first_name} {booking.customer_last_name}
                  {booking.customer_email && <p className="text-sm text-gray-500">{booking.customer_email}</p>}
                  {booking.customer_phone && <p className="text-sm text-gray-500">{booking.customer_phone}</p>}
                </InfoRow>
                <InfoRow label="Booking Source">{booking.booking_source}</InfoRow>
                <InfoRow label="Pickup">
                  <p className="font-medium">{booking.pickup_address_text}</p>
                  <p className="text-sm text-gray-500">{formatPickupTime(booking.pickup_at_utc, booking.timezone)}</p>
                </InfoRow>
                <InfoRow label="Dropoff">
                  <p className="font-medium">{booking.dropoff_address_text}</p>
                </InfoRow>
              </div>
            </DetailSection>

            {booking.waypoints && booking.waypoints.length > 0 && (
              <DetailSection title="Waypoints">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                    {booking.waypoints.length} stops
                  </span>
                </div>
                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                  {booking.waypoints.map((wp: any, idx: number) => (
                    <li key={idx}>{wp?.address ?? wp?.address_text ?? wp}</li>
                  ))}
                </ul>
              </DetailSection>
            )}

            <DetailSection title="Extras">
              <div className="flex flex-wrap gap-2">
                {booking.passenger_count > 0 && (
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                    {booking.passenger_count} passengers
                  </span>
                )}
                {booking.luggage_count > 0 && (
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                    {booking.luggage_count} luggage
                  </span>
                )}
                {booking.special_requests && (
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                    {booking.special_requests}
                  </span>
                )}
                {!booking.passenger_count && !booking.luggage_count && !booking.special_requests && (
                  <span className="text-sm text-gray-500">No extras</span>
                )}
              </div>
            </DetailSection>

            <DetailSection title="Assignment">
              {booking.is_return_trip ? (
                <div className="space-y-4">
                  <AssignmentCard
                    title="Leg A — Outbound"
                    assignment={legAAssignment}
                    from={booking.pickup_address_text}
                    to={booking.dropoff_address_text}
                    time={formatPickupTime(booking.pickup_at_utc, booking.timezone)}
                    onAssign={() => {
                      setAssignLeg('A');
                      setAssignOpen(true);
                    }}
                    onEditPay={(id) => {
                      setEditPayAssignmentId(id);
                      setEditPayOpen(true);
                    }}
                  />
                  <AssignmentCard
                    title="Leg B — Return"
                    assignment={legBAssignment}
                    from={booking.dropoff_address_text}
                    to={booking.return_pickup_address_text || booking.pickup_address_text}
                    time={booking.return_pickup_at_utc ? formatPickupTime(booking.return_pickup_at_utc, booking.timezone) : 'Return time not set'}
                    onAssign={() => {
                      setAssignLeg('B');
                      setAssignOpen(true);
                    }}
                    onEditPay={(id) => {
                      setEditPayAssignmentId(id);
                      setEditPayOpen(true);
                    }}
                  />
                </div>
              ) : (
                <AssignmentCard
                  title="Assignment"
                  assignment={latestAssignment}
                  from={booking.pickup_address_text}
                  to={booking.dropoff_address_text}
                  time={formatPickupTime(booking.pickup_at_utc, booking.timezone)}
                  onAssign={() => {
                    setAssignLeg('A');
                    setAssignOpen(true);
                  }}
                  onEditPay={(id) => {
                    setEditPayAssignmentId(id);
                    setEditPayOpen(true);
                  }}
                />
              )}
            </DetailSection>

            <DetailSection title="Pricing Breakdown">
              {booking.pricing_snapshot ? (
                booking.pricing_snapshot.pricingMode === 'ZONE' ? (
                  <div className="space-y-2 text-sm">
                    <SummaryRow label="Zone">{booking.pricing_snapshot.zoneName ?? 'Zone'}</SummaryRow>
                    <SummaryRow label="Total">
                      {formatMoney(Number(booking.pricing_snapshot.totalAmountMinor ?? booking.total_price_minor ?? 0),
                        booking.pricing_snapshot.currency ?? booking.currency ?? 'AUD')}
                    </SummaryRow>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Item
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {(booking.pricing_snapshot.items ?? []).map((item: any, idx: number) => (
                          <tr key={idx}>
                            <td className="px-4 py-2">{item.label ?? item.type ?? 'Item'}</td>
                            <td className="px-4 py-2 text-right">
                              {formatMoney(Number(item.amount_minor ?? item.amountMinor ?? 0),
                                booking.pricing_snapshot.currency ?? booking.currency ?? 'AUD')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                <p className="text-sm text-gray-500">No pricing calculated</p>
              )}
            </DetailSection>

            <DetailSection title="Status History">
              <ol className="space-y-4">
                {timeline.map((entry: any) => (
                  <li key={entry.id} className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full bg-blue-600 mt-1" />
                      <div className="flex-1 w-px bg-gray-200" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {entry.previous_status ? `${entry.previous_status} → ${entry.new_status}` : entry.new_status}
                      </p>
                      <p className="text-sm text-gray-500">{new Date(entry.created_at).toLocaleString()}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </DetailSection>
          </>
        }
        secondary={
          <>
            <DetailSection title="Payments">
              {payments && payments.length > 0 ? (
                <div className="space-y-2 text-sm">
                  {payments.map((payment: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-gray-600">{payment.status ?? 'Payment'}</span>
                      <span className="font-medium">
                        {formatMoney(Number(payment.amount_minor ?? 0), payment.currency ?? booking.currency ?? 'AUD')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No payments yet</p>
              )}
            </DetailSection>

            <DetailSection title="Notes">
              <p className="text-sm text-gray-500">Notes feature coming soon.</p>
            </DetailSection>
          </>
        }
      />

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


      {/* Assign Driver Modal */}
      <AssignDriverModal
        isOpen={assignOpen}
        onClose={() => setAssignOpen(false)}
        bookingId={booking?.id}
        leg={assignLeg}
        carTypeId={booking?.service_class_id ?? null}
        fromAddress={booking?.pickup_address_text ?? ''}
        toAddress={booking?.is_return_trip && assignLeg === 'B'
          ? (booking?.return_pickup_address_text || booking?.pickup_address_text || '')
          : (booking?.dropoff_address_text ?? '')}
        timeLabel={assignLeg === 'B' && booking?.return_pickup_at_utc
          ? formatPickupTime(booking.return_pickup_at_utc, booking.timezone)
          : formatPickupTime(booking.pickup_at_utc, booking.timezone)}
        onAssigned={() => {
          setAssignOpen(false);
          queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
        }}
      />

      {/* Edit Driver Pay Modal */}
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
          queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
        }}
      />
    </>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">{label}</p>
      <div className="text-sm text-gray-900 space-y-1">{children}</div>
    </div>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}

function formatMoney(amountMinor: number, currency: string) {
  return `${currency} ${(amountMinor / 100).toFixed(2)}`;
}

function formatPickupTime(isoUtc: string, tz: string) {
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

function AssignmentCard({
  title,
  assignment,
  from,
  to,
  time,
  onAssign,
  onEditPay,
}: {
  title: string;
  assignment: any;
  from: string;
  to: string;
  time: string;
  onAssign: () => void;
  onEditPay: (id: string) => void;
}) {
  return (
    <div className="border rounded p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">{title}</h4>
        {assignment ? (
          <StatusBadge status={assignment.status} />
        ) : (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">Unassigned</span>
        )}
      </div>

      <div className="text-sm text-gray-600 space-y-1">
        <div><strong>From:</strong> {from}</div>
        <div><strong>To:</strong> {to}</div>
        <div><strong>Time:</strong> {time}</div>
      </div>

      {assignment && (
        <div className="bg-gray-50 rounded p-3 text-sm space-y-1">
          <div>
            <span className="text-gray-500">Driver:</span>{' '}
            <span className="font-medium">{assignment.driver_name ?? 'Unknown'}</span>
          </div>
          {assignment.vehicle_plate && (
            <div>
              <span className="text-gray-500">Vehicle:</span>{' '}
              <span className="font-medium">
                {assignment.vehicle_make} {assignment.vehicle_model} · {assignment.vehicle_plate}
              </span>
            </div>
          )}
          {assignment.driver_pay_minor != null && (
            <div>
              <span className="text-gray-500">Driver Pay:</span>{' '}
              <span className="font-medium">
                {assignment.driver_pay_type === 'PERCENTAGE'
                  ? `${assignment.driver_pay_value}%`
                  : `$${(assignment.driver_pay_minor / 100).toFixed(2)}`}
                {' '}(${(assignment.driver_pay_minor / 100).toFixed(2)})
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        {!assignment && (
          <button
            onClick={onAssign}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            Assign Driver
          </button>
        )}
        {assignment && assignment.status !== 'IN_PROGRESS' && (
          <button
            onClick={() => onEditPay(assignment.id)}
            className="px-3 py-1.5 border text-sm rounded hover:bg-gray-50"
          >
            Edit Pay
          </button>
        )}
        {assignment && ['PENDING', 'ACCEPTED'].includes(assignment.status) && (
          <button
            onClick={onAssign}
            className="px-3 py-1.5 border text-sm rounded hover:bg-gray-50 text-orange-600"
          >
            Reassign
          </button>
        )}
      </div>
    </div>
  );
}
