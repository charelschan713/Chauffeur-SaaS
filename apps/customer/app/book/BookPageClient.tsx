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
function CardSetupForm({ onSuccess, onCancel, isGuest, guestName }: {
  onSuccess: (setupIntentId: string) => void;
  onCancel: () => void;
  isGuest?: boolean;
  guestName?: string;
}) {
  const stripe   = useStripe();
  const elements = useElements();
  const { token } = useAuthStore();
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [cardholderName, setCardholderName] = useState(guestName ?? '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    if (!cardholderName.trim()) { setError('Please enter the name on your card.'); return; }
    setLoading(true);
    setError('');
    try {
      let clientSecret: string;
      if (isGuest || !token) {
        // Guest: use public endpoint (no auth)
        const slug = typeof window !== 'undefined'
          ? (document.cookie.split('; ').find(r => r.startsWith('tenant_slug='))?.split('=')[1]
              || window.location.hostname.split('.')[0]
              || 'aschauffeured')
          : 'aschauffeured';
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'https://chauffeur-saas-production.up.railway.app'}/customer-portal/payments/guest-setup-intent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? 'Failed to initialise payment');
        clientSecret = data.clientSecret;
      } else {
        const { data: si } = await api.post('/customer-portal/payments/setup-intent');
        clientSecret = si.clientSecret;
      }

      // return_url is required for redirect-based 3DS (some banks redirect instead of iframe)
      // For iframe-based 3DS, confirmCardSetup handles it automatically and returns 'succeeded'
      const returnUrl = `${window.location.origin}/book?quote_id=${new URLSearchParams(window.location.search).get('quote_id') ?? ''}&3ds=1`;
      const { setupIntent, error: stripeErr } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
          billing_details: { name: cardholderName.trim() },
        },
        return_url: returnUrl,
      });
      // confirmCardSetup handles 3DS inline — if it returns, authentication is complete or failed
      if (stripeErr) throw new Error(stripeErr.message);
      if (!setupIntent || setupIntent.status !== 'succeeded') throw new Error('Card verification failed. Please try again.');
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
        <Label className="mb-2 block">Name on Card</Label>
        <Input
          value={cardholderName}
          onChange={e => setCardholderName(e.target.value)}
          placeholder="As it appears on your card"
          required
          autoComplete="cc-name"
        />
      </div>
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
          <Input className="w-20 shrink-0" value={form.phoneCode} onChange={f('phoneCode')} placeholder="+61" />
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
type Step = 'loading' | 'expired' | 'auth' | 'login' | 'guest' | 'details' | 'card' | 'done';

export function BookPageClient() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { token, hydrate } = useAuthStore();

  const quoteId    = searchParams.get('quote_id');
  const carTypeId  = searchParams.get('car_type_id');

  const [step, setStep]             = useState<Step>('loading');
  const [session, setSession]       = useState<QuoteSession | null>(null);

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
        if (token) {
          setStep('details');
        } else setStep('auth');
      })
      .catch(() => setStep('expired'));
  }, [quoteId, carTypeId, token]);

  // Handle quote expiry
  useEffect(() => {
    if (countdown.expired && step !== 'loading' && step !== 'expired' && step !== 'done') {
      setStep('expired');
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
    if (token && selectedResult && (step === 'details' || step === 'card')) {
      fetchLoyaltyDiscount();
    }
  }, [token, selectedResult, step, fetchLoyaltyDiscount]);

  // Pre-fill passenger details from profile (logged-in) or guestData
  useEffect(() => {
    if (guestData) {
      // Guest phone may be combined (e.g. "+61400000000") — split out the code
      const rawPhone: string = guestData.phone ?? '';
      const codeMatch = rawPhone.match(/^(\+\d{1,3})(.*)/);
      setPassengerDetails({
        firstName:   guestData.firstName ?? '',
        lastName:    guestData.lastName  ?? '',
        email:       guestData.email     ?? '',
        phoneCode:   codeMatch ? codeMatch[1] : '+61',
        phoneNumber: codeMatch ? codeMatch[2].trim() : rawPhone,
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

  // ── Submit booking details ──
  // Details step: just validate + move to card (no booking created yet)
  const handleDetailsSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !selectedResult) return;
    setSubmitError('');
    setStep('card');
  }, [session, selectedResult]);

  // Card confirmed: NOW create the booking (only after payment card saved)
  const handleCardConfirmed = useCallback(async (setupIntentId: string) => {
    if (!session || !selectedResult) return;
    setSubmitError('');
    try {
      const req = session.payload.request;
      const payload = {
        pickupAddress: req.pickup_address,
        dropoffAddress: req.dropoff_address,
        pickupAtUtc: req.pickup_at_utc,
        serviceTypeId: req.service_type_id,
        vehicleClassId: selectedResult.service_class_id,
        totalPriceMinor: loyaltyDiscount?.finalFareMinor ?? selectedResult.estimated_total_minor,
        discountMinor:   loyaltyDiscount?.discountMinor ?? 0,
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
        setupIntentId,
        passengerFirstName: passengerDetails.firstName || undefined,
        passengerLastName:  passengerDetails.lastName  || undefined,
        passengerPhone:     (passengerDetails.phoneCode + passengerDetails.phoneNumber).trim() || undefined,
        ...(guestData && {
          guestCheckout: true,
          firstName: passengerDetails.firstName || guestData.firstName,
          lastName:  passengerDetails.lastName  || guestData.lastName,
          email:     passengerDetails.email     || guestData.email,
          phone:     (passengerDetails.phoneCode + passengerDetails.phoneNumber).trim() || guestData.phone,
        }),
      };

      const endpoint = guestData
        ? '/customer-portal/guest-checkout'
        : '/customer-portal/bookings';

      const { data } = await api.post(endpoint, payload);
      setCreatedBooking(data?.booking ?? data);

      // Mark quote as converted
      await fetch(`${API_URL}/public/pricing/quote/${quoteId}`, { method: 'PATCH' }).catch(() => {});
      setStep('done');
    } catch (err: any) {
      setSubmitError(err.response?.data?.message ?? 'Failed to create booking');
      setStep('details');
    }
  }, [session, selectedResult, loyaltyDiscount, flightNumber, specialRequests, guestData, passengerDetails, quoteId]);

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
              {(req.infant_seats ?? 0) > 0 && <span>🧷 {req.infant_seats}× infant seat (0–6m)</span>}
              {(req.toddler_seats ?? 0) > 0 && <span>🪑 {req.toddler_seats}× toddler seat (0–4yr)</span>}
              {(req.booster_seats ?? 0) > 0 && <span>💺 {req.booster_seats}× booster seat (4–8yr)</span>}
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
                  <span className="flex items-center gap-1">🛣️ Road tolls</span>
                  <span>+{fmtMoney(preview.toll_minor!, selectedResult.currency)}</span>
                </div>
              )}
              {(preview.parking_minor ?? 0) > 0 && (
                <div className="flex justify-between text-[hsl(var(--muted-foreground))]">
                  <span className="flex items-center gap-1">🅿️ Airport parking</span>
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
              <form onSubmit={handleDetailsSubmit} className="space-y-5">
                <h2 className="font-semibold text-[hsl(var(--foreground))]">Contact Details</h2>

                {/* Login reminder for guest users */}
                {!token && (
                  <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-[hsl(var(--primary)/0.08)] border border-[hsl(var(--primary)/0.2)] text-sm">
                    <span className="text-[hsl(var(--muted-foreground))]">Already have an account? Get your loyalty discount.</span>
                    <button
                      type="button"
                      onClick={() => setStep('auth')}
                      className="shrink-0 font-semibold text-[hsl(var(--primary))] hover:underline"
                    >
                      Sign In
                    </button>
                  </div>
                )}

                {submitError && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-[hsl(var(--destructive)/0.1)] border border-[hsl(var(--destructive)/0.3)] text-sm text-[hsl(var(--destructive))]">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    {submitError}
                  </div>
                )}

                {/* Passenger name */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>First Name *</Label>
                    <Input
                      value={passengerDetails.firstName}
                      onChange={e => setPassengerDetails(p => ({ ...p, firstName: e.target.value }))}
                      placeholder="John"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Last Name *</Label>
                    <Input
                      value={passengerDetails.lastName}
                      onChange={e => setPassengerDetails(p => ({ ...p, lastName: e.target.value }))}
                      placeholder="Smith"
                      required
                    />
                  </div>
                </div>

                {/* Email — shown for logged-in too (read-only hint) */}
                <div className="space-y-1.5">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={passengerDetails.email}
                    onChange={e => setPassengerDetails(p => ({ ...p, email: e.target.value }))}
                    placeholder="passenger@email.com"
                    required={!!guestData}
                    readOnly={!!token && !guestData}
                    className={token && !guestData ? 'opacity-60 cursor-default' : ''}
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <Label>Phone <span className="text-[hsl(var(--muted-foreground))] font-normal normal-case">(optional)</span></Label>
                  <div className="flex gap-2">
                    <Input
                      className="w-20 shrink-0"
                      value={passengerDetails.phoneCode}
                      onChange={e => setPassengerDetails(p => ({ ...p, phoneCode: e.target.value }))}
                      placeholder="+61"
                    />
                    <Input
                      type="tel"
                      className="flex-1"
                      value={passengerDetails.phoneNumber}
                      onChange={e => setPassengerDetails(p => ({ ...p, phoneNumber: e.target.value }))}
                      placeholder="400 000 000"
                    />
                  </div>
                </div>

                <div className="border-t border-[hsl(var(--border))] pt-4 space-y-4">
                  {/* Flight number */}
                  <div className="space-y-1.5">
                    <Label>Flight Number <span className="text-[hsl(var(--muted-foreground))] font-normal normal-case">(optional)</span></Label>
                    <Input value={flightNumber} onChange={e => setFlightNumber(e.target.value)} placeholder="e.g. QF401" />
                  </div>

                  {/* Special requests */}
                  <div className="space-y-1.5">
                    <Label>Special Requests <span className="text-[hsl(var(--muted-foreground))] font-normal normal-case">(optional)</span></Label>
                    <textarea
                      className="w-full h-20 rounded-[--radius] border border-[hsl(var(--input-border))] bg-[hsl(var(--input))] px-3 py-2.5 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] resize-none focus:outline-none focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary)/0.15)] transition-colors"
                      placeholder="Preferred temperature, music, special requirements..."
                      value={specialRequests}
                      onChange={e => setSpecialRequests(e.target.value)}
                    />
                  </div>
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
                {stripePromise ? (
                  <Elements stripe={stripePromise}>
                    <CardSetupForm
                      onSuccess={handleCardConfirmed}
                      onCancel={() => setStep('details')}
                      isGuest={!!guestData}
                      guestName={guestData ? `${guestData.firstName ?? ''} ${guestData.lastName ?? ''}`.trim() : undefined}
                    />
                  </Elements>
                ) : (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
                    <Spinner className="h-4 w-4" /> Loading payment…
                  </div>
                )}
              </div>
            )}

          </CardContent>
        </Card>

      </main>
    </div>
  );
}
