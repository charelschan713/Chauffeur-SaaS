'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { cn, fmtMoney } from '@/lib/utils';
import { ArrowLeft, MapPin, CalendarDays, Car, User, Phone, AlertCircle, CheckCircle2, Clock, XCircle, Download } from 'lucide-react';
import { BackButton } from '@/components/BackButton';
import { getOpStatusBadge, DRIVER_STATUS_LABELS } from '@/lib/booking-status';
import { useState } from 'react';

function fmtDate(utc?: string, tz = 'Australia/Sydney') {
  if (!utc) return '—';
  return new Date(utc).toLocaleString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: tz,
  });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">{title}</p>
      </div>
      <div className="px-4 py-4 space-y-3">{children}</div>
    </div>
  );
}

function Row({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-[hsl(var(--muted-foreground))] shrink-0">{label}</span>
      <span className={cn('text-sm text-right text-[hsl(var(--foreground))] font-medium', valueClass)}>{value}</span>
    </div>
  );
}

export function BookingDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => api.get(`/customer-portal/bookings/${id}`).then(r => r.data),
  });

  const cancelMut = useMutation({
    mutationFn: () => api.post(`/customer-portal/bookings/${id}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['booking', id] }),
  });

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gray-100 border-t-[hsl(var(--primary))] rounded-full animate-spin" />
    </div>
  );

  if (!booking) return (
    <div className="min-h-screen flex items-center justify-center text-[hsl(var(--muted-foreground))]">Booking not found</div>
  );

  const opStatus    = getOpStatusBadge(booking.operational_status ?? booking.status ?? '');
  const driverStatus = DRIVER_STATUS_LABELS[booking.driver_execution_status] ?? null;

  const canCancel = ['PENDING_CUSTOMER_CONFIRMATION', 'AWAITING_CONFIRMATION', 'CONFIRMED'].includes(
    booking.operational_status ?? booking.status
  );

  // Invoice PDF download — only show for FULFILLED/COMPLETED bookings
  const invoiceStates = ['FULFILLED', 'COMPLETED'];
  const showInvoice = invoiceStates.includes(booking.operational_status ?? booking.status ?? '');

  const [invoiceChecked, setInvoiceChecked] = useState(false);
  const [invoiceAvailable, setInvoiceAvailable] = useState<boolean | null>(null);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

  // Probe once whether an invoice exists (HEAD-like: we use a small signal via error handling)
  const checkInvoice = async () => {
    if (invoiceChecked) return invoiceAvailable;
    try {
      // A 404 means no invoice; 200 means available
      await api.head(`/customer-portal/bookings/${id}/invoice-pdf`).catch(() =>
        api.get(`/customer-portal/bookings/${id}/invoice-pdf`, { responseType: 'blob' })
      );
      setInvoiceAvailable(true);
    } catch {
      setInvoiceAvailable(false);
    }
    setInvoiceChecked(true);
    return invoiceAvailable;
  };

  const handleDownloadInvoice = async () => {
    setDownloadingInvoice(true);
    try {
      const resp = await api.get(`/customer-portal/bookings/${id}/invoice-pdf`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${booking.booking_reference ?? id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setInvoiceAvailable(true);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setInvoiceAvailable(false);
        alert('Final invoice is not yet available for this booking.');
      }
    } finally {
      setDownloadingInvoice(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-20 border-b border-gray-100 px-4 flex items-center gap-3"
        style={{
          background: 'hsl(var(--background))',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          paddingTop: 'max(12px, env(safe-area-inset-top))',
          paddingBottom: 12,
        }}
      >
        <BackButton fallback="/bookings" />
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-white">Booking Detail</h1>
          <p className="text-xs font-mono text-[hsl(var(--muted-foreground))]">{booking.booking_reference}</p>
        </div>
        <div className={cn('flex items-center gap-1.5 text-sm font-medium', opStatus.color)}>
          <span>{opStatus.label}</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-5 space-y-4">

        {/* Status banners */}
        {(booking.operational_status ?? booking.status) === 'PAYMENT_FAILED' && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Payment failed. Please contact us.
          </div>
        )}
        {(booking.operational_status ?? booking.status) === 'PENDING_CUSTOMER_CONFIRMATION' && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-300">
            <Clock className="h-4 w-4 shrink-0" />
            Awaiting confirmation. Your card will be charged once confirmed.
          </div>
        )}

        {/* Driver status (live) */}
        {driverStatus && !['COMPLETED', 'FULFILLED', 'CANCELLED'].includes(booking.operational_status ?? booking.status) && (
          <div className="rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] px-4 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[hsl(var(--primary)/0.15)] border border-[hsl(var(--primary)/0.25)] flex items-center justify-center">
              <Car className="h-5 w-5 text-[hsl(var(--primary))]" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-[hsl(var(--muted-foreground))] font-medium uppercase tracking-wide mb-0.5">Driver Status</p>
              <p className={cn('text-sm font-semibold', driverStatus.color)}>{driverStatus.label}</p>
              {booking.driver_name && (
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{booking.driver_name}</p>
              )}
            </div>
            {booking.driver_phone && (
              <a href={`tel:${booking.driver_phone}`}
                className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                <Phone className="h-4 w-4 text-emerald-400" />
              </a>
            )}
          </div>
        )}

        {/* Trip details */}
        <Section title="Trip Details">
          <div className="space-y-2">
            <div className="flex items-start gap-2.5 text-sm text-[hsl(var(--muted-foreground))]">
              <CalendarDays className="h-4 w-4 mt-0.5 text-[hsl(var(--primary)/0.7)] shrink-0" />
              <span>{fmtDate(booking.pickup_at_utc, booking.timezone)}</span>
            </div>
            <div className="relative pl-6 space-y-3 mt-2">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[hsl(var(--card))]" />
              <div className="relative flex items-start gap-2">
                <div className="absolute -left-6 mt-1 w-3 h-3 rounded-full bg-emerald-500/80 shrink-0" />
                <div>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-widest mb-0.5">Pickup</p>
                  <p className="text-sm text-[hsl(var(--foreground))]">{booking.pickup_address_text ?? booking.pickup_address ?? '—'}</p>
                </div>
              </div>
              {(booking.dropoff_address_text ?? booking.dropoff_address) && (
                <div className="relative flex items-start gap-2">
                  <div className="absolute -left-6 mt-1 w-3 h-3 rounded-full bg-[hsl(var(--primary)/0.8)] shrink-0" />
                  <div>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-widest mb-0.5">Drop-off</p>
                    <p className="text-sm text-[hsl(var(--foreground))]">{booking.dropoff_address_text ?? booking.dropoff_address}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          {booking.flight_number && <Row label="Flight" value={booking.flight_number} />}
          {booking.passenger_count && <Row label="Passengers" value={`${booking.passenger_count} pax`} />}
          {booking.special_requests && <Row label="Notes" value={booking.special_requests} />}
        </Section>

        {/* Passenger */}
        <Section title="Lead Passenger">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[hsl(var(--primary)/0.15)] flex items-center justify-center">
              <User className="h-4 w-4 text-[hsl(var(--primary))]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                {booking.passenger_first_name} {booking.passenger_last_name}
              </p>
              {booking.passenger_phone_number && (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{booking.passenger_phone_country_code} {booking.passenger_phone_number}</p>
              )}
            </div>
          </div>
        </Section>

        {/* Pricing */}
        <Section title="Pricing">
          <Row label="Total" value={fmtMoney(booking.total_price_minor, booking.currency ?? 'AUD')} valueClass="text-[hsl(var(--primary))] text-base" />
          <Row label="Payment" value={booking.payment_status ?? '—'} />
        </Section>

        {/* Download Final Invoice — shown only for FULFILLED/COMPLETED bookings */}
        {showInvoice && invoiceAvailable !== false && (
          <div className="pt-1">
            <button
              onClick={handleDownloadInvoice}
              disabled={downloadingInvoice}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-[hsl(var(--primary)/0.4)] text-[hsl(var(--primary))] text-sm font-medium hover:bg-[hsl(var(--primary)/0.06)] transition-all disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {downloadingInvoice ? 'Preparing…' : 'Download Final Invoice'}
            </button>
          </div>
        )}

        {/* Cancel */}
        {canCancel && (
          <div className="pt-2">
            <button
              onClick={() => {
                if (!confirm('Cancel this booking?')) return;
                cancelMut.mutate();
              }}
              disabled={cancelMut.isPending}
              className="w-full py-3 rounded-xl border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/8 transition-all disabled:opacity-50">
              {cancelMut.isPending ? 'Cancelling…' : 'Cancel Booking'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
