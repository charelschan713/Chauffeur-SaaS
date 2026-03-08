'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import api from '@/lib/api';

const FALLBACK_PK = 'pk_test_51PuUzlB3pdczuXMq89dEizofOSKDjaMOiJmnn8PXHvqA9pLrNeFRXqdzImtLUC07r1JYOYT581R33wr7sEosE3j100Z67sRtjn';
const envPk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = loadStripe(
  envPk && !envPk.includes('placeholder') ? envPk : FALLBACK_PK,
);

// ── Saved card pay form ───────────────────────────────────────────────────────
function SavedCardForm({ token, card, amount, currency }: {
  token: string;
  card: { stripe_payment_method_id: string; last4: string; brand: string; exp_month: number; exp_year: number };
  amount: number;
  currency: string;
}) {
  const stripe = useStripe();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [useNew, setUseNew] = useState(false);

  if (useNew) return <NewCardForm token={token} amount={amount} currency={currency} />;

  const pay = async () => {
    if (!stripe) return;
    setLoading(true); setErrorMsg(''); setResult(null);
    try {
      const { data } = await api.post(`/customer-portal/payments/token/${token}/pay`, {
        paymentMethodId: card.stripe_payment_method_id,
      });
      if (data.status === 'succeeded' || data.success) { setResult('success'); return; }
      if (data.status === 'requires_action' && data.clientSecret) {
        const { paymentIntent, error: actionErr } = await stripe.handleNextAction({ clientSecret: data.clientSecret });
        if (actionErr) throw actionErr;
        if (paymentIntent?.status === 'succeeded') {
          await api.post(`/customer-portal/payments/token/${token}/confirm-3ds`, { paymentIntentId: paymentIntent.id }).catch(() => {});
          setResult('success'); return;
        }
        throw new Error('3DS authentication did not complete');
      }
      throw new Error(data.message ?? 'Payment failed');
    } catch (err: any) {
      setErrorMsg(err.message ?? 'Payment failed. Please try again.');
      setResult('error');
    } finally { setLoading(false); }
  };

  if (result === 'success') return <SuccessScreen />;

  const brandIcon: Record<string, string> = { visa: '💳', mastercard: '💳', amex: '💳' };
  const brandLabel = card.brand.charAt(0).toUpperCase() + card.brand.slice(1);

  return (
    <div className="space-y-4">
      {/* Saved card display */}
      <div className="rounded-xl border border-[#c8a96b]/30 bg-[#1a1d24] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-14 items-center justify-center rounded-lg bg-[#0d0f14] text-2xl">
            {brandIcon[card.brand] ?? '💳'}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{brandLabel} •••• {card.last4}</p>
            <p className="text-xs text-gray-400">Expires {String(card.exp_month).padStart(2, '0')}/{card.exp_year}</p>
          </div>
          <span className="ml-auto rounded-full bg-[#c8a96b]/10 px-2.5 py-0.5 text-[10px] font-semibold text-[#c8a96b] uppercase tracking-wide">
            Saved
          </span>
        </div>
      </div>

      {result === 'error' && (
        <div className="rounded-lg border border-red-500/30 bg-red-900/20 p-3 text-sm text-red-400">{errorMsg}</div>
      )}

      <button
        onClick={pay}
        disabled={loading}
        className="w-full rounded-xl bg-[#c8a96b] py-3.5 text-sm font-bold text-[#0d0f14] transition hover:bg-[#d4b87a] disabled:opacity-50"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Processing…
          </span>
        ) : `Pay ${currency} ${(amount / 100).toFixed(2)}`}
      </button>

      <button
        onClick={() => setUseNew(true)}
        className="w-full text-center text-xs text-gray-500 hover:text-[#c8a96b] transition"
      >
        Use a different card →
      </button>
    </div>
  );
}

// ── New card form ─────────────────────────────────────────────────────────────
function NewCardForm({ token, amount, currency }: { token: string; amount: number; currency: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [cardName, setCardName] = useState('');

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    if (!cardName.trim()) { setErrorMsg('Please enter the name on your card.'); setResult('error'); return; }
    setLoading(true); setErrorMsg(''); setResult(null);
    try {
      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: elements.getElement(CardElement)!,
        billing_details: { name: cardName.trim() },
      });
      if (pmError) throw pmError;
      const { data } = await api.post(`/customer-portal/payments/token/${token}/pay`, {
        paymentMethodId: paymentMethod!.id,
      });
      if (data.status === 'succeeded' || data.success) { setResult('success'); return; }
      if (data.status === 'requires_action' && data.clientSecret) {
        const { paymentIntent, error: actionErr } = await stripe.handleNextAction({ clientSecret: data.clientSecret });
        if (actionErr) throw actionErr;
        if (paymentIntent?.status === 'succeeded') {
          await api.post(`/customer-portal/payments/token/${token}/confirm-3ds`, { paymentIntentId: paymentIntent.id }).catch(() => {});
          setResult('success'); return;
        }
        throw new Error('3DS authentication did not complete');
      }
      if (data.success) { setResult('success'); return; }
      throw new Error(data.message ?? 'Payment failed');
    } catch (err: any) {
      setErrorMsg(err.message ?? 'Payment failed. Please try again.');
      setResult('error');
    } finally { setLoading(false); }
  };

  if (result === 'success') return <SuccessScreen />;

  return (
    <form onSubmit={pay} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-400">Name on Card</label>
        <input
          value={cardName}
          onChange={e => setCardName(e.target.value)}
          placeholder="As it appears on your card"
          autoComplete="cc-name"
          className="w-full rounded-lg border border-[#2a2d35] bg-[#1a1d24] px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:border-[#c8a96b]/50 focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-400">Card Details</label>
        <div className="rounded-lg border border-[#2a2d35] bg-[#1a1d24] p-3">
          <CardElement options={{
            hidePostalCode: true,
            style: {
              base: { fontSize: '15px', color: '#ffffff', '::placeholder': { color: '#6b7280' } },
              invalid: { color: '#ef4444' },
            },
          }} />
        </div>
      </div>
      {result === 'error' && (
        <div className="rounded-lg border border-red-500/30 bg-red-900/20 p-3 text-sm text-red-400">{errorMsg}</div>
      )}
      <div className="flex items-center gap-2 rounded-lg border border-[#2a2d35] bg-[#1a1d24] p-3 text-xs text-gray-500">
        🔒 Secured by Stripe. Card details are encrypted and never stored on our servers.
      </div>
      <button
        type="submit"
        disabled={loading || !stripe}
        className="w-full rounded-xl bg-[#c8a96b] py-3.5 text-sm font-bold text-[#0d0f14] transition hover:bg-[#d4b87a] disabled:opacity-50"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Processing…
          </span>
        ) : `Pay ${currency} ${(amount / 100).toFixed(2)}`}
      </button>
    </form>
  );
}

// ── Success screen ────────────────────────────────────────────────────────────
function SuccessScreen() {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
        <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-white">Payment Successful</h2>
      <p className="mt-2 text-sm text-gray-400">Your booking is now confirmed. You'll receive a confirmation email shortly.</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function PayPageClient({ token }: { token: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['pay-token', token],
    queryFn: () => api.get(`/customer-portal/payments/token/${token}`).then(r => r.data),
    retry: false,
  });

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0f14]">
      <div className="animate-spin h-8 w-8 border-4 border-[#c8a96b] border-t-transparent rounded-full" />
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0f14]">
      <div className="text-center px-6">
        <div className="mb-3 text-4xl">⏰</div>
        <h2 className="text-lg font-semibold text-white">Link not found or expired</h2>
        <p className="mt-2 text-sm text-gray-400">This payment link may have expired. Please contact us for assistance.</p>
        <a
          href="/dashboard"
          className="mt-6 inline-block px-6 py-3 rounded-xl bg-[#c8a96b] text-black text-sm font-semibold hover:bg-[#b8995b] transition-colors"
        >
          Back to Home
        </a>
      </div>
    </div>
  );

  if (data.payment_status === 'PAID') return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0f14]">
      <div className="text-center px-6">
        <div className="mb-4 flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-emerald-500/10">
          <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white">Already Paid</h2>
        <p className="mt-2 text-sm text-gray-400">This booking has been paid in full. Thank you!</p>
        <div className="mt-6 flex flex-col gap-3">
          <a
            href="/dashboard"
            className="inline-block px-6 py-3 rounded-xl bg-[#c8a96b] text-black text-sm font-semibold hover:bg-[#b8995b] transition-colors"
          >
            Go to Dashboard
          </a>
          <a
            href="/bookings"
            className="inline-block px-6 py-3 rounded-xl border border-[#c8a96b]/40 text-[#c8a96b] text-sm font-medium hover:bg-[#c8a96b]/10 transition-colors"
          >
            View My Bookings
          </a>
        </div>
      </div>
    </div>
  );

  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Australia/Sydney' }); }
    catch { return iso; }
  };

  return (
    <div className="min-h-screen bg-[#0d0f14] px-4 py-10">
      <div className="mx-auto max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[3px] text-[#c8a96b]">AS Chauffeured</p>
          <h1 className="mt-2 text-2xl font-bold text-white">Complete Your Booking</h1>
          <p className="mt-1 text-sm text-gray-400">Review your trip details and complete payment below.</p>
        </div>

        {/* Booking summary */}
        <div className="mb-6 rounded-2xl border border-[#2a2d35] bg-[#111318] p-5 space-y-3">
          {/* Reference */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Reference</span>
            <span className="text-sm font-bold text-[#c8a96b]">{data.booking_reference}</span>
          </div>

          {/* Route */}
          <div className="border-t border-[#2a2d35] pt-3 space-y-2">
            <div className="flex gap-3">
              <span className="mt-0.5 text-[#c8a96b]">📍</span>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Pickup</p>
                <p className="text-sm text-white">{data.pickup_address}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="mt-0.5 text-[#c8a96b]">🏁</span>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Dropoff</p>
                <p className="text-sm text-white">{data.dropoff_address}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="mt-0.5 text-[#c8a96b]">🕐</span>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Date & Time</p>
                <p className="text-sm text-white">{data.pickup_time_local ?? fmtDate(data.pickup_at_utc)}</p>
              </div>
            </div>
            {data.is_return_trip && data.return_pickup_at_utc && (
              <div className="flex gap-3">
                <span className="mt-0.5 text-[#c8a96b]">🔄</span>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Return Time</p>
                  <p className="text-sm text-white">{data.return_time_local ?? fmtDate(data.return_pickup_at_utc)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Vehicle & Pax */}
          <div className="border-t border-[#2a2d35] pt-3 grid grid-cols-3 gap-2">
            {data.car_type_name && (
              <div className="col-span-3 flex gap-3">
                <span className="text-[#c8a96b]">🚘</span>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Vehicle</p>
                  <p className="text-sm text-white">{data.car_type_name}</p>
                </div>
              </div>
            )}
            <div className="flex gap-2 items-center">
              <span className="text-gray-400 text-sm">👤</span>
              <div>
                <p className="text-[10px] text-gray-500">Passengers</p>
                <p className="text-sm text-white">{data.passenger_count ?? '—'}</p>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-gray-400 text-sm">🧳</span>
              <div>
                <p className="text-[10px] text-gray-500">Luggage</p>
                <p className="text-sm text-white">{data.luggage_count ?? '—'}</p>
              </div>
            </div>
          </div>

          {/* Pricing breakdown */}
          <div className="border-t border-[#2a2d35] pt-3 space-y-1.5">
            {data.prepay_base_fare_minor > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Base Fare</span>
                <span className="text-white">{data.currency} {(data.prepay_base_fare_minor / 100).toFixed(2)}</span>
              </div>
            )}
            {(data.prepay_toll_minor > 0 || data.prepay_parking_minor > 0) && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Toll / Parking</span>
                <span className="text-white">{data.currency} {((data.prepay_toll_minor + data.prepay_parking_minor) / 100).toFixed(2)}</span>
              </div>
            )}
            {data.discount_total_minor > 0 && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Original Price</span>
                  <span className="text-gray-500 line-through">{data.currency} {((data.total_price_minor + data.discount_total_minor) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-green-400">Discount</span>
                  <span className="text-green-400">− {data.currency} {(data.discount_total_minor / 100).toFixed(2)}</span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between border-t border-[#2a2d35] pt-2 mt-1">
              <span className="text-sm text-gray-400">Total</span>
              <span className="text-lg font-bold text-white">{data.currency} {(data.total_price_minor / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment section */}
        <div className="rounded-2xl border border-[#2a2d35] bg-[#111318] p-5">
          <h2 className="mb-4 text-sm font-semibold text-white">
            {data.saved_card ? 'Pay with Saved Card' : 'Enter Card Details'}
          </h2>
          <Elements stripe={stripePromise}>
            {data.saved_card ? (
              <SavedCardForm
                token={token}
                card={data.saved_card}
                amount={data.total_price_minor}
                currency={data.currency}
              />
            ) : (
              <NewCardForm
                token={token}
                amount={data.total_price_minor}
                currency={data.currency}
              />
            )}
          </Elements>
        </div>
      </div>
    </div>
  );
}
