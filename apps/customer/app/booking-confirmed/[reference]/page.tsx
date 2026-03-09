'use client';

/**
 * /booking-confirmed/[reference]
 *
 * NOTE: This page is currently a dead route — no production flow navigates here.
 * Payment success is handled inline by PayPageClient.tsx (SuccessScreen component).
 *
 * If this route is activated in future, the BookingConfirmedClient below will:
 * - Fetch the booking from the backend when authenticated (verifies real state)
 * - Fall back to static reference display when unauthenticated (e.g. guest post-pay)
 *
 * DO NOT remove this page until the navigation redirect is confirmed removed
 * from all entry points.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';

type BookingState =
  | { phase: 'loading' }
  | { phase: 'verified'; reference: string; status: string }
  | { phase: 'static'; reference: string };   // unauthenticated or fetch failed

export default function BookingConfirmedPage() {
  const params = useParams<{ reference: string }>();
  const reference = params?.reference ?? '';
  const [state, setState] = useState<BookingState>({ phase: 'loading' });

  useEffect(() => {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('customer_token')
        : null;

    if (!token) {
      setState({ phase: 'static', reference });
      return;
    }

    // Try to find the booking by reference in the bookings list
    api
      .get('/customer-portal/bookings', { params: { limit: 50 } })
      .then((r) => {
        const list: any[] = Array.isArray(r.data) ? r.data : (r.data?.bookings ?? []);
        const match = list.find(
          (b) =>
            b.booking_reference === reference ||
            b.reference === reference,
        );
        if (match) {
          setState({ phase: 'verified', reference, status: match.payment_status ?? match.status ?? '' });
        } else {
          setState({ phase: 'static', reference });
        }
      })
      .catch(() => setState({ phase: 'static', reference }));
  }, [reference]);

  if (state.phase === 'loading') {
    return (
      <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isPaid =
    state.phase === 'verified' && ['PAID', 'AUTHORIZED'].includes(state.status);
  const showWarning = state.phase === 'verified' && !isPaid;

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center px-4">
      <div
        className="max-w-sm w-full rounded-2xl p-8 text-center"
        style={{ backgroundColor: 'hsl(var(--card))' }}
      >
        {/* Icon */}
        <div className="mb-4 flex justify-center">
          {showWarning ? (
            <svg className="h-14 w-14 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
            </svg>
          ) : (
            <svg className="h-14 w-14 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>

        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))] mb-2">
          {showWarning ? 'Payment Pending' : 'Booking Confirmed!'}
        </h1>
        <p className="text-[hsl(var(--muted-foreground))] text-sm mb-4">
          Reference:{' '}
          <span className="font-mono font-medium text-[hsl(var(--foreground))]">
            {reference}
          </span>
        </p>

        {state.phase === 'verified' && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2">
            Payment status:{' '}
            <span className="font-semibold">{state.status || '—'}</span>
          </p>
        )}

        <p className="text-[hsl(var(--muted-foreground))] text-sm mb-6">
          {showWarning
            ? 'Your payment is still processing. Please check your bookings for the latest status.'
            : "You'll receive a confirmation email shortly. Your driver will be assigned closer to pickup time."}
        </p>

        <Link
          href="/dashboard"
          className="block w-full py-3 rounded-xl font-medium text-sm"
          style={{ backgroundColor: 'hsl(var(--primary))', color: '#000' }}
        >
          Back to Dashboard
        </Link>
        {showWarning && (
          <Link
            href="/bookings"
            className="block w-full py-3 mt-2 rounded-xl font-medium text-sm border border-[hsl(var(--border))] text-[hsl(var(--foreground))]"
          >
            View My Bookings
          </Link>
        )}
      </div>
    </div>
  );
}
