'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import api from '@/lib/api';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '');

function PayForm({ bookingId, amount, currency }: { bookingId: string; amount: number; currency: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    try {
      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: elements.getElement(CardElement)!,
      });
      if (pmError) throw pmError;

      const { data } = await api.post(`/customer-portal/payments/token/${bookingId}/pay`, {
        paymentMethodId: paymentMethod!.id,
      });

      if (data.success) {
        setResult('success');
      } else if (data.clientSecret) {
        const { error } = await stripe.confirmCardPayment(data.clientSecret);
        if (error) throw error;
        setResult('success');
      } else {
        throw new Error('Payment failed');
      }
    } catch (err: any) {
      setErrorMsg(err.message ?? 'Payment failed');
      setResult('error');
    } finally {
      setLoading(false);
    }
  };

  if (result === 'success') {
    return (
      <div className="text-center py-8">
        <p className="text-4xl mb-3">✅</p>
        <h2 className="text-xl font-bold text-gray-900">Payment successful!</h2>
        <p className="text-gray-500 mt-2">Your booking is confirmed.</p>
      </div>
    );
  }

  return (
    <form onSubmit={pay} className="space-y-4">
      {result === 'error' && <p className="text-sm text-red-600 bg-red-50 rounded p-3">{errorMsg}</p>}
      <div className="border border-gray-300 rounded-lg p-3 bg-white">
        <CardElement options={{ style: { base: { fontSize: '16px' } } }} />
      </div>
      <button type="submit" disabled={loading || !stripe} className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50">
        {loading ? 'Processing...' : `Pay ${(amount / 100).toFixed(2)} ${currency}`}
      </button>
    </form>
  );
}

export function PayPageClient({ token }: { token: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['pay-token', token],
    queryFn: () => api.get(`/customer-portal/payments/token/${token}`).then((r) => r.data),
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-gray-500">Payment link not found or expired.</div>;
  if (data.payment_status === 'PAID') return <div className="min-h-screen flex items-center justify-center"><div className="text-center"><p className="text-4xl mb-3">✅</p><h2 className="text-xl font-bold">Already paid</h2></div></div>;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Complete payment</h1>
        <p className="text-sm text-gray-500 mb-6">{data.booking_reference}</p>
        <div className="mb-4 text-sm text-gray-700 space-y-1">
          <p><span className="font-medium">Pickup:</span> {data.pickup_address}</p>
          <p><span className="font-medium">Drop-off:</span> {data.dropoff_address}</p>
          <p><span className="font-medium">Date:</span> {new Date(data.pickup_at_utc).toLocaleString()}</p>
        </div>
        <p className="text-2xl font-bold text-gray-900 mb-6">
          {((data.total_price_minor ?? 0) / 100).toFixed(2)} {data.currency}
        </p>
        <Elements stripe={stripePromise}>
          <PayForm bookingId={token} amount={data.total_price_minor} currency={data.currency} />
        </Elements>
      </div>
    </div>
  );
}
