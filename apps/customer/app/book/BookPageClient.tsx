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
import { PhoneCountrySelect } from '@/components/PhoneCountrySelect';
import { BookDebugPanel } from '@/components/BookDebugPanel';
import {
  MapPin, Clock, Users, Car, ChevronRight,
  AlertCircle, CheckCircle2, Timer, ArrowLeft,
} from 'lucide-react';



const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://chauffeur-saas-production.up.railway.app';

// ── Types (extracted to lib/types/booking.ts) ──────────────────────────────
import type { QuoteSession, QuoteResult } from '@/lib/types/booking';

// ── Sub-components (extracted from this file) ────────────────────────────
import { useCountdown }     from '@/hooks/useCountdown';
import { CardSetupForm }    from '@/components/book/CardSetupForm';
import { AuthGate }         from '@/components/book/AuthGate';
import { InlineLoginForm }  from '@/components/book/InlineLoginForm';
import { GuestActivateOtp } from '@/components/book/GuestActivateOtp';
import { GuestForm }        from '@/components/book/GuestForm';


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
  const [selectedResult, setSelectedResult] = useState<QuoteResult | null>(null);
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
  const [savedCards, setSavedCards] = useState<any[]>([]);
  const savedCardsRef = useRef<any[]>([]);
  const [selectedSavedCard, setSelectedSavedCard] = useState<string | null>(null); // stripe_payment_method_id
  const selectedSavedCardRef = useRef<string | null>(null);
  const [useNewCard, setUseNewCard] = useState(false);
  const [savedCardsLoading, setSavedCardsLoading] = useState(false);

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
        // Write quote draft to localStorage so /book/resume can restore it
        try {
          if (qid) localStorage.setItem('asc_last_quote_id', qid);
          if (result?.service_class_id) localStorage.setItem('asc_last_car_type_id', result.service_class_id);
        } catch { /* non-fatal */ }
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

  // Fetch saved cards when logged in
  useEffect(() => {
    if (!token) return;
    // Always re-fetch when token changes (even if savedCards already populated)
    setSavedCardsLoading(true);
    api.get('/customer-portal/payment-methods').then(r => {
      const cards = r.data ?? [];
      setSavedCards(cards);
      savedCardsRef.current = cards;
      // Guard: only consider cards with a valid stripe_payment_method_id
      const validCards = cards.filter((c: any) => !!c.stripe_payment_method_id);
      if (validCards.length > 0) {
        const def = validCards.find((c: any) => c.is_default) ?? validCards[0];
        setSelectedSavedCard(def.stripe_payment_method_id);
        selectedSavedCardRef.current = def.stripe_payment_method_id;
        setUseNewCard(false);
        console.log('[BookPage] saved card selected:', def.stripe_payment_method_id);
      } else {
        console.log('[BookPage] no saved cards found');
      }
    }).catch((e) => console.error('[BookPage] fetch cards failed:', e?.message))
    .finally(() => setSavedCardsLoading(false));
  }, [token]);

  // Eagerly fetch setup intent when booking form loads so Stripe iframe has clientSecret
  useEffect(() => {
    const formVisible = step === 'details' || (step === 'auth' && !!guestData);
    if (!formVisible || setupClientSecret || setupSecretLoading) return;
    // Only need setup intent if using new card (or guest)
    if (token && savedCards.length > 0 && !useNewCard) return;
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
  }, [step, token, setupClientSecret, setupSecretLoading, savedCards, useNewCard]);

  // Details form submit — handled inside CardSetupForm; this is just a no-op wrapper
  const handleDetailsSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    // Card setup form has its own submit; outer form submit is a fallback no-op
  }, []);

  // Saved card pay — skip card setup, just submit booking with existing PM
  // handleSavedCardPay is defined after handleCardConfirmed below

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
        ...(setupIntentId.startsWith('__saved__')
          ? { paymentMethodId: setupIntentId.replace('__saved__:', '') || selectedSavedCard }
          : { setupIntentId }),
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
      // Clear quote draft from localStorage (booking completed)
      try {
        localStorage.removeItem('asc_last_quote_id');
        localStorage.removeItem('asc_last_car_type_id');
      } catch { /* non-fatal */ }
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
  }, [loyaltyDiscount, flightNumber, specialRequests, guestData, passengerDetails, quoteId, selectedSavedCard]);

  // Saved card pay — skip card setup, just submit booking with existing PM
  const handleSavedCardPay = useCallback(async () => {
    // Validate passenger details
    if (!passengerDetails.firstName.trim()) { setSubmitError('Please enter your first name.'); return; }
    if (!passengerDetails.lastName.trim())  { setSubmitError('Please enter your last name.'); return; }
    // Read from refs to avoid stale closure — always latest value
    const cardId = selectedSavedCardRef.current ?? savedCardsRef.current.find((c: any) => !!c.stripe_payment_method_id)?.stripe_payment_method_id;
    // Distinguish between "no saved cards" and "cards exist but PM id missing (malformed API response)"
    if (!cardId) {
      const hasSavedCards = savedCardsRef.current.length > 0;
      setSubmitError(hasSavedCards
        ? 'Saved card is invalid. Please refresh the page or add a new card.'
        : 'No payment card found. Please add a card.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      await handleCardConfirmed('__saved__:' + cardId);
    } finally {
      setSubmitting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passengerDetails, handleCardConfirmed]);

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
                const preview = selectedResult.pricing_snapshot_preview;

                // ── Effective discount ────────────────────────────────────
                // loyaltyDiscount replaces (not stacks on) the quote auto-discount.
                // loyaltyDiscount.finalFareMinor is computed from the pre-discount
                // base fare, so it is always the authoritative payable amount.
                const baseDiscountMinor = preview?.discount_amount_minor ?? 0;
                const effectiveDiscount = loyaltyDiscount ?? (baseDiscountMinor > 0 ? {
                  finalFareMinor: selectedResult.estimated_total_minor,
                  discountMinor:  baseDiscountMinor,
                } : null);

                // ── finalPrice ────────────────────────────────────────────
                // BUG FIX: use loyaltyDiscount.finalFareMinor when available.
                // estimated_total_minor has a separate auto-discount baked in
                // and must NOT be shown as the final when loyalty overrides it.
                const finalPrice =
                  effectiveDiscount?.finalFareMinor ?? selectedResult.estimated_total_minor;

                // ── originalPrice (crossed-out base) ──────────────────────
                // Source priority: pre_discount_fare_minor → base_calculated_minor → fallback.
                // NEVER compute as finalPrice + discount when loyalty is active,
                // because finalPrice has already been discounted and the discount
                // rate was applied against the pre-discount base, not the final.
                const tollMinor     = preview?.toll_parking_minor ?? 0;
                const preDiscountFare =
                  (preview?.pre_discount_fare_minor ?? preview?.base_calculated_minor ?? 0);
                const discountMinor = effectiveDiscount?.discountMinor ?? 0;

                // Fallback: if snapshot is missing, add back discount to final.
                // This is safe only when loyaltyDiscount is NOT active (loyalty
                // final already absorbed the auto-discount; using it as base
                // would under-report the original).
                const originalPrice = preDiscountFare > 0
                  ? preDiscountFare + tollMinor
                  : loyaltyDiscount
                    ? finalPrice + discountMinor  // loyalty active, snapshot missing — best effort
                    : selectedResult.estimated_total_minor + discountMinor;

                // ── Debug log ─────────────────────────────────────────────
                if (process.env.NODE_ENV !== 'production') {
                  console.log('[BookPageClient] summary prices', {
                    source:            'renderQuoteSummary header',
                    baseFare:          preDiscountFare,
                    preDiscountTotal:  preDiscountFare + tollMinor,
                    loyaltyDiscount:   loyaltyDiscount?.discountMinor,
                    promoDiscount:     null,
                    totalDiscount:     discountMinor,
                    finalPayable:      finalPrice,
                    estimatedTotal:    selectedResult.estimated_total_minor,
                    originalDisplay:   originalPrice,
                    toll:              tollMinor,
                  });
                }

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

              {/* Dropoff — always show if there's a dropoff (even same as pickup when there are waypoints) */}
              {req.dropoff_address && (req.dropoff_address !== req.pickup_address || (req.waypoints?.filter(Boolean).length ?? 0) > 0) && (
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
                          timeZone: req.timezone ?? 'Australia/Sydney',
                        })
                      : (() => {
                          const d = req.return_date ? new Date(`${req.return_date}T${req.return_time ?? '00:00'}`) : null;
                          return d ? d.toLocaleString('en-AU', {
                            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                            hour: 'numeric', minute: '2-digit', hour12: true,
                          }) : `${req.return_date ?? ''} ${req.return_time ?? ''}`;
                        })()}
                  </span>
                  <span className="text-[10px] text-[hsl(var(--muted-foreground)/0.6)] uppercase tracking-wide">Return</span>
                </div>
                <div className="relative pl-5">
                  <div className="absolute left-[6px] top-2 bottom-2 w-px bg-[hsl(var(--border))]" />
                  {/* Return leg: reversed route — pickup = outbound dropoff, dropoff = outbound pickup */}
                  <div className="relative flex items-start gap-2 mb-3">
                    <div className="absolute -left-5 mt-1 w-3 h-3 rounded-full bg-emerald-500/80 border-2 border-[hsl(var(--background))] shrink-0" />
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground)/0.6)] mb-0.5">Pickup</p>
                      <p className="text-[hsl(var(--foreground)/0.85)] leading-snug">{req.dropoff_address ?? req.pickup_address}</p>
                    </div>
                  </div>
                  {/* Return waypoints: reversed order of outbound stops */}
                  {[...(req.waypoints?.filter(Boolean) ?? [])].reverse().map((wp: string, i: number) => (
                    <div key={i} className="relative flex items-start gap-2 mb-3">
                      <div className="absolute -left-5 mt-1 w-3 h-3 rounded-full bg-amber-500/70 border-2 border-[hsl(var(--background))] shrink-0" />
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground)/0.6)] mb-0.5">Stop {i + 1}</p>
                        <p className="text-[hsl(var(--foreground)/0.85)] leading-snug">{wp}</p>
                      </div>
                    </div>
                  ))}
                  <div className="relative flex items-start gap-2">
                    <div className="absolute -left-5 mt-1 w-3 h-3 rounded-full bg-[hsl(var(--primary)/0.8)] border-2 border-[hsl(var(--background))] shrink-0" />
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
          {((preview.pre_discount_fare_minor ?? preview.base_calculated_minor ?? 0) > 0 || preview.toll_parking_minor > 0) && (
            <div className="space-y-1 text-xs border-t border-[hsl(var(--border))] pt-2">
              {/* Base fare = pre_discount_fare_minor (already includes base + waypoints + baby seats, no toll) */}
              {(preview.pre_discount_fare_minor ?? preview.base_calculated_minor ?? 0) > 0 && (
                <div className="flex justify-between text-[hsl(var(--muted-foreground))]">
                  <span>Base fare</span>
                  <span>{fmtMoney(
                    preview.pre_discount_fare_minor ?? preview.base_calculated_minor ?? 0,
                    selectedResult.currency
                  )}</span>
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
              {/* Discount row — show from loyalty (logged in) or snapshot (guest/not yet loaded) */}
              {process.env.NODE_ENV !== 'production' && (() => {
                const _baseFare   = preview.pre_discount_fare_minor ?? preview.base_calculated_minor ?? 0;
                const _toll       = preview.toll_parking_minor ?? 0;
                const _loyaltyD   = loyaltyDiscount?.discountMinor ?? 0;
                const _promoD     = 0; // reserved for future promo codes
                const _totalD     = _loyaltyD || preview.discount_amount_minor || 0;
                const _final      = loyaltyDiscount?.finalFareMinor ?? selectedResult.estimated_total_minor;
                console.log('[BookPageClient] breakdown prices', {
                  source:           'renderQuoteSummary breakdown',
                  baseFare:         _baseFare,
                  preDiscountTotal: _baseFare + _toll,
                  loyaltyDiscount:  _loyaltyD,
                  promoDiscount:    _promoD,
                  totalDiscount:    _totalD,
                  finalPayable:     _final,
                  estimatedTotal:   selectedResult.estimated_total_minor,
                  toll:             _toll,
                });
                return null;
              })()}
              {(() => {
                const discMinor = loyaltyDiscount?.discountMinor ?? preview.discount_amount_minor ?? 0;
                const discLabel = loyaltyDiscount
                  ? `${loyaltyDiscount.discountName ?? 'Discount'} (${loyaltyDiscount.discountRate}%${loyaltyDiscount.cappedByMax ? ' capped' : ''})`
                  : preview.discount_type === 'PERCENTAGE'
                    ? `Discount (${preview.discount_value ?? ''}%)`
                    : 'Discount';
                if (discMinor <= 0) return null;
                return (
                  <div className="flex justify-between text-emerald-400">
                    <span>{discLabel}</span>
                    <span>-{fmtMoney(discMinor, selectedResult.currency)}</span>
                  </div>
                );
              })()}
              <div className="flex justify-between font-semibold pt-1 border-t border-[hsl(var(--border))]">
                <span className="text-[hsl(var(--foreground))]">Total</span>
                <span className={loyaltyDiscount?.discountMinor || (selectedResult.pricing_snapshot_preview?.discount_amount_minor ?? 0) > 0
                  ? "text-emerald-400"
                  : "text-[hsl(var(--foreground))]"
                }>
                  {/* Always match the CTA amount — loyalty finalFareMinor takes priority over raw estimated_total */}
                  {fmtMoney(loyaltyDiscount?.finalFareMinor ?? selectedResult.estimated_total_minor, selectedResult.currency)}
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
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
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
            <div className="w-full rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] px-4 py-4 text-left space-y-3">
              {/* Outbound leg */}
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Pickup</p>
                  <p className="text-sm text-white/75 leading-snug">{pickup}</p>
                </div>
              </div>
              {/* Waypoints */}
              {session?.payload?.request?.waypoints?.filter(Boolean).map((wp: string, i: number) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Stop {i + 1}</p>
                    <p className="text-sm text-white/75 leading-snug">{wp}</p>
                  </div>
                </div>
              ))}
              {dropoff && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-[hsl(var(--primary))] mt-1.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">Drop-off</p>
                    <p className="text-sm text-white/75 leading-snug">{dropoff}</p>
                  </div>
                </div>
              )}
              {/* Return leg indicator */}
              {session?.payload?.request?.trip_mode === 'RETURN' && (
                <div className="border-t border-[hsl(var(--border)/0.5)] pt-2 flex items-center gap-2">
                  <span className="text-[10px] text-[hsl(var(--primary)/0.7)] uppercase tracking-widest font-semibold">+ Return leg included</span>
                </div>
              )}
              <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                <span className="text-sm text-gray-400">Total charged</span>
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
            {/* Return to website */}
            <div className="pt-2 flex justify-center">
              <a
                href={typeof window !== 'undefined' && window.location.hostname.includes('chauffeurssolution') ? `https://${window.location.hostname.split('.')[0]}.com.au` : 'https://aschauffeured.com.au'}
                className="text-xs font-medium transition-opacity hover:opacity-70"
                style={{ color: '#C8A870' }}
              >
                ← Return to Website
              </a>
            </div>
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
          background: 'hsl(var(--background))',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          paddingTop: 'max(12px, env(safe-area-inset-top))',
        }}
      >
        <div className="max-w-lg mx-auto px-4 pb-4 flex items-center gap-3">
          <button
            onClick={() => router.replace('/quote')}
            aria-label="Back to quote"
            className="flex items-center justify-center w-10 h-10 rounded-full text-white/60 bg-white/[0.06] border border-white/[0.08] active:bg-white/12 active:scale-90 transition-all shrink-0"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
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

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4" style={{ paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))' }}>

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

                  {/* Saved cards (logged-in only) */}
                  {token && savedCards.length > 0 && (
                    <div className="space-y-2">
                      {savedCards.map((c: any) => {
                        // Guard: skip cards missing stripe_payment_method_id — they cannot be charged
                        const pmId: string | undefined = c.stripe_payment_method_id;
                        if (!pmId) return null;
                        const isSelected = !useNewCard && selectedSavedCard === pmId;
                        return (
                          <button key={pmId} type="button"
                            onClick={() => { setSelectedSavedCard(pmId); selectedSavedCardRef.current = pmId; setUseNewCard(false); }}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                              isSelected
                                ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.08)]'
                                : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.5)]'
                            }`}>
                            <div className="w-8 h-5 rounded bg-[hsl(var(--muted))] flex items-center justify-center text-[9px] font-bold uppercase text-[hsl(var(--muted-foreground))]">
                              {c.brand?.slice(0,4)}
                            </div>
                            <div className="flex-1">
                              <span className="text-sm font-medium capitalize">{c.brand}</span>
                              <span className="text-sm text-[hsl(var(--muted-foreground))] ml-2">•••• {c.last4}</span>
                            </div>
                            <span className="text-xs text-[hsl(var(--muted-foreground))]">{c.exp_month}/{c.exp_year}</span>
                            {isSelected && (
                              <div className="w-4 h-4 rounded-full border-2 border-[hsl(var(--primary))] flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-[hsl(var(--primary))]" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                      <button type="button"
                        onClick={() => { setUseNewCard(true); setSelectedSavedCard(null); }}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                          useNewCard
                            ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.08)]'
                            : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.5)]'
                        }`}>
                        <span className="text-sm">+ Use a different card</span>
                      </button>

                      {/* Confirm & Pay for saved card is in the sticky bottom bar below */}
                    </div>
                  )}

                  {/* New card form (guest or no saved cards or useNewCard) */}
                  {(!token || savedCards.length === 0 || useNewCard) && (
                    stripePromise && setupClientSecret ? (
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
                    )
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

      {/* Sticky Confirm & Pay bar — always visible at bottom */}
      {/* Sticky Confirm & Pay — shows whenever saved cards exist and not using new card */}
      {step === 'details' && savedCards.length > 0 && !useNewCard && (
        <div className="fixed bottom-0 left-0 right-0 z-[9999] px-4"
          style={{
            background: 'hsl(var(--background))',
            borderTop: '1px solid hsl(var(--border))',
            paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
            paddingTop: '12px',
          }}>
          <div className="max-w-lg mx-auto">
            <button type="button" disabled={submitting || savedCardsLoading}
              onClick={handleSavedCardPay}
              className="w-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-xl py-4 font-semibold text-sm disabled:opacity-60">
              {submitting ? 'Processing…' : savedCardsLoading ? 'Loading card…' : selectedResult
                ? `Confirm & Pay ${fmtMoney(loyaltyDiscount?.finalFareMinor ?? selectedResult.estimated_total_minor, selectedResult.currency)}`
                : 'Confirm & Pay'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
