'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { CreditCard, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { BackButton } from '@/components/BackButton';

const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

const CARD_BRANDS: Record<string, string> = {
  visa: '💳 Visa',
  mastercard: '💳 Mastercard',
  amex: '💳 Amex',
  discover: '💳 Discover',
};

// ── Add Card Form ───────────────────────────────────────────────────────────
function AddCardForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const stripe  = useStripe();
  const elements = useElements();
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    setSaving(true);
    setError('');
    try {
      const { data: { clientSecret } } = await api.post('/customer-portal/payments/setup-intent');
      const card = elements.getElement(CardElement);
      if (!card) throw new Error('Card element not ready');
      const { error: stripeErr, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card },
      });
      if (stripeErr) throw new Error(stripeErr.message);
      if (setupIntent?.payment_method) {
        await api.post('/customer-portal/payments/setup-confirm', {
          setupIntentId: setupIntent.id,
          paymentMethodId: setupIntent.payment_method,
        });
      }
      setSuccess(true);
      setTimeout(() => onSuccess(), 800);
    } catch (e: any) {
      setError(e.message ?? 'Failed to save card.');
    } finally {
      setSaving(false);
    }
  };

  if (success) return (
    <div className="flex items-center gap-2 p-4 text-emerald-400 text-sm">
      <CheckCircle2 className="h-4 w-4" /> Card saved successfully
    </div>
  );

  return (
    <div className="rounded-2xl bg-white/4 border border-white/8 p-4 space-y-4">
      <p className="text-sm font-medium text-white/80">Add New Card</p>
      <div className="p-3 rounded-xl bg-white border border-gray-200">
        <CardElement options={{
          hidePostalCode: true,
          style: {
            base: { fontSize: '15px', color: '#111', fontFamily: 'system-ui, sans-serif', '::placeholder': { color: '#9ca3af' } },
          },
        }} />
      </div>
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}
        </div>
      )}
      <div className="flex gap-3">
        <button onClick={handleSubmit} disabled={saving || !stripe}
          className="flex-1 py-2.5 rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm font-semibold disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Card'}
        </button>
        <button onClick={onCancel}
          className="px-4 py-2.5 rounded-xl border border-white/15 text-white/60 text-sm hover:text-white/80 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function PaymentMethodsPage() {
  const router   = useRouter();
  const qc       = useQueryClient();
  const [showAdd, setShowAdd]   = useState(false);
  const [stripePromise]         = useState(() => loadStripe(STRIPE_PK));

  const { data: methods = [], isLoading } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => api.get('/customer-portal/payment-methods').then(r => r.data),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/customer-portal/payment-methods/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-methods'] }),
  });

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  return (
    <div className="min-h-screen" style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-20 border-b border-white/[0.07] px-4 flex items-center gap-3"
        style={{
          background: 'rgba(13,15,20,0.97)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          paddingTop: 'max(12px, env(safe-area-inset-top))',
          paddingBottom: 12,
        }}
      >
        <BackButton fallback="/profile" />
        <h1 className="font-semibold text-white flex-1">Payment Methods</h1>
        <button onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[hsl(var(--primary)/0.15)] border border-[hsl(var(--primary)/0.3)] text-[hsl(var(--primary))] text-xs font-semibold">
          <Plus className="h-3.5 w-3.5" /> Add Card
        </button>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-5 space-y-4">
        {/* Add card form */}
        {showAdd && stripePromise && (
          <Elements stripe={stripePromise}>
            <AddCardForm
              onSuccess={() => { setShowAdd(false); qc.invalidateQueries({ queryKey: ['payment-methods'] }); }}
              onCancel={() => setShowAdd(false)}
            />
          </Elements>
        )}

        {/* Cards list */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-white/20 border-t-[hsl(var(--primary))] rounded-full animate-spin" />
          </div>
        ) : methods.length === 0 && !showAdd ? (
          <div className="text-center py-16 space-y-3">
            <CreditCard className="h-10 w-10 text-white/20 mx-auto" />
            <p className="text-white/40 text-sm">No saved cards</p>
            <button onClick={() => setShowAdd(true)}
              className="inline-block mt-2 px-5 py-2.5 rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm font-semibold">
              Add a Card
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {methods.map((m: any) => (
              <div key={m.id}
                className="flex items-center gap-4 p-4 rounded-2xl bg-white/4 border border-white/8">
                <div className="w-10 h-10 rounded-xl bg-[hsl(var(--primary)/0.12)] border border-[hsl(var(--primary)/0.2)] flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-[hsl(var(--primary))]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white/90">
                    {CARD_BRANDS[m.brand?.toLowerCase()] ?? `💳 ${m.brand ?? 'Card'}`} •••• {m.last4}
                  </p>
                  <p className="text-xs text-white/40">Expires {m.exp_month}/{m.exp_year}</p>
                </div>
                {m.is_default && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 font-semibold">Default</span>
                )}
                <button onClick={() => setConfirmDelete(m.id)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-all">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm bg-[hsl(228,12%,12%)] border border-white/10 rounded-2xl p-5 space-y-4">
            <p className="text-sm font-semibold text-white">Remove this card?</p>
            <p className="text-xs text-white/50">This card will be removed from your account.</p>
            <div className="flex gap-3">
              <button onClick={() => { deleteMut.mutate(confirmDelete); setConfirmDelete(null); }}
                className="flex-1 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-medium">
                Remove
              </button>
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/15 text-white/60 text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
