'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
import { BackButton } from '@/components/BackButton';
import { PhoneCountrySelect } from '@/components/PhoneCountrySelect';
import { BookDebugPanel } from '@/components/BookDebugPanel';
import {
  MapPin, Clock, Users, Car, ChevronRight,
  AlertCircle, CheckCircle2, Timer, ArrowLeft,
} from 'lucide-react';



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
      city_id?: string;
      infant_seats?: number;
      toddler_seats?: number;
      booster_seats?: number;
      waypoints?: string[];
      waypoints_count?: number;
      return_date?: string;
      return_time?: string;
      return_pickup_at_utc?: string;
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
        surcharge_labels?: string[];
        surcharge_items?: { label: string; amount_minor: number }[];
        grand_total_minor: number;
        minimum_applied: boolean;
        discount_amount_minor?: number;
        pre_discount_total_minor?: number;
        extras_minor?: number;
        waypoints_minor?: number;
        baby_seats_minor?: number;
        toll_minor?: number;
        parking_minor?: number;
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
  // Start with null — means "not yet computed". Prevents false-expiry on first render.
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      setRemaining(Math.max(0, Math.floor(ms / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  const mins = remaining !== null ? Math.floor(remaining / 60) : 30;
  const secs = remaining !== null ? remaining % 60 : 0;
  // Only mark expired once we've actually computed a value (remaining === 0, not null)
  return { remaining: remaining ?? 9999, mins, secs, expired: remaining === 0 };
}

// ── Card setup form ────────────────────────────────────────────────────────
function CardSetupForm({ onSuccess, isGuest, billingName, submitLabel, submitting: externalSubmitting, clientSecret, onValidate }: {
  onSuccess: (setupIntentId: string) => void;
  isGuest?: boolean;
  billingName?: string;
  submitLabel?: string;
  submitting?: boolean;
  clientSecret: string;
  onValidate?: () => string | null; // returns error string or null if ok
}) {
  const stripe   = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) {
      console.error('[CardSetupForm] stripe or elements is null', { stripe: !!stripe, elements: !!elements });
      return;
    }
    // Run contact details validation before touching Stripe
    if (onValidate) {
      const validationError = onValidate();
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    setLoading(true);
    setError('');
    try {

      const sp = new URLSearchParams(window.location.search);
      const returnUrl = `${window.location.origin}/book?quote_id=${sp.get('quote_id') ?? ''}&car_type_id=${sp.get('car_type_id') ?? ''}&3ds=1`;
      const { setupIntent, error: stripeErr } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
          billing_details: { name: billingName?.trim() || undefined },
        },
        return_url: returnUrl,
      });
      // confirmCardSetup handles 3DS inline — if it returns, authentication is complete or failed
      if (stripeErr) { console.error('[CardSetupForm] stripeErr:', stripeErr); throw new Error(stripeErr.message); }
      if (!setupIntent || setupIntent.status !== 'succeeded') throw new Error('Card verification failed. Please try again.');
      onSuccess(setupIntent.id);
    } catch (err: any) {
      console.error('[CardSetupForm] error:', err);
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
        <div className="rounded-[--radius] border border-[hsl(var(--input-border))] bg-[hsl(var(--input))] px-3 py-3.5">
          <CardElement options={{
            hidePostalCode: true,
            style: {
              base: { fontSize: '15px', color: '#e2e8f0', '::placeholder': { color: '#64748b' } },
              invalid: { color: '#ef4444' },
            },
          }} />
        </div>
      </div>
      <div className="flex items-start gap-2 p-3 rounded-lg bg-[hsl(var(--muted))] text-xs text-[hsl(var(--muted-foreground))]">
        Secured by Stripe · Your card details are encrypted. Your bank may prompt for 3D Secure verification.
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={loading || externalSubmitting || !stripe}>
        {loading || externalSubmitting
          ? <><Spinner className="h-4 w-4 mr-2" /> Processing…</>
          : submitLabel ?? 'Confirm & Pay'
        }
      </Button>
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

// ── Guest Activate via OTP (shown on Thank You page) ──────────────────────
function GuestActivateOtp({
  email, phoneCode, phone, bookingRef, onActivated,
}: { email: string; phoneCode: string; phone: string; bookingRef: string; onActivated: () => void }) {
  const [stage, setStage]     = useState<'prompt' | 'otp' | 'done'>('prompt');
  const [otp, setOtp]         = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [countdown, setCountdown] = useState(0);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const sendOtp = async () => {
    setLoading(true); setError('');
    try {
      await api.post('/customer-portal/auth/send-otp', { phone_country_code: phoneCode, phone_number: phone });
      setStage('otp');
      setCountdown(60);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to send OTP');
    } finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    if (!otp.trim()) return;
    setLoading(true); setError('');
    try {
      const { data } = await api.post('/customer-portal/auth/verify-otp', {
        phone_country_code: phoneCode,
        phone_number: phone,
        otp_code: otp.trim(),
      });
      if (data.accessToken) {
        localStorage.setItem('token', data.accessToken);
        if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
        setStage('done');
        setTimeout(onActivated, 1200);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Invalid OTP. Please try again.');
    } finally { setLoading(false); }
  };

  if (stage === 'done') return (
    <div className="w-full rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-4 text-center">
      <p className="text-emerald-400 font-medium text-sm">Activated! Redirecting…</p>
    </div>
  );

  return (
    <div className="w-full rounded-2xl bg-white/[0.04] border border-white/10 px-5 py-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-white">Track your booking</p>
        <p className="text-xs text-white/50 mt-0.5">
          Verify your phone number to access your bookings anytime.
        </p>
      </div>

      {stage === 'prompt' && (
        <>
          <div className="rounded-xl bg-white/[0.04] px-4 py-3 text-sm text-white/70">
            {phoneCode} {phone}
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <Button size="lg" className="w-full" onClick={sendOtp} disabled={loading}>
            {loading ? 'Sending…' : 'Send OTP to my phone'}
          </Button>
        </>
      )}

      {stage === 'otp' && (
        <>
          <p className="text-xs text-white/50">
            Enter the 6-digit code sent to {phoneCode} {phone}
          </p>
          <input
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            className="w-full text-center text-2xl tracking-[0.5em] font-mono rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-[hsl(var(--primary)/0.6)]"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <Button size="lg" className="w-full" onClick={verifyOtp} disabled={loading || otp.length < 6}>
            {loading ? 'Verifying…' : 'Verify & View Booking'}
          </Button>
          <button
            onClick={countdown > 0 ? undefined : sendOtp}
            disabled={countdown > 0}
            className="w-full text-center text-xs text-white/40 disabled:opacity-50"
          >
            {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
          </button>
        </>
      )}
    </div>
  );
}

// ── Guest form ─────────────────────────────────────────────────────────────
function GuestForm({ onSuccess, onBack }: { onSuccess: (guestData: any) => void; onBack: () => void }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phoneCode: '+61', phoneNumber: '' });
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <form onSubmit={e => {
      e.preventDefault();
      onSuccess({ ...form, phone: `${form.phoneCode}${form.phoneNumber}` });
    }} className="space-y-3">
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
        <div className="flex gap-2">
          <PhoneCountrySelect value={form.phoneCode} onChange={v => setForm(p => ({ ...p, phoneCode: v }))} className="w-28 shrink-0" />
          <Input type="tel" className="flex-1" value={form.phoneNumber} onChange={f('phoneNumber')} placeholder="400 000 000" />
        </div>
      </div>
      <div className="flex gap-3 pt-1">
        <Button type="submit" size="lg" className="flex-1">Continue</Button>
        <Button type="button" variant="outline" size="lg" onClick={onBack}>Back</Button>
      </div>
    </form>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
// 'expired' removed — expiry is now shown as an inline banner, not a full-page redirect
type Step = 'loading' | 'auth' | 'login' | 'guest' | 'details' | 'done';

export function BookPageClient() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { token, hydrate } = useAuthStore();

  // Read directly from window.location to avoid useSearchParams returning null during Stripe re-renders
  const quoteIdRef   = useRef<string | null>(null);
  const carTypeIdRef = useRef<string | null>(null);
  if (!quoteIdRef.current) {
    // Try useSearchParams first, fall back to direct URL parse (works even when Suspense returns null)
    const fromSearchParams = searchParams.get('quote_id');
    const fromUrl = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('quote_id')
      : null;
    quoteIdRef.current = fromSearchParams || fromUrl;
  }
  if (!carTypeIdRef.current) {
    const fromSearchParams = searchParams.get('car_type_id');
    const fromUrl = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('car_type_id')
      : null;
    carTypeIdRef.current = fromSearchParams || fromUrl;
  }
  const quoteId   = quoteIdRef.current;
  const carTypeId = carTypeIdRef.current;

  const [step, setStep]             = useState<Step>('loading');
  const [session, setSession]       = useState<QuoteSession | null>(null);
  const sessionRef = useRef<QuoteSession | null>(null);
  const selectedResultRef = useRef<any>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null); // inline error banner, no redirect

  // Stripe promise — loaded dynamically so we always get the real key
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);
  const [stripePkLoaded, setStripePkLoaded] = useState(false);

  // Load Stripe publishable key — try all sources, stop once we have a real key
  const loadStripeKey = useCallback(async (tenantId?: string) => {
    if (stripePkLoaded) return;

    // 1. Env var (baked in at build time)
    const envKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (envKey && !envKey.includes('placeholder') && envKey.startsWith('pk_')) {
      setStripePromise(loadStripe(envKey));
      setStripePkLoaded(true);
      return;
    }

    // 2. Hardcoded tenant-specific publishable key (safe — public key)
    const ASCHAUFFEURED_PK = 'pk_test_51PuUzlB3pdczuXMq89dEizofOSKDjaMOiJmnn8PXHvqA9pLrNeFRXqdzImtLUC07r1JYOYT581R33wr7sEosE3j100Z67sRtjn';
    setStripePromise(loadStripe(ASCHAUFFEURED_PK));
    setStripePkLoaded(true);

    // 3. In background also try API (for multi-tenant future support)
    if (tenantId) {
      fetch(`${API_URL}/customer-portal/stripe-config?tenant_id=${tenantId}`)
        .then(r => r.json())
        .then(data => {
          if (data?.publishableKey && data.publishableKey.startsWith('pk_') && !data.publishableKey.includes('placeholder')) {
            setStripePromise(loadStripe(data.publishableKey));
          }
        })
        .catch(() => {});
    }
  }, [stripePkLoaded]);

  // Load on mount
  useEffect(() => { loadStripeKey(); }, [loadStripeKey]); // eslint-disable-line

  // Also retry once session loads (picks up tenant-specific key if different)
  useEffect(() => {
    if (session?.tenant_id) loadStripeKey(session.tenant_id);
  }, [session?.tenant_id, loadStripeKey]); // eslint-disable-line
  const [selectedResult, setSelectedResult] = useState<QuoteSession['payload']['results'][0] | null>(null);
  const [guestData, setGuestData]           = useState<any>(null);

  // Logged-in customer discount (may be higher than base quote discount)
  const [loyaltyDiscount, setLoyaltyDiscount] = useState<{
    finalFareMinor: number;
    discountMinor: number;
    discountName: string | null;
    discountRate: number;
    cappedByMax: boolean;
    currency: string;
  } | null>(null);

  // Passenger details (pre-filled from profile or guest form)
  const [passengerDetails, setPassengerDetails] = useState({
    firstName: '', lastName: '', email: '', phoneCode: '+61', phoneNumber: '',
  });

  // Setup intent — fetched eagerly so Stripe iframe mounts with clientSecret
  const [setupClientSecret, setSetupClientSecret] = useState<string | null>(null);
  const [setupSecretLoading, setSetupSecretLoading] = useState(false);

  // "Is the passenger the same person?" toggle
  const [samePassenger, setSamePassenger]     = useState(true);
  const [passengerOverride, setPassengerOverride] = useState({
    firstName: '', lastName: '', phoneCode: '+61', phoneNumber: '',
  });

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

  // Load quote session — always reads from URL at effect time (client-side guaranteed)
  const loadQuoteSession = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const qid  = params.get('quote_id')  || sessionStorage.getItem('book_quote_id')  || quoteIdRef.current;
    const ctid = params.get('car_type_id') || sessionStorage.getItem('book_car_type_id') || carTypeIdRef.current;
    if (qid)  { quoteIdRef.current   = qid;  sessionStorage.setItem('book_quote_id',   qid); }
    if (ctid) { carTypeIdRef.current = ctid; sessionStorage.setItem('book_car_type_id', ctid); }
    if (!qid) {
      setQuoteError('No quote found. Please get a new quote.');
      setStep('details');
      return;
    }
    // Read token from localStorage directly to avoid stale closure
    const currentToken = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
    fetch(`${API_URL}/public/pricing/quote/${qid}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) {
          setQuoteError('This quote has expired. Prices may have changed — you can get a new quote or continue.');
          setStep('details');
          return;
        }
        setSession(data);
        sessionRef.current = data;
        const results = data.results ?? data.payload?.results ?? [];
        const result = results.find((r: any) => r.service_class_id === ctid) ?? results[0];
        setSelectedResult(result);
        selectedResultRef.current = result;
        setStep(currentToken ? 'details' : 'auth');
      })
      .catch(() => {
        setQuoteError('Could not load quote details. Please check your connection.');
        setStep('details');
      });
  // no deps — reads everything from refs/localStorage at call time
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Re-read from URL here inside effect — guaranteed client-side, window is available
    const params = new URLSearchParams(window.location.search);
    const qid  = params.get('quote_id')  || sessionStorage.getItem('book_quote_id')  || quoteIdRef.current;
    const ctid = params.get('car_type_id') || sessionStorage.getItem('book_car_type_id') || carTypeIdRef.current;
    if (qid)  { quoteIdRef.current   = qid;  sessionStorage.setItem('book_quote_id',   qid); }
    if (ctid) { carTypeIdRef.current = ctid; sessionStorage.setItem('book_car_type_id', ctid); }
    loadQuoteSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadQuoteSession]);

  // Handle 3DS return — Stripe redirects back with setup_intent + setup_intent_client_secret
  useEffect(() => {
    const is3dsReturn = searchParams.get('3ds') === '1';
    const siClientSecret = searchParams.get('setup_intent_client_secret');
    if (!is3dsReturn || !siClientSecret || step === 'loading' || step === 'done') return;
    // Retrieve the SetupIntent to confirm it succeeded, then complete booking
    const stripe = (window as any).Stripe?.(process.env.NEXT_PUBLIC_STRIPE_PK ?? 'pk_test_51PuUzlB3pdczuXMq89dEizofOSKDjaMOiJmnn8PXHvqA9pLrNeFRXqdzImtLUC07r1JYOYT581R33wr7sEosE3j100Z67sRtjn');
    if (!stripe) return;
    stripe.retrieveSetupIntent(siClientSecret).then(({ setupIntent }: any) => {
      if (setupIntent?.status === 'succeeded') {
        handleCardConfirmed(setupIntent.id);
      } else {
        setSubmitError('3D Secure verification failed. Please try again.');
        setStep('details');
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Handle quote expiry — show inline banner, don't redirect
  useEffect(() => {
    if (countdown.expired && step !== 'loading' && step !== 'done') {
      setQuoteError('Your quote has expired. Prices may have changed — tap "Refresh Quote" to get updated pricing.');
    }
  }, [countdown.expired, step]);

  // ── Fetch loyalty discount after login ──
  const fetchLoyaltyDiscount = useCallback(async () => {
    if (!quoteId || !selectedResult) return;
    try {
      const { data } = await api.get('/customer-portal/discount-preview', {
        params: { quote_id: quoteId, car_type_id: selectedResult.service_class_id },
      });
      if (data && !data.error) {
        setLoyaltyDiscount({
          finalFareMinor: data.final_fare_minor,
          discountMinor:  data.discount_minor,
          discountName:   data.discount_name,
          discountRate:   data.discount_rate,
          cappedByMax:    data.capped_by_max,
          currency:       data.currency,
        });
      }
    } catch {
      // Non-critical — proceed without loyalty adjustment
    }
  }, [quoteId, selectedResult]);

  // Fetch loyalty discount once logged in and result is available
  useEffect(() => {
    if (token && selectedResult && step === 'details') {
      fetchLoyaltyDiscount();
    }
  }, [token, selectedResult, step, fetchLoyaltyDiscount]);

  // Pre-fill passenger details from profile (logged-in) or guestData
  useEffect(() => {
    if (guestData) {
      // Guest phone may be combined (e.g. "+61400000000") — split out the code
      const rawPhone: string = guestData.phone ?? '';
      setPassengerDetails({
        firstName:   guestData.firstName   ?? '',
        lastName:    guestData.lastName    ?? '',
        email:       guestData.email       ?? '',
        phoneCode:   guestData.phoneCode   ?? '+61',
        phoneNumber: guestData.phoneNumber ?? '',
      });
    } else if (token) {
      api.get('/customer-portal/profile').then(({ data }) => {
        setPassengerDetails({
          firstName:   data.first_name          ?? '',
          lastName:    data.last_name           ?? '',
          email:       data.email               ?? '',
          phoneCode:   data.phone_country_code  ?? '+61',
          phoneNumber: data.phone_number        ?? '',
        });
      }).catch(() => {});
    }
  }, [token, guestData]);

  // Eagerly fetch setup intent when booking form loads so Stripe iframe has clientSecret
  useEffect(() => {
    const formVisible = step === 'details' || (step === 'auth' && !!guestData);
    if (!formVisible || setupClientSecret || setupSecretLoading) return;
    setSetupSecretLoading(true);
    const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://chauffeur-saas-production.up.railway.app';
    const fetchSecret = async () => {
      try {
        if (token) {
          const { data } = await api.post('/customer-portal/payments/setup-intent');
          setSetupClientSecret(data.clientSecret);
        } else {
          const res = await fetch(`${API}/customer-portal/payments/guest-setup-intent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: 'aschauffeured' }),
          });
          const data = await res.json();
          if (data.clientSecret) setSetupClientSecret(data.clientSecret);
        }
      } catch (e: any) {
        console.error('[SETUP_INTENT_FAILED]', e?.message ?? e);
      } finally { setSetupSecretLoading(false); }
    };
    fetchSecret();
  }, [step, token, setupClientSecret, setupSecretLoading]);

  // Details form submit — handled inside CardSetupForm; this is just a no-op wrapper
  const handleDetailsSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    // Card setup form has its own submit; outer form submit is a fallback no-op
  }, []);

  // Card confirmed: NOW create the booking (only after payment card saved)
  const handleCardConfirmed = useCallback(async (setupIntentId: string) => {
    // Always read from refs to avoid stale closure issues
    const currentSession = sessionRef.current;
    const currentResult = selectedResultRef.current;
    if (!currentSession || !currentResult) {
      console.error('[handleCardConfirmed] missing session or selectedResult', { session: !!currentSession, selectedResult: !!currentResult });
      setSubmitError('Session expired — please get a new quote.');
      setStep('details');
      return;
    }
    setSubmitError('');
    try {
      const req = currentSession.payload.request;
      const payload = {
        pickupAddress: req.pickup_address,
        dropoffAddress: req.dropoff_address,
        pickupAtUtc: req.pickup_at_utc,
        serviceTypeId: req.service_type_id,
        vehicleClassId: currentResult.service_class_id,
        totalPriceMinor: loyaltyDiscount?.finalFareMinor ?? currentResult.estimated_total_minor,
        discountMinor:   loyaltyDiscount?.discountMinor ?? 0,
        currency: currentResult.currency,
        passengerCount: req.passenger_count,
        luggageCount: req.luggage_count ?? 0,
        flightNumber: flightNumber || undefined,
        notes: specialRequests || undefined,
        tripMode: req.trip_mode,
        infantSeats: req.infant_seats ?? 0,
        toddlerSeats: req.toddler_seats ?? 0,
        boosterSeats: req.booster_seats ?? 0,
        quoteId: currentSession.id,
        setupIntentId,
        passengerFirstName: (!samePassenger ? passengerOverride.firstName : passengerDetails.firstName) || undefined,
        passengerLastName:  (!samePassenger ? passengerOverride.lastName  : passengerDetails.lastName)  || undefined,
        passengerPhone:     (!samePassenger
          ? (passengerOverride.phoneCode + passengerOverride.phoneNumber).trim()
          : (passengerDetails.phoneCode + passengerDetails.phoneNumber).trim()
        ) || undefined,
        ...(guestData && {
          guestCheckout: true,
          tenantSlug: process.env.NEXT_PUBLIC_TENANT_SLUG ?? 'aschauffeured',
          firstName: passengerDetails.firstName || guestData.firstName,
          lastName:  passengerDetails.lastName  || guestData.lastName,
          email:     passengerDetails.email     || guestData.email,
          phone:     (passengerDetails.phoneCode + passengerDetails.phoneNumber).trim() || guestData.phone,
        }),
      };

      // If no token in localStorage, treat as guest regardless of guestData state
      const currentToken = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
      const isGuest = !currentToken;
      const endpoint = (guestData || isGuest)
        ? '/customer-portal/guest/checkout'
        : '/customer-portal/bookings';

      // For implicit guest (token lost), build guestData from passengerDetails
      if (isGuest && !payload.guestCheckout) {
        Object.assign(payload, {
          guestCheckout: true,
          tenantSlug: process.env.NEXT_PUBLIC_TENANT_SLUG ?? 'aschauffeured',
          firstName: passengerDetails.firstName,
          lastName:  passengerDetails.lastName,
          email:     passengerDetails.email,
          phone:     (passengerDetails.phoneCode + passengerDetails.phoneNumber).trim(),
        });
      }

      const { data } = await api.post(endpoint, payload);
      setCreatedBooking(data?.booking ?? data);

      // Mark quote as converted
      await fetch(`${API_URL}/public/pricing/quote/${quoteIdRef.current}`, { method: 'PATCH' }).catch(() => {});
      sessionStorage.removeItem('book_quote_id');
      sessionStorage.removeItem('book_car_type_id');
      setStep('done');
    } catch (err: any) {
      const errData = err?.response?.data ?? err;
      console.error('[handleCardConfirmed] booking error:', JSON.stringify(errData));
      const msg = err.response?.data?.message ?? err?.message ?? 'Failed to create booking. Please try again.';
      setSubmitError(`Booking failed: ${msg}`);
      setStep('details');
    }
  // sessionRef + selectedResultRef are refs — no need in deps; always latest value
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loyaltyDiscount, flightNumber, specialRequests, guestData, passengerDetails, quoteId]);

  // ── Render helpers ──
  const [cityName, setCityName]           = useState('');
  const [serviceTypeName, setServiceTypeName] = useState('');

  useEffect(() => {
    if (!session) return;
    const req = session.payload.request;
    const slug = session.payload.slug || localStorage.getItem('tenant_slug') || '';
    // resolve city name
    fetch(`${API_URL}/public/cities?tenant_slug=${slug}`)
      .then(r => r.json()).then((cities: any[]) => {
        const c = cities.find(x => x.id === req.city_id);
        if (c) setCityName(c.name);
      }).catch(() => {});
    // resolve service type name
    fetch(`${API_URL}/public/service-types?tenant_slug=${slug}`)
      .then(r => r.json()).then((types: any[]) => {
        const t = types.find(x => x.id === req.service_type_id);
        if (t) setServiceTypeName(t.name);
      }).catch(() => {});
  }, [session]);

  const renderQuoteSummary = () => {
    if (!session || !selectedResult) return null;
    const req     = session.payload.request;
    const preview = selectedResult.pricing_snapshot_preview;
    const pickupDate = new Date(req.pickup_at_utc).toLocaleString('en-AU', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
      timeZone: req.timezone,
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
              {(() => {
                // Effective discount: loyalty takes priority, else base quote discount
                const baseDiscountMinor = selectedResult.pricing_snapshot_preview?.discount_amount_minor ?? 0;
                const effectiveDiscount = loyaltyDiscount ?? (baseDiscountMinor > 0 ? {
                  finalFareMinor: selectedResult.estimated_total_minor,
                  discountMinor: baseDiscountMinor,
                } : null);
                const originalPrice = loyaltyDiscount
                  ? selectedResult.estimated_total_minor  // quote already has base discount
                  : (selectedResult.pricing_snapshot_preview?.pre_discount_total_minor
                      ?? selectedResult.estimated_total_minor + baseDiscountMinor);
                const finalPrice = loyaltyDiscount
                  ? loyaltyDiscount.finalFareMinor
                  : selectedResult.estimated_total_minor;

                return (
                  <>
                    {effectiveDiscount && effectiveDiscount.discountMinor > 0 && (
                      <p className="text-xs text-[hsl(var(--muted-foreground))] line-through">
                        {fmtMoney(originalPrice, selectedResult.currency)}
                      </p>
                    )}
                    <p className={cn(
                      "text-lg font-bold",
                      effectiveDiscount ? "text-emerald-400" : "text-gradient-gold"
                    )}>
                      {fmtMoney(finalPrice, selectedResult.currency)}
                    </p>
                    {effectiveDiscount && effectiveDiscount.discountMinor > 0 && (
                      <p className="text-[11px] text-emerald-400 font-semibold">
                        -{fmtMoney(effectiveDiscount.discountMinor, selectedResult.currency)} off
                      </p>
                    )}
                  </>
                );
              })()}
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{selectedResult.currency} incl. GST</p>
            </div>
          </div>

          {/* Trip details */}
          <div className="space-y-2.5 text-xs">
            {/* City + Service row */}
            <div className="flex items-center gap-3 flex-wrap">
              {cityName && (
                <span className="flex items-center gap-1 text-[hsl(var(--muted-foreground))]">
                  <svg className="w-3 h-3 shrink-0 text-[hsl(var(--primary)/0.7)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="font-medium text-[hsl(var(--foreground)/0.8)]">{cityName}</span>
                </span>
              )}
              {serviceTypeName && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary)/0.9)] border border-[hsl(var(--primary)/0.2)]">
                  {serviceTypeName}
                </span>
              )}
              {req.trip_mode === 'RETURN' && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))]">
                  Return Trip
                </span>
              )}
            </div>

            {/* Pickup datetime */}
            <div className="flex items-start gap-2 text-[hsl(var(--muted-foreground))]">
              <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[hsl(var(--primary)/0.7)]" />
              <span className="font-medium text-[hsl(var(--foreground)/0.9)]">{pickupDate}</span>
            </div>

            {/* Pickup → Dropoff route */}
            <div className="relative pl-5">
              {/* vertical line */}
              <div className="absolute left-[6px] top-2 bottom-2 w-px bg-[hsl(var(--border))]" />

              {/* Pickup */}
              <div className="relative flex items-start gap-2 mb-3">
                <div className="absolute -left-5 mt-1 w-3 h-3 rounded-full bg-emerald-500/80 border-2 border-[hsl(var(--background))] shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground)/0.6)] mb-0.5">Pickup</p>
                  <p className="text-[hsl(var(--foreground)/0.85)] leading-snug">{req.pickup_address}</p>
                </div>
              </div>

              {/* Waypoints */}
              {req.waypoints?.filter(Boolean).map((wp, i) => (
                <div key={i} className="relative flex items-start gap-2 mb-3">
                  <div className="absolute -left-5 mt-1 w-3 h-3 rounded-full bg-amber-500/70 border-2 border-[hsl(var(--background))] shrink-0" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground)/0.6)] mb-0.5">Stop {i + 1}</p>
                    <p className="text-[hsl(var(--foreground)/0.85)] leading-snug">{wp}</p>
                  </div>
                </div>
              ))}

              {/* Dropoff */}
              {req.dropoff_address && req.dropoff_address !== req.pickup_address && (
                <div className="relative flex items-start gap-2">
                  <div className="absolute -left-5 mt-1 w-3 h-3 rounded-full bg-[hsl(var(--primary)/0.8)] border-2 border-[hsl(var(--background))] shrink-0" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground)/0.6)] mb-0.5">Drop-off</p>
                    <p className="text-[hsl(var(--foreground)/0.85)] leading-snug">{req.dropoff_address}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Return leg */}
            {req.trip_mode === 'RETURN' && (req.return_date || req.return_pickup_at_utc) && (
              <div className="border-t border-[hsl(var(--border)/0.5)] pt-3 space-y-2">
                <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--primary)/0.7)]" />
                  <span className="font-medium text-[hsl(var(--foreground)/0.9)]">
                    {req.return_pickup_at_utc
                      ? new Date(req.return_pickup_at_utc).toLocaleString('en-AU', {
                          weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                          hour: 'numeric', minute: '2-digit', hour12: true,
                          timeZone: req.timezone,
                        })
                      : `${req.return_date ?? ''} ${req.return_time ?? ''}`}
                  </span>
                  <span className="text-[10px] text-[hsl(var(--muted-foreground)/0.6)] uppercase tracking-wide">Return</span>
                </div>
                <div className="relative pl-5">
                  <div className="absolute left-[6px] top-2 bottom-2 w-px bg-[hsl(var(--border))]" />
                  <div className="relative flex items-start gap-2 mb-3">
                    <div className="absolute -left-5 mt-1 w-3 h-3 rounded-full bg-[hsl(var(--primary)/0.8)] border-2 border-[hsl(var(--background))] shrink-0" />
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground)/0.6)] mb-0.5">Pickup</p>
                      <p className="text-[hsl(var(--foreground)/0.85)] leading-snug">{req.dropoff_address ?? req.pickup_address}</p>
                    </div>
                  </div>
                  <div className="relative flex items-start gap-2">
                    <div className="absolute -left-5 mt-1 w-3 h-3 rounded-full bg-emerald-500/80 border-2 border-[hsl(var(--background))] shrink-0" />
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground)/0.6)] mb-0.5">Drop-off</p>
                      <p className="text-[hsl(var(--foreground)/0.85)] leading-snug">{req.pickup_address}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Pax / luggage / seats */}
            <div className="flex flex-wrap gap-3 text-[hsl(var(--muted-foreground))] pt-1 border-t border-[hsl(var(--border)/0.5)]">
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {req.passenger_count} passenger{req.passenger_count !== 1 ? 's' : ''}
              </span>
              {(req.luggage_count ?? 0) > 0 && (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  {req.luggage_count} bags
                </span>
              )}
              {(req.infant_seats ?? 0) > 0 && <span>{req.infant_seats}× infant seat (0–6m)</span>}
              {(req.toddler_seats ?? 0) > 0 && <span>{req.toddler_seats}× toddler seat (0–4yr)</span>}
              {(req.booster_seats ?? 0) > 0 && <span>{req.booster_seats}× booster seat (4–8yr)</span>}
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
              {(preview.waypoints_minor ?? 0) > 0 && (
                <div className="flex justify-between text-[hsl(var(--muted-foreground))]">
                  <span>+ {req.waypoints?.filter(Boolean).length ?? 1} waypoint stop{(req.waypoints?.filter(Boolean).length ?? 1) > 1 ? 's' : ''}</span>
                  <span>+{fmtMoney(preview.waypoints_minor!, selectedResult.currency)}</span>
                </div>
              )}
              {(req.infant_seats ?? 0) > 0 && (
                <div className="flex justify-between text-[hsl(var(--muted-foreground))]">
                  <span>+ {req.infant_seats}× infant seat (0–6m)</span>
                  <span>+{fmtMoney(Math.round((preview.baby_seats_minor ?? 0) * (req.infant_seats ?? 0) / Math.max(1, (req.infant_seats ?? 0) + (req.toddler_seats ?? 0) + (req.booster_seats ?? 0))), selectedResult.currency)}</span>
                </div>
              )}
              {(req.toddler_seats ?? 0) > 0 && (
                <div className="flex justify-between text-[hsl(var(--muted-foreground))]">
                  <span>+ {req.toddler_seats}× toddler seat (0–4yr)</span>
                  <span>+{fmtMoney(Math.round((preview.baby_seats_minor ?? 0) * (req.toddler_seats ?? 0) / Math.max(1, (req.infant_seats ?? 0) + (req.toddler_seats ?? 0) + (req.booster_seats ?? 0))), selectedResult.currency)}</span>
                </div>
              )}
              {(req.booster_seats ?? 0) > 0 && (
                <div className="flex justify-between text-[hsl(var(--muted-foreground))]">
                  <span>+ {req.booster_seats}× booster seat (4–8yr)</span>
                  <span>+{fmtMoney(Math.round((preview.baby_seats_minor ?? 0) * (req.booster_seats ?? 0) / Math.max(1, (req.infant_seats ?? 0) + (req.toddler_seats ?? 0) + (req.booster_seats ?? 0))), selectedResult.currency)}</span>
                </div>
              )}
              {/* Surcharge items — one row per surcharge */}
              {(preview.surcharge_items?.length
                ? preview.surcharge_items
                : preview.surcharge_minor > 0
                  ? [{ label: preview.surcharge_labels?.[0] ?? 'Surcharge', amount_minor: preview.surcharge_minor }]
                  : []
              ).map((item, i) => (
                <div key={i} className="flex justify-between text-amber-400/80">
                  <span className="flex items-center gap-1">
                    <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    {item.label}
                  </span>
                  <span>+{fmtMoney(item.amount_minor, selectedResult.currency)}</span>
                </div>
              ))}
              {(preview.toll_minor ?? 0) > 0 && (
                <div className="flex justify-between text-[hsl(var(--muted-foreground))]">
                  <span className="flex items-center gap-1">Road tolls</span>
                  <span>+{fmtMoney(preview.toll_minor!, selectedResult.currency)}</span>
                </div>
              )}
              {(preview.parking_minor ?? 0) > 0 && (
                <div className="flex justify-between text-[hsl(var(--muted-foreground))]">
                  <span className="flex items-center gap-1">Airport parking</span>
                  <span>+{fmtMoney(preview.parking_minor!, selectedResult.currency)}</span>
                </div>
              )}
              {/* Fallback: if toll/parking not broken out separately */}
              {preview.toll_parking_minor > 0 && !(preview.toll_minor ?? 0) && !(preview.parking_minor ?? 0) && (
                <div className="flex justify-between text-[hsl(var(--muted-foreground))]">
                  <span>Tolls / Parking</span>
                  <span>+{fmtMoney(preview.toll_parking_minor, selectedResult.currency)}</span>
                </div>
              )}
              {/* Loyalty discount row */}
              {loyaltyDiscount && loyaltyDiscount.discountMinor > 0 && (
                <div className="flex justify-between text-[hsl(var(--success))]">
                  <span>{loyaltyDiscount.discountName ?? 'Discount'} ({loyaltyDiscount.discountRate}%{loyaltyDiscount.cappedByMax ? ' capped' : ''})</span>
                  <span>-{fmtMoney(loyaltyDiscount.discountMinor, selectedResult.currency)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold pt-1 border-t border-[hsl(var(--border))]">
                <span className="text-[hsl(var(--foreground))]">Total</span>
                <span className={loyaltyDiscount?.discountMinor || (selectedResult.pricing_snapshot_preview?.discount_amount_minor ?? 0) > 0
                  ? "text-emerald-400"
                  : "text-[hsl(var(--foreground))]"
                }>
                  {fmtMoney(
                    loyaltyDiscount ? loyaltyDiscount.finalFareMinor : selectedResult.estimated_total_minor,
                    selectedResult.currency,
                  )}
                </span>
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

  // 'expired' step removed — handled inline via quoteError banner

  if (step === 'done') {
    const ref = createdBooking?.booking_reference;
    const pickup = session?.payload?.request?.pickup_address ?? createdBooking?.pickup_address_text;
    const dropoff = session?.payload?.request?.dropoff_address ?? createdBooking?.dropoff_address_text;
    const total = fmtMoney(
      loyaltyDiscount?.finalFareMinor ?? selectedResult?.estimated_total_minor ?? createdBooking?.total_price_minor ?? 0,
      selectedResult?.currency ?? 'AUD',
    );
    return (
      <div className="min-h-screen bg-[hsl(var(--background))]" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="max-w-sm mx-auto px-4 py-10 flex flex-col items-center text-center space-y-6">

          {/* Success icon */}
          <div className="w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500/30 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
          </div>

          <div>
            <h1 className="font-serif text-2xl font-semibold text-white">Thank You!</h1>
            <p className="text-sm text-white/50 mt-2 leading-relaxed">
              Your booking is confirmed. A confirmation email has been sent to your inbox.
            </p>
          </div>

          {/* Booking reference — most important thing */}
          {ref && (
            <div className="w-full rounded-2xl bg-[hsl(var(--primary)/0.1)] border border-[hsl(var(--primary)/0.3)] px-5 py-4">
              <p className="text-xs text-[hsl(var(--primary)/0.6)] uppercase tracking-widest mb-1">Booking Reference</p>
              <p className="font-mono text-xl font-bold text-[hsl(var(--primary))]">{ref}</p>
            </div>
          )}

          {/* Trip summary */}
          {pickup && (
            <div className="w-full rounded-2xl bg-white/[0.04] border border-white/8 px-4 py-4 text-left space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-wide">Pickup</p>
                  <p className="text-sm text-white/75 leading-snug">{pickup}</p>
                </div>
              </div>
              {dropoff && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-[hsl(var(--primary))] mt-1.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-wide">Drop-off</p>
                    <p className="text-sm text-white/75 leading-snug">{dropoff}</p>
                  </div>
                </div>
              )}
              <div className="border-t border-white/8 pt-3 flex items-center justify-between">
                <span className="text-sm text-white/40">Total charged</span>
                <span className="font-bold text-[hsl(var(--primary))]">{total}</span>
              </div>
            </div>
          )}

          {/* CTA / OTP for guest */}
          <div className="w-full space-y-3 pt-2">
            {token ? (
              // Logged-in user
              <Button size="lg" className="w-full" onClick={() => router.push('/bookings')}>
                View My Bookings
              </Button>
            ) : (
              // Guest — inline OTP to activate account
              <GuestActivateOtp
                email={guestData?.email ?? ''}
                phoneCode={guestData?.phoneCode ?? '+61'}
                phone={guestData?.phoneNumber ?? ''}
                bookingRef={ref ?? ''}
                onActivated={() => router.push('/bookings')}
              />
            )}
            <Button size="lg" variant="outline" className="w-full" onClick={() => router.push('/quote')}>
              Book Another Ride
            </Button>
          </div>

        </div>
      </div>
    );
  }

  // ── Main layout ──
  return (
    <div className="min-h-screen bg-[hsl(var(--background))]" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-20 border-b border-[hsl(var(--border))]"
        style={{
          background: 'rgba(13,15,20,0.97)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          paddingTop: 'max(12px, env(safe-area-inset-top))',
        }}
      >
        <div className="max-w-lg mx-auto px-4 pb-4 flex items-center gap-3">
          <BackButton fallback="/quote" />
          <h1 className="font-serif text-lg font-medium text-[hsl(var(--foreground))]">Complete Booking</h1>
        </div>
      </header>

      {/* Sticky error toast — booking submission failed */}
      {submitError && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-4 py-4 bg-red-950/95 border-b border-red-500/30 backdrop-blur"
          style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
          <p className="flex-1 text-sm text-red-200">{submitError}</p>
          <button onClick={() => setSubmitError('')} className="text-red-400/60 hover:text-red-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4" style={{ paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))' }}>

        {/* Inline error/expiry banner — never redirects, keeps form intact */}
        {quoteError && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25">
            <Timer className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-amber-300 leading-snug">{quoteError}</p>
              <button
                onClick={() => router.push('/quote')}
                className="mt-2 text-xs font-semibold text-amber-400 underline underline-offset-2"
              >
                Get a new quote →
              </button>
            </div>
            <button onClick={() => setQuoteError(null)} className="text-amber-400/50 hover:text-amber-400 transition-colors">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        )}

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
                onSuccess={() => { setStep('details'); fetchLoyaltyDiscount(); }}
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
              <div className="space-y-6">

                {/* Login reminder for guest users */}
                {!token && (
                  <div className="rounded-xl border border-[hsl(var(--primary)/0.35)] bg-[hsl(var(--primary)/0.07)] px-4 py-4 space-y-2">
                    <div className="flex items-center gap-2 text-[hsl(var(--primary))]">
                      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                      </svg>
                      <span className="text-sm font-semibold">Have an account?</span>
                    </div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      Sign in to apply your loyalty discount, save your details and track this booking.
                    </p>
                    <button
                      type="button"
                      onClick={() => setStep('auth')}
                      className="w-full mt-1 rounded-lg border border-[hsl(var(--primary)/0.5)] bg-[hsl(var(--primary)/0.12)] py-2 text-sm font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.2)] transition-colors"
                    >
                      Sign In / Create Account
                    </button>
                    <p className="text-center text-[10px] text-[hsl(var(--muted-foreground)/0.7)]">
                      Or continue below as a guest
                    </p>
                  </div>
                )}

                {/* submitError shown in sticky toast at top of page — see below */}

                {/* ── Your Details ── */}
                <div className="space-y-4">
                  <h2 className="font-semibold text-[hsl(var(--foreground))]">Your Details</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>First Name *</Label>
                      <Input value={passengerDetails.firstName} onChange={e => setPassengerDetails(p => ({ ...p, firstName: e.target.value }))} placeholder="John" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Last Name *</Label>
                      <Input value={passengerDetails.lastName} onChange={e => setPassengerDetails(p => ({ ...p, lastName: e.target.value }))} placeholder="Smith" required />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email *</Label>
                    <Input type="email" value={passengerDetails.email}
                      onChange={e => setPassengerDetails(p => ({ ...p, email: e.target.value }))}
                      placeholder="you@email.com" required={!!guestData}
                      readOnly={!!token && !guestData}
                      className={token && !guestData ? 'opacity-60 cursor-default' : ''}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone <span className="text-[hsl(var(--muted-foreground))] font-normal normal-case">(optional)</span></Label>
                    <div className="flex gap-2">
                      <PhoneCountrySelect value={passengerDetails.phoneCode} onChange={v => setPassengerDetails(p => ({ ...p, phoneCode: v }))} className="w-28 shrink-0" />
                      <Input type="tel" className="flex-1" value={passengerDetails.phoneNumber} onChange={e => setPassengerDetails(p => ({ ...p, phoneNumber: e.target.value }))} placeholder="400 000 000" />
                    </div>
                  </div>
                </div>

                {/* ── Passenger ── */}
                <div className="space-y-3 border-t border-[hsl(var(--border))] pt-5">
                  <h2 className="font-semibold text-[hsl(var(--foreground))]">Passenger</h2>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="radio" name="samePassenger" checked={samePassenger}
                        onChange={() => setSamePassenger(true)}
                        className="accent-[hsl(var(--primary))] w-4 h-4"
                      />
                      <span className="text-sm text-[hsl(var(--foreground))]">I am the passenger</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="radio" name="samePassenger" checked={!samePassenger}
                        onChange={() => setSamePassenger(false)}
                        className="accent-[hsl(var(--primary))] w-4 h-4"
                      />
                      <span className="text-sm text-[hsl(var(--foreground))]">Booking for someone else</span>
                    </label>
                  </div>

                  {!samePassenger && (
                    <div className="space-y-3 pt-1">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Passenger First Name *</Label>
                          <Input value={passengerOverride.firstName} onChange={e => setPassengerOverride(p => ({ ...p, firstName: e.target.value }))} placeholder="Jane" required />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Passenger Last Name *</Label>
                          <Input value={passengerOverride.lastName} onChange={e => setPassengerOverride(p => ({ ...p, lastName: e.target.value }))} placeholder="Smith" required />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Passenger Phone <span className="text-[hsl(var(--muted-foreground))] font-normal normal-case">(optional)</span></Label>
                        <div className="flex gap-2">
                          <PhoneCountrySelect value={passengerOverride.phoneCode} onChange={v => setPassengerOverride(p => ({ ...p, phoneCode: v }))} className="w-28 shrink-0" />
                          <Input type="tel" className="flex-1" value={passengerOverride.phoneNumber} onChange={e => setPassengerOverride(p => ({ ...p, phoneNumber: e.target.value }))} placeholder="400 000 000" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Flight / Special Requests ── */}
                <div className="space-y-3 border-t border-[hsl(var(--border))] pt-5">
                  <div className="space-y-1.5">
                    <Label>Flight Number <span className="text-[hsl(var(--muted-foreground))] font-normal normal-case">(optional)</span></Label>
                    <Input value={flightNumber} onChange={e => setFlightNumber(e.target.value)} placeholder="e.g. QF401" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Special Requests <span className="text-[hsl(var(--muted-foreground))] font-normal normal-case">(optional)</span></Label>
                    <textarea
                      className="w-full h-20 rounded-[--radius] border border-[hsl(var(--input-border))] bg-[hsl(var(--input))] px-3 py-2.5 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] resize-none focus:outline-none focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary)/0.15)] transition-colors"
                      placeholder="Preferred temperature, music, special requirements..."
                      value={specialRequests} onChange={e => setSpecialRequests(e.target.value)}
                    />
                  </div>
                </div>

                {/* ── Payment ── */}
                <div className="space-y-3 border-t border-[hsl(var(--border))] pt-5">
                  <h2 className="font-semibold text-[hsl(var(--foreground))]">Payment</h2>
                  {stripePromise && setupClientSecret ? (
                    <Elements stripe={stripePromise} options={{ locale: 'en-AU' }}>
                      <CardSetupForm
                        onSuccess={handleCardConfirmed}
                        isGuest={!!guestData}
                        billingName={`${passengerDetails.firstName} ${passengerDetails.lastName}`.trim() || undefined}
                        clientSecret={setupClientSecret}
                        submitLabel={`Confirm & Pay ${fmtMoney(
                          loyaltyDiscount?.finalFareMinor ?? selectedResult?.estimated_total_minor ?? 0,
                          selectedResult?.currency ?? 'AUD',
                        )}`}
                        submitting={submitting}
                        onValidate={() => {
                          console.log('[VALIDATE]', passengerDetails);
                          if (!passengerDetails.firstName.trim()) return 'Please enter your first name.';
                          if (!passengerDetails.lastName.trim()) return 'Please enter your last name.';
                          if (!passengerDetails.email.trim() || !/\S+@\S+\.\S+/.test(passengerDetails.email)) return 'Please enter a valid email address.';
                          if (!passengerDetails.phoneNumber.trim()) return 'Please enter your phone number.';
                          if (!samePassenger) {
                            if (!passengerOverride.firstName.trim()) return 'Please enter the passenger\'s first name.';
                            if (!passengerOverride.lastName.trim()) return 'Please enter the passenger\'s last name.';
                          }
                          return null;
                        }}
                      />
                    </Elements>
                  ) : (
                    <div className="flex items-center justify-center py-8 text-sm text-[hsl(var(--muted-foreground))] gap-2">
                      <Spinner className="h-4 w-4" />
                      {setupSecretLoading ? 'Loading payment…' : 'Initialising payment…'}
                    </div>
                  )}
                </div>

              </div>
            )}

          </CardContent>
        </Card>

      </main>

      <BookDebugPanel
        step={step}
        session={session}
        selectedResult={selectedResult}
        token={token}
        guestData={guestData}
        quoteId={quoteIdRef.current}
        carTypeId={carTypeIdRef.current}
        submitError={submitError}
      />
    </div>
  );
}
