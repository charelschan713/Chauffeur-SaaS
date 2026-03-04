'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  parseQuoteFromParams,
  parseQuoteFromStorage,
  isQuoteValid,
  getMinutesRemaining,
  type QuotePayload,
} from '@/lib/quote';

type Step = 'trip' | 'passenger' | 'payment' | 'confirm';

function fmt(minor: number, currency: string) {
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

export function BookPageClient() {
  const searchParams = useSearchParams();
  const [quote, setQuote] = useState<QuotePayload | null>(null);
  const [quoteExpired, setQuoteExpired] = useState(false);
  const [step, setStep] = useState<Step>('trip');
  const [minutesLeft, setMinutesLeft] = useState(0);

  // Passenger fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    // 1. Try URL params first
    let payload = parseQuoteFromParams(searchParams);
    // 2. Fallback to sessionStorage
    if (!payload) payload = parseQuoteFromStorage();

    if (!payload) return;

    if (!isQuoteValid(payload)) {
      setQuoteExpired(true);
      setQuote(payload);
      return;
    }

    setQuote(payload);
    setMinutesLeft(getMinutesRemaining(payload));
    // Skip to passenger step since trip is prefilled
    setStep('passenger');
  }, [searchParams]);

  // Countdown ticker
  useEffect(() => {
    if (!quote || quoteExpired) return;
    const t = setInterval(() => {
      const left = getMinutesRemaining(quote);
      setMinutesLeft(left);
      if (left <= 0) {
        setQuoteExpired(true);
        clearInterval(t);
      }
    }, 30000);
    return () => clearInterval(t);
  }, [quote, quoteExpired]);

  const inputCls = 'w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'text-sm font-medium text-gray-700 block mb-1';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Complete Your Booking</h1>
        </div>

        {/* Quote expired banner */}
        {quoteExpired && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <span className="text-yellow-500 text-lg">⚠️</span>
            <div>
              <div className="font-semibold text-yellow-800">Quote Expired</div>
              <div className="text-sm text-yellow-700 mt-1">
                Your quoted price has expired. Please{' '}
                <button
                  onClick={() => window.history.back()}
                  className="underline font-medium"
                >
                  go back and re-quote
                </button>{' '}
                to get a fresh price.
              </div>
            </div>
          </div>
        )}

        {/* Price guarantee banner */}
        {quote && !quoteExpired && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-blue-600 text-lg">✅</span>
                <span className="text-sm font-semibold text-blue-800">
                  Quoted price guaranteed for {minutesLeft} more minute{minutesLeft !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="text-lg font-bold text-blue-700">
                {fmt(quote.quoted_price_minor, quote.currency)}
              </div>
            </div>
          </div>
        )}

        {/* Trip Summary (prefilled — read-only) */}
        {quote && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">Trip Details</h2>
              {step === 'passenger' && (
                <button
                  onClick={() => setStep('trip')}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Edit
                </button>
              )}
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span className="text-gray-500">📍 From</span>
                <span className="font-medium text-right ml-4 max-w-xs truncate">{quote.pickup_address}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">🏁 To</span>
                <span className="font-medium text-right ml-4 max-w-xs truncate">{quote.dropoff_address}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">📅 Date/Time</span>
                <span className="font-medium">
                  {new Date(quote.pickup_at_utc).toLocaleString('en-AU', {
                    timeZone: quote.timezone,
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">👥 Passengers</span>
                <span className="font-medium">{quote.passenger_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">🧳 Luggage</span>
                <span className="font-medium">{quote.luggage_count}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-semibold text-gray-900">
                <span>Estimated Total</span>
                <span>{fmt(quote.quoted_price_minor, quote.currency)}</span>
              </div>
            </div>
          </div>
        )}

        {/* No quote — manual trip entry */}
        {!quote && step === 'trip' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <h2 className="font-semibold text-gray-900 mb-4">Trip Details</h2>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Pickup Address</label>
                <input className={inputCls} placeholder="Enter pickup address" />
              </div>
              <div>
                <label className={labelCls}>Drop-off Address</label>
                <input className={inputCls} placeholder="Enter destination" />
              </div>
              <div>
                <label className={labelCls}>Date & Time</label>
                <input type="datetime-local" className={inputCls} />
              </div>
              <button
                onClick={() => setStep('passenger')}
                className="w-full bg-blue-600 text-white rounded-lg py-3 font-semibold hover:bg-blue-700 transition-colors"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Passenger Details */}
        {step === 'passenger' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <h2 className="font-semibold text-gray-900 mb-4">Passenger Details</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>First Name</label>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} placeholder="John" />
                </div>
                <div>
                  <label className={labelCls}>Last Name</label>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} placeholder="Smith" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="john@example.com" />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="+61 4xx xxx xxx" />
              </div>
              <div>
                <label className={labelCls}>Special Requests (optional)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} placeholder="Child seat, meet & greet, etc." />
              </div>
              <button
                onClick={() => setStep('payment')}
                disabled={!firstName || !email || quoteExpired}
                className="w-full bg-blue-600 text-white rounded-lg py-3 font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Continue to Payment →
              </button>
            </div>
          </div>
        )}

        {/* Payment step */}
        {step === 'payment' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <h2 className="font-semibold text-gray-900 mb-4">Payment</h2>
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-500 text-center">
              Payment integration (Stripe) — coming soon.
              <br />
              <button
                onClick={() => setStep('confirm')}
                className="mt-3 w-full bg-green-600 text-white rounded-lg py-3 font-semibold hover:bg-green-700 transition-colors"
              >
                Confirm Booking →
              </button>
            </div>
          </div>
        )}

        {/* Confirmation */}
        {step === 'confirm' && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Booking Confirmed!</h2>
            <p className="text-gray-500 text-sm">
              A confirmation has been sent to <strong>{email}</strong>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
