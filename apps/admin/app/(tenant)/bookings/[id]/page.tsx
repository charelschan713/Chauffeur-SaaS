'use client';
import { useMemo, useState, useEffect, Suspense, useCallback } from 'react';
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
import { ModifyBookingModal } from '@/components/modify-booking-modal';
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
import { TripEvidencePanel } from '@/components/TripEvidencePanel';

// Statuses that allow cancellation
const CANCELABLE_STATUSES = new Set(['DRAFT', 'PENDING', 'CONFIRMED', 'ASSIGNED', 'AWAITING_CONFIRMATION', 'PENDING_CUSTOMER_CONFIRMATION', 'FULFILLED']);

// Statuses where assignment actions make no sense
const NO_ASSIGN_STATUSES = new Set(['CANCELLED', 'COMPLETED', 'FULFILLED', 'JOB_COMPLETED', 'NO_SHOW']);

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
  const [modifyOpen, setModifyOpen] = useState(false);
  const [fulfilOpen, setFulfilOpen] = useState(false);
  const [driverReport, setDriverReport] = useState<any>(null);
  const [editPayAssignmentId, setEditPayAssignmentId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [resendingInvoice, setResendingInvoice] = useState(false);
  const [downloadingInvoicePdf, setDownloadingInvoicePdf] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: async () => {
      const res = await api.get(`/bookings/${bookingId}`);
      return res.data;
    },
    enabled: Boolean(bookingId),
  });

  const { data: carTypes = [] } = useQuery({
    queryKey: ['car-types'],
    queryFn: async () => {
      const res = await api.get('/pricing/service-classes');
      return res.data ?? [];
    },
  });

  const { data: serviceTypes = [] } = useQuery({
    queryKey: ['service-types'],
    queryFn: async () => {
      const res = await api.get('/service-types');
      return res.data ?? [];
    },
  });

  // Invoice state — fetched in parallel; null = not yet available; false = fetch failed
  const { data: invoiceData, refetch: refetchInvoice } = useQuery({
    queryKey: ['booking-invoice', bookingId],
    queryFn: async () => {
      const res = await api.get(`/invoices`, { params: { booking_id: bookingId, type: 'CUSTOMER', limit: 1 } });
      return res.data?.data?.[0] ?? null;
    },
    enabled: Boolean(bookingId),
    staleTime: 30_000,
  });
  const invoice = invoiceData ?? null;
  const invoiceStatus: string | null = invoice?.status ?? null;
  const invoiceHasFinal = invoiceStatus === 'SENT' || invoiceStatus === 'PAID';

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
  const pricingSnapshot = booking?.pricing_snapshot as Record<string, any> | null | undefined;
  const hasReturnLegs = !!(booking?.trip_mode === 'RETURN' && (pricingSnapshot?.leg1_minor || pricingSnapshot?.leg2_minor));
  const assignLegFareMinor =
    assignLeg === 'A'
      ? (hasReturnLegs ? (pricingSnapshot?.leg1_minor ?? pricingSnapshot?.final_fare_minor ?? booking?.total_price_minor ?? 0) : (pricingSnapshot?.final_fare_minor ?? booking?.total_price_minor ?? 0))
      : (hasReturnLegs ? (pricingSnapshot?.leg2_minor ?? 0) : (pricingSnapshot?.final_fare_minor ?? booking?.total_price_minor ?? 0));

  const latestAssignment = useMemo(() => assignments.at(0), [assignments]);

  const splitFlight = (value?: string | null) => {
    if (!value) return { outbound: null, ret: null };
    const raw = String(value);
    const parts = raw.split(' / Return ');
    if (parts.length > 1) return { outbound: parts[0]?.trim() || null, ret: parts.slice(1).join(' / Return ').trim() || null };
    if (/^Return\s+/i.test(raw)) return { outbound: null, ret: raw.replace(/^Return\s+/i, '').trim() || null };
    return { outbound: raw.trim() || null, ret: null };
  };
  const legAAssignment = useMemo(() => assignments.find((a: any) => a.leg === 'A' || !a.leg) ?? assignments.at(0), [assignments]);
  const legBAssignment = useMemo(() => assignments.find((a: any) => a.leg === 'B'), [assignments]);
  // Phase 2: driver extra report from booking detail (no separate API call needed)
  const driverExtraReport: any = data?.driver_extra_report ?? null;
  const reportPendingReview = driverExtraReport?.status === 'pending';
  const reportHasExtras = driverExtraReport?.has_extras === true;
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
              Payment
            </Button>
            <Button variant="secondary" onClick={() => setModifyOpen(true)}>
              Modify Booking
            </Button>
            {booking.operational_status === 'COMPLETED' && (
              <Button
                variant="primary"
                onClick={() => {
                  // Phase 2: use already-loaded driver_extra_report from booking detail
                  setDriverReport(driverExtraReport);
                  setFulfilOpen(true);
                }}
              >
                {reportPendingReview
                  ? (reportHasExtras ? '⚠️ Review Extras & Fulfil' : '📋 Review Report & Fulfil')
                  : '✅ Review & Fulfil'}
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

        {/* ── CONFIRMED + payment_status=FAILED (charge succeeded but DB persist issue) ── */}
        {booking.operational_status === 'CONFIRMED' && booking.payment_status === 'FAILED' && (
          <div className="lg:col-span-3 bg-orange-50 border border-orange-300 rounded-xl p-4 flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-orange-900">⚠️ Payment Recording Issue</p>
              <p className="text-sm text-orange-700 mt-1">
                Booking is CONFIRMED but payment_status shows FAILED — this may indicate
                the Stripe charge succeeded but the payments record failed to save.
                Check Stripe dashboard for PI on this booking before taking action.
              </p>
              {booking.stripe_payment_intent_id && (
                <p className="text-xs text-orange-600 mt-1 font-mono">PI: {booking.stripe_payment_intent_id}</p>
              )}
            </div>
            <a
              href={`https://dashboard.stripe.com/test/payment_intents/${booking.stripe_payment_intent_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 shrink-0 whitespace-nowrap"
            >
              🔍 View in Stripe
            </a>
          </div>
        )}

        {/* ── Adjustment exception panels ── */}
        {booking.adjustment_status === 'FAILED' && (
          <div className="lg:col-span-3 bg-red-50 border border-red-300 rounded-xl p-4 flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-red-900">❌ Extra Charge Failed</p>
              <p className="text-sm text-red-700 mt-1">
                The extra charge at fulfilment was declined by Stripe.
                The customer's saved card was charged or verified but the extra amount was not captured.
              </p>
              <p className="text-xs text-red-600 mt-1">
                Next step: contact customer to collect the extra amount manually, or send a payment link.
              </p>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={async () => {
                  try {
                    const res = await api.post(`/bookings/${booking.id}/send-payment-link`);
                    if (res.data?.payment_link) {
                      setToast({ message: 'Payment link sent to customer', tone: 'success' });
                    } else {
                      setToast({ message: 'Payment link sent', tone: 'success' });
                    }
                  } catch (e: any) {
                    setToast({ message: e.response?.data?.message ?? 'Failed to send payment link', tone: 'error' });
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 whitespace-nowrap"
              >
                💳 Send Payment Link
              </button>
            </div>
          </div>
        )}

        {booking.adjustment_status === 'NO_PAYMENT_METHOD' && (
          <div className="lg:col-span-3 bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-amber-900">⚠️ No Payment Method on File</p>
              <p className="text-sm text-amber-700 mt-1">
                The extra charge at fulfilment could not be attempted — this customer has no saved
                payment method (guest booking). Manual collection or a payment link is required.
              </p>
              <p className="text-xs text-amber-600 mt-1">
                Extra amount was not captured. Send a payment link or collect manually.
              </p>
            </div>
            <button
              onClick={async () => {
                try {
                  await api.post(`/bookings/${booking.id}/send-payment-link`);
                  setToast({ message: 'Payment link sent to customer', tone: 'success' });
                } catch (e: any) {
                  setToast({ message: e.response?.data?.message ?? 'Failed to send payment link', tone: 'error' });
                }
              }}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 shrink-0 whitespace-nowrap"
            >
              💳 Send Payment Link
            </button>
          </div>
        )}

        {/* ── Invoice state panel (FULFILLED/COMPLETED bookings) ── */}
        {['FULFILLED', 'COMPLETED'].includes(booking.operational_status) && (
          <div className={`lg:col-span-3 rounded-xl p-4 border flex items-start justify-between gap-4 ${
            invoiceHasFinal
              ? 'bg-green-50 border-green-300'
              : 'bg-gray-50 border-gray-300'
          }`}>
            <div>
              {invoiceHasFinal ? (
                <>
                  <p className="font-semibold text-green-900">🧾 Final Invoice Sent</p>
                  <p className="text-sm text-green-700 mt-1">
                    Invoice {invoice?.invoice_number ?? ''} · Status: <strong>{invoiceStatus}</strong>
                    {invoice?.recipient_email && ` · Sent to ${invoice.recipient_email}`}
                  </p>
                </>
              ) : invoice ? (
                <>
                  <p className="font-semibold text-gray-800">🧾 Invoice Draft — Not Sent</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Invoice {invoice?.invoice_number ?? ''} exists but is in <strong>{invoiceStatus}</strong> status.
                    Update and send from the <a href="/invoices" className="underline text-blue-600">Invoices</a> page.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-gray-800">🧾 No Invoice Yet</p>
                  <p className="text-sm text-gray-600 mt-1">
                    No customer invoice has been created for this booking.
                    Create one from the <a href="/invoices" className="underline text-blue-600">Invoices</a> page.
                  </p>
                </>
              )}
            </div>
            {invoiceHasFinal && (
              <div className="flex gap-2 shrink-0">
                <button
                  disabled={downloadingInvoicePdf}
                  onClick={async () => {
                    setDownloadingInvoicePdf(true);
                    try {
                      const res = await api.get(`/bookings/${booking.id}/invoice-pdf`, { responseType: 'blob' });
                      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `Invoice-${booking.booking_reference ?? booking.id}.pdf`;
                      document.body.appendChild(a); a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    } catch {
                      setToast({ message: 'Failed to download invoice PDF', tone: 'error' });
                    } finally {
                      setDownloadingInvoicePdf(false);
                    }
                  }}
                  className="px-3 py-2 bg-white border border-green-400 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 disabled:opacity-50 whitespace-nowrap"
                >
                  {downloadingInvoicePdf ? 'Downloading…' : '⬇ Download PDF'}
                </button>
                <button
                  disabled={resendingInvoice}
                  onClick={async () => {
                    setResendingInvoice(true);
                    try {
                      const res = await api.post(`/bookings/${booking.id}/resend-invoice`);
                      if (res.data?.success) {
                        setToast({ message: `Invoice ${res.data.invoice_number} re-sent to customer`, tone: 'success' });
                      } else {
                        setToast({ message: res.data?.reason ?? 'No final invoice to resend', tone: 'error' });
                      }
                    } catch (e: any) {
                      setToast({ message: e.response?.data?.message ?? 'Failed to resend invoice', tone: 'error' });
                    } finally {
                      setResendingInvoice(false);
                      refetchInvoice();
                    }
                  }}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {resendingInvoice ? 'Sending…' : '✉ Resend Invoice'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Phase 2: Driver report exception banners ──────────────────── */}

        {/* Case A: driver reached job_done but has NOT submitted a report yet */}
        {booking.operational_status === 'COMPLETED' && !driverExtraReport && (
          <div className="lg:col-span-3 bg-blue-50 border border-blue-300 rounded-xl p-4 flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-blue-900">🚗 Driver Completed — Awaiting Report</p>
              <p className="text-sm text-blue-700 mt-1">
                Driver has reached <strong>job_done</strong>. No execution report has been submitted yet.
                You can still review and fulfil, or wait for the driver to submit their report.
              </p>
            </div>
            <Button variant="primary" onClick={() => { setDriverReport(null); setFulfilOpen(true); }}>
              ✅ Fulfil Anyway
            </Button>
          </div>
        )}

        {/* Case B: driver submitted report WITH extras — action required */}
        {booking.operational_status === 'COMPLETED' && reportPendingReview && reportHasExtras && (
          <div className="lg:col-span-3 bg-amber-50 border border-amber-400 rounded-xl p-4 flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-amber-900">⚠️ Driver Report — Extra Charges Require Review</p>
              <p className="text-sm text-amber-800 mt-1">
                Driver submitted a report with extra charges/waypoints/waiting.
                Review the report before fulfilling to decide whether to add an extra charge.
              </p>
              <div className="mt-2 text-xs text-amber-700 space-y-0.5">
                {driverExtraReport.extra_waypoints?.length > 0 && (
                  <p>📍 Extra stops: {driverExtraReport.extra_waypoints.join(' → ')}</p>
                )}
                {driverExtraReport.waiting_minutes && (
                  <p>⏱ Waiting: {driverExtraReport.waiting_minutes} min</p>
                )}
                {driverExtraReport.extra_toll && (
                  <p>🚗 Toll: {booking.currency} {Number(driverExtraReport.extra_toll).toFixed(2)}</p>
                )}
                {driverExtraReport.extra_parking && (
                  <p>🅿️ Parking: {booking.currency} {Number(driverExtraReport.extra_parking).toFixed(2)}</p>
                )}
                {driverExtraReport.notes && (
                  <p className="italic">"{driverExtraReport.notes}"</p>
                )}
              </div>
            </div>
            <Button variant="primary" onClick={() => { setDriverReport(driverExtraReport); setFulfilOpen(true); }}>
              ⚠️ Review Extras & Fulfil
            </Button>
          </div>
        )}

        {/* Case C: driver submitted report NO extras — standard review */}
        {booking.operational_status === 'COMPLETED' && reportPendingReview && !reportHasExtras && (
          <div className="lg:col-span-3 bg-green-50 border border-green-300 rounded-xl p-4 flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-green-900">📋 Driver Report Submitted — No Extras</p>
              <p className="text-sm text-green-700 mt-1">
                Driver submitted their execution report. No extra charges reported.
                {driverExtraReport.notes && <span className="italic"> Notes: "{driverExtraReport.notes}"</span>}
              </p>
              <p className="text-xs text-green-600 mt-1">
                Submitted by {driverExtraReport.driver_name ?? 'driver'} at {new Date(driverExtraReport.created_at).toLocaleString()}
              </p>
            </div>
            <Button variant="primary" onClick={() => { setDriverReport(driverExtraReport); setFulfilOpen(true); }}>
              ✅ Review & Fulfil
            </Button>
          </div>
        )}

        {/* Case D: driver report already reviewed (post-fulfil) */}
        {['FULFILLED'].includes(booking.operational_status) && driverExtraReport?.status === 'reviewed' && (
          <div className="lg:col-span-3 bg-gray-50 border border-gray-200 rounded-xl p-3">
            <p className="text-sm text-gray-600">
              ✅ <strong>Driver report reviewed</strong> — submitted by {driverExtraReport.driver_name ?? 'driver'}.
              {driverExtraReport.has_extras ? ' Extra charges were reported and handled during fulfilment.' : ' No extras were reported.'}
            </p>
          </div>
        )}
        {/* ─────────────────────────────────────────────────────────────────── */}

        {/* ── Left column ── */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="Booking Info">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
              <InfoRow label="Reference" value={booking.booking_reference} />
              <InfoRow label="Trip Type" value={booking.is_return_trip ? 'Return Trip' : 'One Way'} />
              <InfoRow label="Service Type" value={booking.service_type_name ?? '—'} />
              <InfoRow label="Car Type" value={booking.service_class_name ?? '—'} />
              <InfoRow label="Pickup Time" value={formatPickupTime(booking.pickup_at_utc, booking.timezone, booking.city_name)} />
              {(() => {
                const f = splitFlight(booking.flight_number);
                return f.outbound ? <InfoRow label="Flight" value={f.outbound} /> : null;
              })()}
              {booking.return_pickup_at_utc && (
                <InfoRow label="Return Time" value={formatPickupTime(booking.return_pickup_at_utc, booking.timezone, booking.city_name)} />
              )}
              {(() => {
                const f = splitFlight(booking.flight_number);
                return f.ret ? <InfoRow label="Return Flight" value={f.ret} /> : null;
              })()}
              {(booking.distance_km != null) && (
                <InfoRow label="Distance" value={`${booking.distance_km} km`} />
              )}
              {(booking.duration_minutes != null) && (
                <InfoRow label="Duration" value={`${booking.duration_minutes} min`} />
              )}
            </div>
          </Card>

          <Card title="Route">
            <div className="space-y-2 text-sm text-gray-700">
              <div><span className="text-gray-500">Outbound pickup:</span> {booking.pickup_address_text}</div>
              <div><span className="text-gray-500">Outbound drop-off:</span> {booking.dropoff_address_text}</div>
              {booking.waypoints && booking.waypoints.length > 0 && (
                <div>
                  <div className="text-gray-500 mb-1">Outbound waypoints:</div>
                  <ul className="list-disc pl-5 space-y-1">
                    {booking.waypoints.map((wp: any, idx: number) => (
                      <li key={idx}>{wp?.address ?? wp?.address_text ?? wp}</li>
                    ))}
                  </ul>
                </div>
              )}

              {booking.is_return_trip && (
                <div className="pt-3 border-t border-gray-200/70">
                  <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Return Leg (Leg B)</div>
                  <div>
                    <span className="text-gray-500">Return pickup:</span>{' '}
                    {booking.return_pickup_address_text ?? booking.dropoff_address_text}
                  </div>
                  <div>
                    <span className="text-gray-500">Return drop-off:</span>{' '}
                    {booking.pickup_address_text}
                  </div>
                  {booking.return_distance_km != null && (
                    <div><span className="text-gray-500">Return distance:</span> {booking.return_distance_km} km</div>
                  )}
                  {booking.return_duration_minutes != null && (
                    <div><span className="text-gray-500">Return duration:</span> {booking.return_duration_minutes} min</div>
                  )}
                  {booking.return_waypoints && booking.return_waypoints.length > 0 ? (
                    <div className="mt-2">
                      <div className="text-gray-500 mb-1">Return waypoints:</div>
                      <ul className="list-disc pl-5 space-y-1">
                        {booking.return_waypoints.map((wp: any, idx: number) => (
                          <li key={idx}>{wp?.address ?? wp?.address_text ?? wp}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
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
                  const toMoney = (value: unknown) =>
                    fmt(typeof value === 'number' && Number.isFinite(value) ? value : 0);
                  const leg1 = typeof snap.leg1_minor === 'number' ? snap.leg1_minor : 0;
                  const leg2 = typeof snap.leg2_minor === 'number' ? snap.leg2_minor : null;
                  const hasReturn = typeof leg2 === 'number' && leg2 > 0;
                  const leg1S = typeof snap.leg1_surcharge_minor === 'number' ? snap.leg1_surcharge_minor : 0;
                  const leg2S = typeof snap.leg2_surcharge_minor === 'number' ? snap.leg2_surcharge_minor : 0;
                  const surchargeLabel = snap?.surcharge_items?.[0]?.label || snap?.surcharge_labels?.[0] || 'Surcharge';
                  const toll = typeof snap.toll_minor === 'number' ? snap.toll_minor : 0;
                  const parking = typeof snap.parking_minor === 'number' ? snap.parking_minor : 0;
                  const discountMinor = typeof snap.discount_amount_minor === 'number' ? snap.discount_amount_minor : 0;
                  const discountLabel = snap.discount_name ?? null;
                  const discountGuard = snap.discount_guard ?? null;
                  const total = typeof snap.final_fare_minor === 'number'
                    ? snap.final_fare_minor
                    : booking.total_price_minor ?? 0;
                  const isReturn = booking.trip_mode === 'RETURN';
                  return (
                    <>
                      {leg1 > 0 && <div className="flex justify-between"><span className="text-gray-500">Outbound price</span><span>{fmt(leg1)}</span></div>}
                      {leg1S > 0 && <div className="flex justify-between"><span className="text-gray-500">Outbound {surchargeLabel}</span><span>+{fmt(leg1S)}</span></div>}

                      {hasReturn && (
                        <>
                          {leg2 > 0 && <div className="flex justify-between"><span className="text-gray-500">Return price</span><span>{toMoney(leg2)}</span></div>}
                          {leg2S > 0 && <div className="flex justify-between"><span className="text-gray-500">Return {surchargeLabel}</span><span>+{fmt(leg2S)}</span></div>}
                        </>
                      )}

                      {toll > 0 && <div className="flex justify-between"><span className="text-gray-500">Toll</span><span>+{fmt(toll)}</span></div>}
                      {parking > 0 && <div className="flex justify-between"><span className="text-gray-500">Parking</span><span>+{fmt(parking)}</span></div>}

                      {discountMinor > 0 && (
                        <div className="flex justify-between text-green-600"><span>{discountLabel ?? 'Discount'}</span><span>− {fmt(discountMinor)}</span></div>
                      )}
                      {discountGuard && (
                        <div className="flex justify-between text-xs text-gray-400"><span>Discount Guard</span><span>{String(discountGuard)}</span></div>
                      )}

                      <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                        <span>Total</span>
                        <span>{fmt(total)}</span>
                      </div>
                    </>
                  );
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

          {/* ── Trip Evidence (GPS + SMS + Route + Audit Report) ─────────── */}
          <TripEvidencePanel bookingId={booking.id} tenantId={booking.tenant_id} />

          {/* ── Driver Pay Review (Phase 3 — settlement) ─────────────────── */}
          <DriverPayReviewPanel bookingId={booking.id} tenantId={booking.tenant_id} />

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
                !['CANCELLED', 'COMPLETED', 'FULFILLED', 'JOB_COMPLETED'].includes(booking.operational_status) && (
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

              {/* View Invoice — download PDF if final invoice exists */}
              {['COMPLETED', 'JOB_COMPLETED', 'FULFILLED'].includes(booking.operational_status) && (
                invoiceHasFinal ? (
                  <Button
                    variant="ghost"
                    className="w-full"
                    disabled={downloadingInvoicePdf}
                    onClick={async () => {
                      setDownloadingInvoicePdf(true);
                      try {
                        const res = await api.get(`/bookings/${booking.id}/invoice-pdf`, { responseType: 'blob' });
                        const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `Invoice-${booking.booking_reference ?? booking.id}.pdf`;
                        document.body.appendChild(a); a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      } catch {
                        setToast({ message: 'Failed to download invoice PDF', tone: 'error' });
                      } finally {
                        setDownloadingInvoicePdf(false);
                      }
                    }}
                  >
                    {downloadingInvoicePdf ? 'Downloading…' : '⬇ Download Invoice PDF'}
                  </Button>
                ) : (
                  <ComingSoon>
                    <Button variant="ghost" disabled className="w-full cursor-not-allowed opacity-60">
                      No Invoice Yet
                    </Button>
                  </ComingSoon>
                )
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
        fareMinor={assignLegFareMinor}
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
        fareMinor={assignLegFareMinor}
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

      <ModifyBookingModal
        isOpen={modifyOpen}
        onClose={() => setModifyOpen(false)}
        booking={booking}
        serviceTypes={serviceTypes}
        carTypes={carTypes}
        onModified={({ assignmentId }) => {
          setModifyOpen(false);
          refetch();
          setToast({ message: 'Booking modified', tone: 'success' });
          if (assignmentId) {
            setEditPayAssignmentId(assignmentId);
            setEditPayOpen(true);
          }
        }}
      />

      <FulfilModal
        isOpen={fulfilOpen}
        onClose={() => setFulfilOpen(false)}
        bookingId={booking?.id ?? ''}
        bookingRef={booking?.booking_reference ?? ''}
        originalMinor={booking?.pricing_snapshot?.final_fare_minor ?? booking?.pricing_snapshot?.grand_total_minor ?? booking?.total_price_minor ?? 0}
        currency={booking?.currency ?? 'AUD'}
        leg1Minor={booking?.pricing_snapshot?.leg1_minor}
        leg2Minor={booking?.pricing_snapshot?.leg2_minor}
        multiplierMode={booking?.pricing_snapshot?.multiplier_mode}
        multiplierValue={booking?.pricing_snapshot?.multiplier_value}
        bookingSnapshot={booking}
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

// ── Driver Pay Review Panel ───────────────────────────────────────────────────
// Phase 3 — Driver settlement: admin confirms final driver payable for this booking.
// This sets driver_payout_status=READY_FOR_DRIVER_INVOICE on the assignment,
// allowing the driver to include the job in a driver invoice.
function DriverPayReviewPanel({ bookingId, tenantId }: { bookingId: string; tenantId?: string }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({
    assignment_id: '',
    base_driver_pay_minor: 0,
    extra_waiting_pay_minor: 0,
    extra_waypoint_pay_minor: 0,
    toll_parking_reimburse_minor: 0,
    other_adjustment_minor: 0,
    currency: 'AUD',
    review_notes: '',
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['driver-pay-review', bookingId],
    queryFn: async () => (await api.get(`/bookings/${bookingId}/driver-pay-review`)).data,
    enabled: !!bookingId,
  });

  const { data: bookingDetail } = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: async () => (await api.get(`/bookings/${bookingId}`)).data,
    enabled: !!bookingId,
  });

  const primaryAssignment = bookingDetail?.assignments?.find((a: any) => a.leg === 'A' || !a.leg) ?? bookingDetail?.assignments?.[0];

  useEffect(() => {
    if (primaryAssignment) {
      setForm(f => ({
        ...f,
        assignment_id: primaryAssignment.id ?? '',
        base_driver_pay_minor: primaryAssignment.driver_pay_minor ?? 0,
        toll_parking_reimburse_minor: primaryAssignment.toll_parking_minor ?? 0,
      }));
    }
  }, [primaryAssignment?.id]);

  const mutation = useMutation({
    mutationFn: () => api.post(`/bookings/${bookingId}/driver-pay-review`, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['driver-pay-review', bookingId] });
      setExpanded(false);
    },
  });

  const latestReview = reviews[0];
  const settlementReady = primaryAssignment?.driver_payout_status === 'READY_FOR_DRIVER_INVOICE';
  const alreadySettled = ['INVOICED','PAID_BY_ADMIN','RECEIVED_BY_DRIVER'].includes(primaryAssignment?.driver_payout_status);
  const fmt = (minor: number) => `AUD ${(minor / 100).toFixed(2)}`;
  const total = (form.base_driver_pay_minor + form.extra_waiting_pay_minor +
    form.extra_waypoint_pay_minor + form.toll_parking_reimburse_minor + form.other_adjustment_minor);

  if (!primaryAssignment) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div
        className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <p className="text-sm font-semibold text-gray-900">Driver Pay Review</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {alreadySettled
              ? `✅ Settlement status: ${primaryAssignment.driver_payout_status}`
              : settlementReady
              ? `✅ Ready — ${fmt(latestReview?.total_driver_payable_minor ?? 0)} approved`
              : latestReview
              ? `Reviewed ${fmt(latestReview.total_driver_payable_minor ?? 0)}`
              : `Payout status: ${primaryAssignment.driver_payout_status ?? 'NOT_READY'}`}
          </p>
        </div>
        <span className="text-gray-400 text-sm">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="px-5 py-4 border-t border-gray-100 space-y-4">
          {latestReview && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
              <p className="font-semibold text-green-800">Last review: {fmt(latestReview.total_driver_payable_minor)}</p>
              <p className="text-green-600 text-xs mt-0.5">
                By {latestReview.reviewed_by_name ?? 'admin'} · {new Date(latestReview.reviewed_at).toLocaleString('en-AU')}
              </p>
              {latestReview.review_notes && <p className="text-green-700 text-xs mt-1 italic">"{latestReview.review_notes}"</p>}
            </div>
          )}

          <p className="text-xs text-gray-500">
            Confirm the final driver payable amount. This is the authoritative source for driver invoice line items.
            Driver cannot modify these amounts.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {[
              { k: 'base_driver_pay_minor',          l: 'Base Driver Pay' },
              { k: 'extra_waiting_pay_minor',         l: 'Extra Waiting Pay' },
              { k: 'extra_waypoint_pay_minor',        l: 'Extra Waypoint Pay' },
              { k: 'toll_parking_reimburse_minor',    l: 'Toll/Parking Reimburse' },
              { k: 'other_adjustment_minor',          l: 'Other Adjustment' },
            ].map(({ k, l }) => (
              <div key={k}>
                <label className="block text-xs text-gray-500 mb-1">{l} (cents)</label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-2 py-1.5 text-sm"
                  value={(form as any)[k]}
                  onChange={e => setForm(f => ({ ...f, [k]: parseInt(e.target.value) || 0 }))}
                />
              </div>
            ))}
          </div>

          <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
            <span className="text-sm text-gray-600 font-medium">Total Driver Payable</span>
            <span className="text-base font-bold text-gray-900">{fmt(total)}</span>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Review notes (optional)</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.review_notes}
              onChange={e => setForm(f => ({ ...f, review_notes: e.target.value }))}
              placeholder="e.g. Extra stop approved, standard toll rate applied"
            />
          </div>

          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.assignment_id || alreadySettled}
            className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving…' : '✅ Confirm Driver Pay — Set READY_FOR_DRIVER_INVOICE'}
          </button>

          {alreadySettled && (
            <p className="text-xs text-gray-400 text-center">
              Settlement is in {primaryAssignment.driver_payout_status} — no further review needed.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

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
