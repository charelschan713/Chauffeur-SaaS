'use client';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { DetailPage, DetailSection } from '@/components/patterns/DetailPage';

const CANCELABLE_STATUSES = new Set(['DRAFT', 'PENDING', 'CONFIRMED', 'ASSIGNED']);

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>();
  const bookingId = params.id;
  const queryClient = useQueryClient();
  const [isModalOpen, setModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: async () => {
      const res = await api.get(`/bookings/${bookingId}`);
      return res.data.data;
    },
    enabled: Boolean(bookingId),
  });

  const booking = data?.booking;
  const timeline = data?.status_history ?? [];
  const assignments = data?.assignments ?? [];
  const payments = data?.payments;
  const latestAssignment = useMemo(() => assignments.at(0), [assignments]);
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
                  <p className="text-sm text-gray-500">{formatDatetime(booking.pickup_at_utc, booking.timezone)}</p>
                </InfoRow>
                <InfoRow label="Dropoff">
                  <p className="font-medium">{booking.dropoff_address_text}</p>
                </InfoRow>
              </div>
            </DetailSection>

            <DetailSection title="Assignment">
              {latestAssignment ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{latestAssignment.driver_name ?? 'Unassigned'}</p>
                    <StatusBadge status={latestAssignment.status} />
                  </div>
                  <p className="text-sm text-gray-500">
                    Updated {new Date(latestAssignment.updated_at ?? latestAssignment.created_at).toLocaleString()}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No assignment yet.</p>
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
                      <p className="font-medium">{entry.status ?? entry.new_status}</p>
                      <p className="text-sm text-gray-500">{new Date(entry.created_at).toLocaleString()}</p>
                      {entry.actor && <p className="text-xs text-gray-500">{entry.actor}</p>}
                      {entry.reason && <p className="text-sm text-gray-600 mt-1">Reason: {entry.reason}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </DetailSection>
          </>
        }
        secondary={
          <>
            <DetailSection title="Payment Summary">
              {payments ? (
                <div className="space-y-2 text-sm">
                  <SummaryRow label="Authorized">
                    {formatMoney(payments.summary.authorized_minor, payments.summary.currency)}
                  </SummaryRow>
                  <SummaryRow label="Captured">
                    {formatMoney(payments.summary.captured_minor, payments.summary.currency)}
                  </SummaryRow>
                  <SummaryRow label="Refunded">
                    {formatMoney(payments.summary.refunded_minor, payments.summary.currency)}
                  </SummaryRow>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No payment data.</p>
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

function formatDatetime(isoUtc: string, tz: string) {
  return new Date(isoUtc).toLocaleString('en-AU', { timeZone: tz });
}
