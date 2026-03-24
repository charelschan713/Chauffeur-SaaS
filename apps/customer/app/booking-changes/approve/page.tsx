'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://chauffeur-saas-production.up.railway.app';

export default function BookingChangeApprovePage() {
  const params = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading'
  );
  const [message, setMessage] = useState<string>('Processing approval...');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Missing approval token.');
      return;
    }

    fetch(`${API_URL}/customer-portal/booking-changes/approve?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.message || 'Approval failed');
        }
        return res.json();
      })
      .then(() => {
        setStatus('success');
        setMessage('Approved. Your booking has been updated.');
      })
      .catch((e) => {
        setStatus('error');
        setMessage(e?.message || 'Approval failed');
      });
  }, [token]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <h1 className="text-2xl font-semibold text-white mb-3">
          {status === 'loading' ? 'Processing' : status === 'success' ? 'Approved' : 'Failed'}
        </h1>
        <p className="text-sm text-gray-300">{message}</p>
        {status === 'success' && (
          <a
            href="/bookings"
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-semibold"
          >
            View My Booking
          </a>
        )}
      </div>
    </div>
  );
}
