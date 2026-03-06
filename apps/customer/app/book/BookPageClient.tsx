'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { cn, fmtMoney } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import {
  MapPin, Clock, Users, Car, ChevronRight,
  AlertCircle, CheckCircle2, Timer, ArrowLeft,
} from 'lucide-react';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '');

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://chauffeur-saas-production.up.railway.app';

// ── Types ──────────────────────────────────────────────────────────────────
interface QuoteSession {
  id: string;
  tenant_id: string;
  payload: {
    slug: string;
    request: {
      pickup_address: string;
      dropoff_address: string;
      pickup_at_utc: string;
      timezone: string;
      passenger_count: number;
      luggage_count?: number;
      trip_mode: string;
      service_type_id: string;
      infant_seats?: number;
      toddler_seats?: number;
      booster_seats?: number;
    };
    results: Array<{
      service_class_id: string;
      service_class_name: string;
      estimated_total_minor: number;
      currency: string;
      pricing_snapshot_preview: {
        base_calculated_minor: number;
        toll_parking_minor: number;
        surcharge_minor: number;
        grand_total_minor: number;
        minimum_applied: boolean;
      };
    }>;
    currency: string;
    quoted_at: string;
    expires_at: string;
  };
  expires_at: string;
  converted: boolean;
}

// ── Countdown hook ─────────────────────────────────────────────────────────
function useCountdown(expiresAt: string) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      setRemaining(Math.max(0, Math.floor(ms / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return { remaining, mins, secs, expired: remaining === 0 };
}

// ── Card setup form ────────────────────────────────────────────────────────
function CardSetupForm({ onSuccess, onCancel }: { onSuccess: (setupIntentId: string) => void; onCancel: () => void }) {
  const stripe   = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError('');
    try {
      const { data: si } = await api.post('/customer-portal/payments/setup-intent');
      const { setupIntent, error: stripeErr } = await stripe.confirmCardSetup(si.clientSecret, {
        payment_method: { card: elements.getElement(CardElement)! },
      });
      if (stripeErr) throw new Error(stripeErr.message);
      if (!setupIntent || setupIntent.status !== 'succeeded') throw new Error('Card setup failed');
      onSuccess(setupIntent.id);
    } catch (err: any) {
      setError(err.message ?? 'Card setup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-[hsl(var(--destructive)/0.1)] border border-[hsl(var(--destructive)/0.3)] text-sm text-[hsl(var(--destructive))]">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      <div>
        <Label className="mb-2 block">Card Details</Label>
        <div className="rounded-[--radius] border border-[hsl(var(--input-border))] bg-[hsl(var(--input))] px-3 py-3.5">
          <CardElement options={{
            style: {
              base: { fontSize: '15px', color: 'hsl(216 33% 97%)', '::placeholder': { color: 'hsl(217 11% 45%)' } },
              invalid: { color: 'hsl(0 84% 60%)' },
            },
          }} />
        </div>
      </div>
      <div className="flex items-start gap-2 p-3 rounded-lg bg-[hsl(var(--muted))] text-xs text-[hsl(var(--muted-foreground))]">
        🔒 Your card will be <strong className="text-[hsl(var(--foreground))]">saved but not charged</strong> now.
        Admin will review and charge once confirmed.
      </div>
      <div className="flex gap-3">
        <Button type="submit" size="lg" className="flex-1" disabled={loading || !stripe}>
          {loading ? <><Spinner className="h-4 w-4 mr-2" /> Saving...</> : 'Save Card & Submit Booking'}
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}

// ── Auth gate ──────────────────────────────────────────────────────────────
function AuthGate({ onLogin, onRegister, onGuest }: {
  onLogin: () => void;
  onRegister: () => void;
  onGuest: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-[hsl(var(--muted-foreground))] text-center pb-2">
        To complete your booking, please sign in or continue as guest.
      </p>
      <Button size="lg" className="w-full" onClick={onLogin}>Sign In</Button>
      <Button size="lg" variant="secondary" className="w-full" onClick={onRegister}>Create Account</Button>
      <Button size="lg" variant="outline" className="w-full" onClick={onGuest}>Continue as Guest</Button>
    </div>
  );
}

// ── Login form ─────────────────────────────────────────────────────────────
function InlineLoginForm({ onSuccess, onBack }: { onSuccess: () => void; onBack: () => void }) {
  const setAuth   = useAuthStore(s => s.setAuth);
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const slug = document.cookie.split('; ').find(r => r.startsWith('tenant_slug='))?.split('=')[1] ?? '';
      const { data } = await api.post('/customer-auth/login', { tenantSlug: slug, email, password });
      setAuth(data.accessToken, data.customerId, slug);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>}
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label>Password</Label>
        <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
      </div>
      <div className="flex gap-3 pt-1">
        <Button type="submit" size="lg" className="flex-1" disabled={loading}>
          {loading ? <Spinner className="h-4 w-4 mr-2" /> : null} Sign In
        </Button>
        <Button type="button" variant="outline" size="lg" onClick={onBack}>Back</Button>
      </div>
    </form>
  );
}

// ── Guest form ─────────────────────────────────────────────────────────────
function GuestForm({ onSuccess, onBack }: { onSuccess: (guestData: any) => void; onBack: () => void }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSuccess(form); }} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>First Name *</Label>
          <Input value={form.firstName} onChange={f('firstName')} required />
        </div>
        <div className="space-y-1.5">
          <Label>Last Name *</Label>
          <Input value={form.lastName} onChange={f('lastName')} required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Email *</Label>
        <Input type="email" value={form.email} onChange={f('email')} required />
      </div>
      <div className="space-y-1.5">
        <Label>Phone</Label>
        <Input type="tel" value={form.phone} onChange={f('phone')} placeholder="+61 400 000 000" />
      </div>
      <div className="flex gap-3 pt-1">
        <Button type="submit" size="lg" className="flex-1">Continue</Button>
        <Button type="button" variant="outline" size="lg" onClick={onBack}>Back</Button>
      </div>
    </form>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
type Step = 'loading' | 'expired' | 'auth' | 'login' | 'guest' | 'details' | 'card' | 'done';

export function BookPageClient() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { token, hydrate } = useAuthStore();

  const quoteId    = searchParams.get('quote_id');
  const carTypeId  = searchParams.get('car_type_id');

  const [step, setStep]             = useState<Step>('loading');
  const [session, setSession]       = useState<QuoteSession | null>(null);
  const [selectedResult, setSelectedResult] = useState<QuoteSession['payload']['results'][0] | null>(null);
  const [guestData, setGuestData]   = useState<any>(null);

  // Extra booking details
  const [flightNumber, setFlightNumber]       = useState('');
  const [specialRequests, setSpecialRequests] = useState('');

  // Created booking (for card setup)
  const [createdBooking, setCreatedBooking]   = useState<any>(null);
  const [submitError, setSubmitError]         = useState('');
  const [submitting, setSubmitting]           = useState(false);

  const countdown = useCountdown(session?.expires_at ?? new Date(Date.now() + 9999999).toISOString());

  // Hydrate auth on mount
  useEffect(() => { hydrate(); }, [hydrate]);

  // Load quote session
  useEffect(() => {
    if (!quoteId) { setStep('expired'); return; }
    fetch(`${API_URL}/public/pricing/quote/${quoteId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { setStep('expired'); return; }
        setSession(data);
        // Find the selected car type result
        const result = data.payload.results.find((r: any) => r.service_class_id === carTypeId)
          ?? data.payload.results[0];
        setSelectedResult(result);
        // Determine next step
        if (token) setStep('details');
        else setStep('auth');
      })
      .catch(() => setStep('expired'));
  }, [quoteId, carTypeId, token]);

  // Handle quote expiry
  useEffect(() => {
    if (countdown.expired && step !== 'loading' && step !== 'expired' && step !== 'done') {
      setStep('expired');
    }
  }, [countdown.expired, step]);

  // ── Submit booking details ──
  const handleDetailsSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !selectedResult) return;
    setSubmitting(true);
    setSubmitError('');

    try {
      const req = session.payload.request;
      const payload = {
        pickupAddress: req.pickup_address,
        dropoffAddress: req.dropoff_address,
        pickupAtUtc: req.pickup_at_utc,
        serviceTypeId: req.service_type_id,
        vehicleClassId: selectedResult.service_class_id,
        totalPriceMinor: selectedResult.estimated_total_minor,
        currency: selectedResult.currency,
        passengerCount: req.passenger_count,
        luggageCount: req.luggage_count ?? 0,
        flightNumber: flightNumber || undefined,
        notes: specialRequests || undefined,
        tripMode: req.trip_mode,
        infantSeats: req.infant_seats ?? 0,
        toddlerSeats: req.toddler_seats ?? 0,
        boosterSeats: req.booster_seats ?? 0,
        quoteId: session.id,
        ...(guestData && {
          guestCheckout: true,
          firstName: guestData.firstName,
          lastName: guestData.lastName,
          email: guestData.email,
          phone: guestData.phone,
        }),
      };

      const endpoint = guestData
        ? '/customer-portal/guest-checkout'
        : '/customer-portal/bookings';

      const { data } = await api.post(endpoint, payload);
      setCreatedBooking(data?.booking ?? data);
      setStep('card');
    } catch (err: any) {
      setSubmitError(err.response?.data?.message ?? 'Failed to create booking');
    } finally {
      setSubmitting(false);
    }
  }, [session, selectedResult, flightNumber, specialRequests, guestData]);

  // ── Card confirmed ──
  const handleCardConfirmed = useCallback(async (setupIntentId: string) => {
    try {
      await api.post('/customer-portal/payments/setup-confirm', {
        setupIntentId,
        bookingId: createdBooking?.id,
      });
      // Mark quote as converted
      await fetch(`${API_URL}/public/pricing/quote/${quoteId}`, { method: 'PATCH' }).catch(() => {});
      setStep('done');
    } catch (err: any) {
      setSubmitError(err.response?.data?.message ?? 'Payment setup failed');
      setStep('details');
    }
  }, [createdBooking, quoteId]);

  // ── Render helpers ──
  const renderQuoteSummary = () => {
    if (!session || !selectedResult) return null;
    const req     = session.payload.request;
    const preview = selectedResult.pricing_snapshot_preview;
    const pickupDate = new Date(req.pickup_at_utc).toLocaleString('en-AU', {
      dateStyle: 'medium', timeStyle: 'short', timeZone: req.timezone,
    });

    return (
      <Card className={cn(
        'border-[hsl(var(--primary)/0.3)]',
        countdown.remaining < 300 && 'border-[hsl(var(--warning)/0.5)]',
      )}>
        <CardContent className="p-4 space-y-3">
          {/* Expiry timer */}
          <div className={cn(
            'flex items-center gap-1.5 text-xs font-medium',
            countdown.remaining < 300 ? 'text-[hsl(var(--warning))]' : 'text-[hsl(var(--primary))]',
          )}>
            <Timer className="h-3.5 w-3.5" />
            Quote valid for {countdown.mins}:{String(countdown.secs).padStart(2, '0')}
          </div>

          {/* Car type */}
          <div className="flex items-center gap-3 pb-2 border-b border-[hsl(var(--border))]">
            <div className="w-14 h-10 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center shrink-0">
              <Car className="h-5 w-5 text-[hsl(var(--muted-foreground)/0.5)]" />
            </div>
            <div className="flex-1">
              <p className="font-serif font-medium text-sm text-[hsl(var(--foreground))]">
                {selectedResult.service_class_name}
              </p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {req.passenger_count} passenger{req.passenger_count > 1 ? 's' : ''}
                {req.luggage_count ? ` · ${req.luggage_count} bags` : ''}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-bold text-gradient-gold">
                {fmtMoney(selectedResult.estimated_total_minor, selectedResult.currency)}
              </p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{selectedResult.currency} incl. GST</p>
            </div>
          </div>

          {/* Route */}
          <div className="space-y-1.5 text-xs text-[hsl(var(--muted-foreground))]">
            <div className="flex items-start gap-2">
              <MapPin className="h-3.5 w-3.5 mt-0.5 text-[hsl(var(--success))] shrink-0" />
              <span>{req.pickup_address}</span>
            </div>
            {req.dropoff_address && req.dropoff_address !== req.pickup_address && (
              <div className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 mt-0.5 text-[hsl(var(--primary))] shrink-0" />
                <span>{req.dropoff_address}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>{pickupDate}</span>
              {req.trip_mode === 'RETURN' && (
                <span className="px-1.5 py-0.5 rounded bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))] font-medium">
                  Return
                </span>
              )}
            </div>
          </div>

          {/* Price breakdown */}
          {(preview.base_calculated_minor > 0 || preview.toll_parking_minor > 0) && (
            <div className="space-y-1 text-xs border-t border-[hsl(var(--border))] pt-2">
              {preview.base_calculated_minor > 0 && (
                <div className="flex justify-between text-[hsl(var(--muted-foreground))]">
                  <span>Base fare</span>
                  <span>{fmtMoney(preview.base_calculated_minor, selectedResult.currency)}</span>
                </div>
              )}
              {preview.surcharge_minor > 0 && (
                <div className="flex justify-between text-[hsl(var(--muted-foreground))]">
                  <span>Surcharge</span>
                  <span>{fmtMoney(preview.surcharge_minor, selectedResult.currency)}</span>
                </div>
              )}
              {preview.toll_parking_minor > 0 && (
                <div className="flex justify-between text-[hsl(var(--muted-foreground))]">
                  <span>Tolls / Parking</span>
                  <span>{fmtMoney(preview.toll_parking_minor, selectedResult.currency)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-[hsl(var(--foreground))] pt-1 border-t border-[hsl(var(--border))]">
                <span>Total</span>
                <span>{fmtMoney(selectedResult.estimated_total_minor, selectedResult.currency)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // ── Step renders ──────────────────────────────────────────────────────────

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center">
        <Spinner className="h-10 w-10" />
      </div>
    );
  }

  if (step === 'expired') {
    return (
      <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center mx-auto">
            <Timer className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
          </div>
          <h1 className="font-serif text-xl font-medium text-[hsl(var(--foreground))]">Quote Expired</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            This quote has expired or is no longer valid. Please return to get a new quote.
          </p>
          <Button size="lg" className="w-full" onClick={() => window.history.back()}>
            Get a New Quote
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-[hsl(var(--success)/0.15)] flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-[hsl(var(--success))]" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-medium text-[hsl(var(--foreground))]">Booking Submitted!</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-2">
              Your card has been saved. We'll confirm your booking and notify you shortly.
            </p>
          </div>
          {createdBooking?.booking_reference && (
            <div className="font-mono text-sm bg-[hsl(var(--muted))] rounded-lg px-4 py-2.5 inline-block">
              {createdBooking.booking_reference}
            </div>
          )}
          <div className="flex gap-3">
            {token ? (
              <Button size="lg" className="flex-1" onClick={() => router.push('/dashboard')}>
                View Dashboard
              </Button>
            ) : (
              <Button size="lg" className="flex-1" onClick={() => router.push('/register')}>
                Create Account
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Main layout ──
  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      {/* Header */}
      <header className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => window.history.back()}
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-serif text-lg font-medium text-[hsl(var(--foreground))]">Complete Booking</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Quote Summary — always visible */}
        {renderQuoteSummary()}

        {/* Step content */}
        <Card>
          <CardContent className="p-5">

            {/* Auth gate */}
            {step === 'auth' && (
              <AuthGate
                onLogin={() => setStep('login')}
                onRegister={() => router.push(`/register?redirect=/book?quote_id=${quoteId}&car_type_id=${carTypeId}`)}
                onGuest={() => setStep('guest')}
              />
            )}

            {/* Inline login */}
            {step === 'login' && (
              <InlineLoginForm
                onSuccess={() => setStep('details')}
                onBack={() => setStep('auth')}
              />
            )}

            {/* Guest details */}
            {step === 'guest' && (
              <GuestForm
                onSuccess={(data) => { setGuestData(data); setStep('details'); }}
                onBack={() => setStep('auth')}
              />
            )}

            {/* Booking details */}
            {step === 'details' && (
              <form onSubmit={handleDetailsSubmit} className="space-y-4">
                <h2 className="font-semibold text-[hsl(var(--foreground))]">Booking Details</h2>

                {submitError && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-[hsl(var(--destructive)/0.1)] border border-[hsl(var(--destructive)/0.3)] text-sm text-[hsl(var(--destructive))]">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    {submitError}
                  </div>
                )}

                {/* Flight number — shown for all (optional) */}
                <div className="space-y-1.5">
                  <Label>Flight Number <span className="text-[hsl(var(--muted-foreground))] font-normal normal-case">(optional)</span></Label>
                  <Input value={flightNumber} onChange={e => setFlightNumber(e.target.value)}
                    placeholder="e.g. QF401" />
                </div>

                {/* Special requests */}
                <div className="space-y-1.5">
                  <Label>Special Requests <span className="text-[hsl(var(--muted-foreground))] font-normal normal-case">(optional)</span></Label>
                  <textarea
                    className="w-full h-20 rounded-[--radius] border border-[hsl(var(--input-border))] bg-[hsl(var(--input))] px-3 py-2.5 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] resize-none focus:outline-none focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary)/0.15)] transition-colors"
                    placeholder="Any special requirements for your journey..."
                    value={specialRequests}
                    onChange={e => setSpecialRequests(e.target.value)}
                  />
                </div>

                <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                  {submitting
                    ? <><Spinner className="h-4 w-4 mr-2" /> Processing...</>
                    : <>Continue to Payment <ChevronRight className="h-4 w-4 ml-1" /></>
                  }
                </Button>
              </form>
            )}

            {/* Card setup */}
            {step === 'card' && (
              <div className="space-y-4">
                <h2 className="font-semibold text-[hsl(var(--foreground))]">Save Payment Card</h2>
                {submitError && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-[hsl(var(--destructive)/0.1)] border border-[hsl(var(--destructive)/0.3)] text-sm text-[hsl(var(--destructive))]">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    {submitError}
                  </div>
                )}
                <Elements stripe={stripePromise}>
                  <CardSetupForm
                    onSuccess={handleCardConfirmed}
                    onCancel={() => setStep('details')}
                  />
                </Elements>
              </div>
            )}

          </CardContent>
        </Card>

      </main>
    </div>
  );
}
