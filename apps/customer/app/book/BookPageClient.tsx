'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import api from '@/lib/api';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '');

type Step = 'details' | 'card' | 'done';

interface BookingForm {
  pickupAddress: string;
  dropoffAddress: string;
  pickupAtUtc: string;
  passengerCount: number;
  flightNumber: string;
  notes: string;
  serviceTypeId: string;
  totalPriceMinor: number;
  currency: string;
}

function CardStep({
  onConfirm,
  loading,
  error,
}: {
  onConfirm: (setupIntentId: string) => void;
  loading: boolean;
  error: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLocalLoading(true);
    setLocalError('');

    try {
      // Get SetupIntent client_secret from backend
      const { data: si } = await api.post('/customer-portal/payments/setup-intent');

      const { setupIntent, error: stripeErr } = await stripe.confirmCardSetup(si.clientSecret, {
        payment_method: { card: elements.getElement(CardElement)! },
      });

      if (stripeErr) throw stripeErr;
      if (!setupIntent || setupIntent.status !== 'succeeded') {
        throw new Error('Card setup did not succeed');
      }

      onConfirm(setupIntent.id);
    } catch (err: any) {
      setLocalError(err.message ?? 'Card setup failed');
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {(localError || error) && (
        <p className="text-sm text-red-600 bg-red-50 rounded p-3">{localError || error}</p>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Card details</label>
        <div className="border border-gray-300 rounded-lg p-3 bg-white">
          <CardElement options={{ style: { base: { fontSize: '16px' } } }} />
        </div>
      </div>
      <p className="text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-lg p-3">
        🔒 Your card will be <strong>saved</strong> but <strong>not charged</strong> now. An admin will review your booking and charge your card when confirmed.
      </p>
      <button
        type="submit"
        disabled={localLoading || loading || !stripe}
        className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {localLoading || loading ? 'Saving card...' : 'Save card & submit booking'}
      </button>
    </form>
  );
}

function BookingForm({ onSubmit }: { onSubmit: (booking: any, setupIntentId: string) => void }) {
  const [step, setStep] = useState<Step>('details');
  const [booking, setBooking] = useState<BookingForm>({
    pickupAddress: '',
    dropoffAddress: '',
    pickupAtUtc: '',
    passengerCount: 1,
    flightNumber: '',
    notes: '',
    serviceTypeId: '',
    totalPriceMinor: 0,
    currency: 'AUD',
  });
  const [createdBooking, setCreatedBooking] = useState<any>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState('');

  const f = (k: keyof BookingForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setBooking({ ...booking, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value });

  const nextStep = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Create booking in AWAITING_CONFIRMATION state
      const { data } = await api.post('/customer-portal/bookings', booking);
      setCreatedBooking(data);
      setStep('card');
    } catch (err: any) {
      alert(err.response?.data?.message ?? 'Failed to create booking');
    }
  };

  const handleCardConfirm = async (setupIntentId: string) => {
    setCardLoading(true);
    setCardError('');
    try {
      await api.post('/customer-portal/payments/setup-confirm', {
        setupIntentId,
        bookingId: createdBooking?.id,
      });
      setStep('done');
    } catch (err: any) {
      setCardError(err.response?.data?.message ?? 'Failed to confirm setup');
    } finally {
      setCardLoading(false);
    }
  };

  if (step === 'done') {
    return (
      <div className="text-center py-8">
        <p className="text-5xl mb-4">🎉</p>
        <h2 className="text-xl font-bold text-gray-900">Booking submitted!</h2>
        <p className="text-gray-500 mt-2 text-sm">
          Your card has been saved. We&apos;ll confirm your booking and charge your card shortly.
        </p>
        <p className="mt-3 font-mono text-sm bg-gray-100 rounded px-3 py-2 inline-block">
          {createdBooking?.booking_reference}
        </p>
      </div>
    );
  }

  if (step === 'card') {
    return (
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
          <p className="font-medium text-gray-900">{booking.pickupAddress}</p>
          <p className="text-gray-500">→ {booking.dropoffAddress}</p>
          <p className="text-gray-400">{new Date(booking.pickupAtUtc).toLocaleString()}</p>
        </div>
        <Elements stripe={stripePromise}>
          <CardStep onConfirm={handleCardConfirm} loading={cardLoading} error={cardError} />
        </Elements>
        <button onClick={() => setStep('details')} className="w-full text-sm text-gray-500 hover:text-gray-700">
          ← Back to details
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={nextStep} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Pickup address *</label>
        <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={booking.pickupAddress} onChange={f('pickupAddress')} required />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Drop-off address *</label>
        <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={booking.dropoffAddress} onChange={f('dropoffAddress')} required />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Pickup date & time *</label>
        <input type="datetime-local" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={booking.pickupAtUtc} onChange={f('pickupAtUtc')} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Passengers</label>
          <input type="number" min="1" max="20" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={booking.passengerCount} onChange={f('passengerCount')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Flight number</label>
          <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={booking.flightNumber} onChange={f('flightNumber')} placeholder="Optional" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={2} value={booking.notes} onChange={f('notes')} placeholder="Any special requests?" />
      </div>
      <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700">
        Continue to payment →
      </button>
    </form>
  );
}

export function BookPageClient() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
          <h1 className="text-lg font-semibold text-gray-900">Book a ride</h1>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <BookingForm onSubmit={() => {}} />
        </div>
      </main>
    </div>
  );
}
