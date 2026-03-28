'use client';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { cn, fmtMoney } from '@/lib/utils';
import { CalendarDays, Car, User, Phone, AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { BackButton } from '@/components/BackButton';

// Operational status — backend real values (UPPERCASE, stored in bookings.operational_status)
const OP_STATUS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING_CUSTOMER_CONFIRMATION: { label: 'Pending Confirmation', color: 'text-amber-400',  icon: <Clock className="h-4 w-4" /> },
  AWAITING_CONFIRMATION:         { label: 'Awaiting Confirmation',color: 'text-amber-400',  icon: <Clock className="h-4 w-4" /> },
  CONFIRMED:                     { label: 'Confirmed',            color: 'text-emerald-400',icon: <CheckCircle2 className="h-4 w-4" /> },
  COMPLETED:                     { label: 'Completed',            color: 'text-[hsl(var(--muted-foreground))]', icon: <CheckCircle2 className="h-4 w-4" /> },
  FULFILLED:                     { label: 'Fulfilled',            color: 'text-[hsl(var(--muted-foreground))]', icon: <CheckCircle2 className="h-4 w-4" /> },
  CANCELLED:                     { label: 'Cancelled',            color: 'text-red-400',    icon: <XCircle className="h-4 w-4" /> },
  PAYMENT_FAILED:                { label: 'Payment Failed',       color: 'text-red-400',    icon: <AlertCircle className="h-4 w-4" /> },
};

// Driver execution status — backend real values (lowercase, stored in assignments.driver_execution_status)
const DRIVER_STATUS: Record<string, { label: string; color: string }> = {
  assigned:           { label: 'Driver Assigned',      color: 'text-blue-400' },
  accepted:           { label: 'Driver Accepted',      color: 'text-blue-400' },
  on_the_way:         { label: 'Driver En Route',      color: 'text-blue-400' },
  arrived:            { label: 'Driver Arrived',       color: 'text-amber-400' },
  passenger_on_board: { label: 'Passenger On Board',   color: 'text-blue-400' },
  job_done:           { label: 'Job Done',             color: 'text-emerald-400' },
};

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
  const { data: assignment, isLoading } = useQuery({
    queryKey: ['assignment', id],
    queryFn: () => api.get(`/driver-app/assignments/${id}`).then(r => r.data),
  });

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gray-100 border-t-[hsl(var(--primary))] rounded-full animate-spin" />
    </div>
  );

  if (!assignment) return (
    <div className="min-h-screen flex items-center justify-center text-[hsl(var(--muted-foreground))]">Booking not found</div>
  );

  const booking = assignment.booking ?? {};

  const opStatus = OP_STATUS[booking.operational_status ?? booking.status] ?? {
    label: booking.operational_status ?? booking.status, color: 'text-[hsl(var(--muted-foreground))]', icon: null,
  };
  const driverStatus = DRIVER_STATUS[assignment.driver_execution_status] ?? null;

  return (
    <div className="min-h-screen" style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-20 border-b border-[hsl(var(--border))] px-4 flex items-center gap-3"
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
          <p className="text-xs font-mono text-[hsl(var(--muted-foreground))]">{booking.booking_reference ?? booking.booking_number ?? '—'}</p>
        </div>
        <div className={cn('flex items-center gap-1.5 text-sm font-medium', opStatus.color)}>
          {opStatus.icon}
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
              {assignment.driver_name && (
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{assignment.driver_name}</p>
              )}
            </div>
            {assignment.driver_phone && (
              <a href={`tel:${assignment.driver_phone}`}
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
              <span>{fmtDate(booking.pickup_at_utc ?? booking.pickup_at, booking.timezone)}</span>
            </div>
            <div className="relative pl-6 space-y-3 mt-2">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[hsl(var(--card))]" />
              <div className="relative flex items-start gap-2">
                <div className="absolute -left-6 mt-1 w-3 h-3 rounded-full bg-emerald-500/80 shrink-0" />
                <div>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-widest mb-0.5">Pickup</p>
                  <p className="text-sm text-[hsl(var(--foreground))]">{booking.pickup_address_text ?? booking.pickup_address ?? booking.pickup_location ?? '—'}</p>
                </div>
              </div>
              {(booking.dropoff_address_text ?? booking.dropoff_address ?? booking.dropoff_location) && (
                <div className="relative flex items-start gap-2">
                  <div className="absolute -left-6 mt-1 w-3 h-3 rounded-full bg-[hsl(var(--primary)/0.8)] shrink-0" />
                  <div>
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-widest mb-0.5">Drop-off</p>
                    <p className="text-sm text-[hsl(var(--foreground))]">{booking.dropoff_address_text ?? booking.dropoff_address ?? booking.dropoff_location}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          {(() => {
            if (!booking.flight_number) return null;
            const raw = String(booking.flight_number);
            const parts = raw.split(' / Return ');
            const outbound = parts.length > 1 ? parts[0].trim() : (/^Return\s+/i.test(raw) ? '' : raw.trim());
            const ret = parts.length > 1 ? parts.slice(1).join(' / Return ').trim() : (/^Return\s+/i.test(raw) ? raw.replace(/^Return\s+/i, '').trim() : '');
            return (
              <>
                {outbound && <Row label="Flight" value={outbound} />}
                {ret && <Row label="Return Flight" value={ret} />}
              </>
            );
          })()}
          {booking.passenger_count && <Row label="Passengers" value={`${booking.passenger_count} pax`} />}
          {(() => {
            const snap = booking.pricing_snapshot as any;
            const bookedHours = typeof snap?.booked_hours === 'number' && Number.isFinite(snap.booked_hours) ? snap.booked_hours : null;
            const includedKm = typeof snap?.hourly_included_km === 'number' && Number.isFinite(snap.hourly_included_km) ? snap.hourly_included_km : null;
            const hourlyChargeMinor = typeof snap?.hourly_charge_minor === 'number' && Number.isFinite(snap.hourly_charge_minor)
              ? snap.hourly_charge_minor
              : 0;
            const isHourly = hourlyChargeMinor > 0 || (bookedHours != null && bookedHours > 0);
            if (!isHourly) return null;
            return (
              <>
                {bookedHours != null && <Row label="Duration" value={`${bookedHours} hours`} />}
                {includedKm != null && <Row label="Included distance" value={`${includedKm} km`} />}
                {hourlyChargeMinor > 0 && <Row label="Total hourly charge" value={`${(hourlyChargeMinor / 100).toFixed(2)} ${booking.currency ?? 'AUD'}`} />}
              </>
            );
          })()}
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
          {booking.total_price_minor && (
            <Row label="Total" value={fmtMoney(booking.total_price_minor, booking.currency ?? 'AUD')} valueClass="text-[hsl(var(--primary))] text-base" />
          )}
          {booking.payment_status && <Row label="Payment" value={booking.payment_status} />}
        </Section>
      </div>
    </div>
  );
}
