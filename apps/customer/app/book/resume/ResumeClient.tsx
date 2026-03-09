'use client';
/**
 * ResumeClient — resolves the best "continue booking" destination and redirects.
 *
 * Resolution order:
 *  1. API: GET /customer-portal/bookings/resume
 *     → pending_booking  → /bookings/[id]
 *     → none             → fall through to step 2
 *  2. localStorage quote draft (written by BookPageClient after a successful quote)
 *     → /book?quote_id=...&car_type_id=...
 *  3. Fallback → /book  (start fresh)
 *
 * If unauthenticated, the existing api.ts 401 interceptor will redirect to /login
 * with redirect=/book/resume already in the return URL from the website menu.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

// localStorage keys for quote draft (written by BookPageClient)
const DRAFT_QUOTE_KEY    = 'asc_last_quote_id';
const DRAFT_CAR_TYPE_KEY = 'asc_last_car_type_id';

function readLocalQuoteDraft(): { quoteId: string; carTypeId: string } | null {
  try {
    const quoteId   = localStorage.getItem(DRAFT_QUOTE_KEY);
    const carTypeId = localStorage.getItem(DRAFT_CAR_TYPE_KEY);
    if (quoteId) return { quoteId, carTypeId: carTypeId ?? '' };
  } catch {}
  return null;
}

export function ResumeClient() {
  const router = useRouter();
  const token  = useAuthStore((s) => s.token);

  useEffect(() => {
    // If no token, portal auth guard will catch the 401 and redirect to login
    const resolve = async () => {
      try {
        const { data } = await api.get('/customer-portal/bookings/resume');

        if (data.type === 'pending_booking' && data.booking_id) {
          router.replace(`/bookings/${data.booking_id}`);
          return;
        }

        if (data.type === 'quote' && data.quote_id) {
          const params = new URLSearchParams({ quote_id: data.quote_id });
          if (data.car_type_id) params.set('car_type_id', data.car_type_id);
          router.replace(`/book?${params}`);
          return;
        }

        // type === 'none' — check localStorage quote draft
        const draft = readLocalQuoteDraft();
        if (draft?.quoteId) {
          const params = new URLSearchParams({ quote_id: draft.quoteId });
          if (draft.carTypeId) params.set('car_type_id', draft.carTypeId);
          router.replace(`/book?${params}`);
          return;
        }

        // Nothing to resume — start fresh
        router.replace('/book');
      } catch {
        // Auth error (401) is handled by api.ts interceptor → redirect to login
        // Any other error → fall back to /book
        router.replace('/book');
      }
    };

    resolve();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1A1A2E]">
      <div className="text-[#9CA3AF] text-sm">Resuming your booking…</div>
    </div>
  );
}
