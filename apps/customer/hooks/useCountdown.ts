'use client';
import { useState, useEffect } from 'react';

/**
 * useCountdown — tick-based countdown to an ISO expiry timestamp.
 *
 * Returns { remaining, mins, secs, expired }
 * - remaining is null until first tick fires (prevents false expiry flash)
 * - expired is only true when remaining === 0 (not null)
 *
 * Extracted from BookPageClient.tsx (was inline).
 */
export function useCountdown(expiresAt: string) {
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
  // Only mark expired once we've actually computed a value (not null)
  return { remaining: remaining ?? 9999, mins, secs, expired: remaining === 0 };
}
