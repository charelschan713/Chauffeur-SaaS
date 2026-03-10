'use client';
/**
 * CardSetupForm — Stripe card-setup form embedded in the booking flow.
 *
 * Extracted from BookPageClient.tsx.
 * Must be rendered inside a Stripe <Elements> provider.
 *
 * Props:
 *   clientSecret      — Stripe SetupIntent client secret
 *   onSuccess(id)     — called with SetupIntent.id on success
 *   isGuest           — true when booking as guest
 *   billingName       — pre-filled billing name for Stripe
 *   submitLabel       — button label (default: "Confirm & Pay")
 *   submitting        — external loading state (e.g. booking is being created)
 *   onValidate()      — optional validation before Stripe is called;
 *                       return an error string to block, null to proceed
 */
import { useState } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircle } from 'lucide-react';

interface CardSetupFormProps {
  clientSecret:    string;
  onSuccess:       (setupIntentId: string) => void;
  isGuest?:        boolean;
  billingName?:    string;
  submitLabel?:    string;
  submitting?:     boolean;
  onValidate?:     () => string | null;
}

export function CardSetupForm({
  clientSecret, onSuccess, isGuest, billingName,
  submitLabel, submitting: externalSubmitting, onValidate,
}: CardSetupFormProps) {
  const stripe   = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    if (onValidate) {
      const validationError = onValidate();
      if (validationError) { setError(validationError); return; }
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
      if (stripeErr) throw new Error(stripeErr.message);
      if (!setupIntent || setupIntent.status !== 'succeeded')
        throw new Error('Card verification failed. Please try again.');
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
