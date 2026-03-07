'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import api from '@/lib/api';

// Hardcoded PK as reliable fallback (publishable key is safe to expose)
const FALLBACK_PK = 'pk_test_51PuUzlB3pdczuXMq89dEizofOSKDjaMOiJmnn8PXHvqA9pLrNeFRXqdzImtLUC07r1JYOYT581R33wr7sEosE3j100Z67sRtjn';
const envPk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = loadStripe(
  envPk && !envPk.includes('placeholder') ? envPk : FALLBACK_PK
);

function PayForm({ token, amount, currency }: { token: string; amount: number; currency: string }) {
  const stripe    = useStripe();
  const elements  = useElements();
  const [loading,    setLoading]    = useState(false);
  const [result,     setResult]     = useState<'success' | 'error' | null>(null);
  const [errorMsg,   setErrorMsg]   = useState('');
  const [cardName,   setCardName]   = useState('');

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    if (!cardName.trim()) { setErrorMsg('Please enter the name on your card.'); setResult('error'); return; }
    setLoading(true);
    setErrorMsg('');
    setResult(null);

    try {
      // Step 1: create PaymentMethod from card element
      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: elements.getElement(CardElement)!,
        billing_details: { name: cardName.trim() },
      });
      if (pmError) throw pmError;

      // Step 2: call backend to create PaymentIntent + confirm
      const { data } = await api.post(`/customer-portal/payments/token/${token}/pay`, {
        paymentMethodId: paymentMethod!.id,
      });

      if (data.status === 'succeeded') {
        setResult('success');
        return;
      }

      // Step 3: 3DS required — handleNextAction opens the challenge modal
      if (data.status === 'requires_action' && data.clientSecret) {
        const returnUrl = `${window.location.origin}/pay/${token}?3ds=true`;
        const { paymentIntent, error: actionErr } = await stripe.handleNextAction({
          clientSecret: data.clientSecret,
        });
        if (actionErr) throw actionErr;
        if (paymentIntent?.status === 'succeeded') {
          // Notify backend payment succeeded after 3DS
          await api.post(`/customer-portal/payments/token/${token}/confirm-3ds`, {
            paymentIntentId: paymentIntent.id,
          }).catch(() => {});
          setResult('success');
          return;
        }
        throw new Error('3DS authentication did not complete');
      }

      if (data.success) { setResult('success'); return; }
      throw new Error(data.message ?? 'Payment failed');

    } catch (err: any) {
      setErrorMsg(err.message ?? 'Payment failed. Please try again.');
      setResult('error');
    } finally {
      setLoading(false);
    }
  };

  if (result === 'success') {
    return (
      <div className="text-center py-8">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900">Payment successful!</h2>
        <p className="text-gray-500 mt-2">Your booking is confirmed.</p>
      </div>
    );
  }

  return (
    <form onSubmit={pay} className="space-y-4">
      {result === 'error' && (
        <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3 border border-red-200">
          {errorMsg}
        </div>
      )}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Name on Card</label>
        <input
          value={cardName}
          onChange={e => setCardName(e.target.value)}
          placeholder="As it appears on your card"
          required
          autoComplete="cc-name"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-700">Card Details</label>
        <div className="border border-gray-300 rounded-lg p-3 bg-white">
          <CardElement options={{
            style: {
              base: { fontSize: '15px', color: '#1a1a2e', '::placeholder': { color: '#9ca3af' } },
              invalid: { color: '#ef4444' },
            },
          }} />
        </div>
      </div>
      <div className="flex items-start gap-2 p-3 rounded-lg bg-gray-50 text-xs text-gray-500 border border-gray-100">
        🔒 Secured by Stripe. Your card details are encrypted and never stored on our servers.
        Your bank may prompt for 3D Secure verification.
      </div>
      <button
        type="submit"
        disabled={loading || !stripe}
        className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Processing…
          </span>
        ) : `Pay ${(amount / 100).toFixed(2)} ${currency}`}
      </button>
    </form>
  );
}

export function PayPageClient({ token }: { token: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['pay-token', token],
    queryFn: () => api.get(`/customer-portal/payments/token/${token}`).then((r) => r.data),
  });

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
    </div>
  );
  if (error) return (
    <div className="min-h-screen flex items-center justify-center text-gray-500">
      Payment link not found or expired.
    </div>
  );
  if (data.payment_status === 'PAID') return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <h2 className="text-xl font-bold">Already paid</h2>
        <p className="text-gray-500 mt-1">This booking has been paid in full.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Complete Payment</h1>
        <p className="text-sm text-gray-400 mb-5">{data.booking_reference}</p>
        <div className="mb-5 bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm text-gray-600 border border-gray-100">
          <p><span className="font-medium text-gray-800">Pickup:</span> {data.pickup_address}</p>
          <p><span className="font-medium text-gray-800">Drop-off:</span> {data.dropoff_address}</p>
          <p><span className="font-medium text-gray-800">Date:</span> {new Date(data.pickup_at_utc).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</p>
        </div>
        <div className="flex items-baseline gap-1.5 mb-6">
          <span className="text-3xl font-bold text-gray-900">{((data.total_price_minor ?? 0) / 100).toFixed(2)}</span>
          <span className="text-sm text-gray-400">{data.currency}</span>
        </div>
        <Elements stripe={stripePromise}>
          <PayForm token={token} amount={data.total_price_minor} currency={data.currency} />
        </Elements>
      </div>
    </div>
  );
}
