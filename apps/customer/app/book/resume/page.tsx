/**
 * /book/resume — Booking resume resolver
 *
 * Lightweight redirect-only page. On load:
 *  1. Calls GET /customer-portal/bookings/resume (requires auth)
 *  2. Routes:
 *     type=pending_booking → /bookings/[id]
 *     type=quote           → /book?quote_id=...&car_type_id=...  (future)
 *     type=none            → check localStorage quote draft, then /book
 *
 * This page contains no interactive UI — it is purely a resolver.
 * Auth guard is provided by the portal's existing redirect-to-login flow.
 */
import { Suspense } from 'react';
import { ResumeClient } from './ResumeClient';

export default function ResumePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#1A1A2E]">
          <div className="text-[#9CA3AF] text-sm">Resuming your booking…</div>
        </div>
      }
    >
      <ResumeClient />
    </Suspense>
  );
}
