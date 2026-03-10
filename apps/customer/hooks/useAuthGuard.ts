'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * useAuthGuard — mount-time auth check for protected customer portal pages.
 *
 * Reads customer_token from localStorage on mount. If missing, immediately
 * router.replace('/login') before any API calls fire.
 *
 * This is a UX improvement over the 401 interceptor fallback:
 * - No flash of the page shell before redirect
 * - No unnecessary API call on unauthenticated load
 *
 * The 401 interceptor in lib/api.ts remains as the safety net for token
 * expiry mid-session. This guard handles the cold-load unauthenticated case.
 *
 * Usage:
 *   import { useAuthGuard } from '@/hooks/useAuthGuard';
 *   // In your page component:
 *   useAuthGuard();
 */
export function useAuthGuard() {
  const router = useRouter();
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('customer_token');
    if (!token) {
      router.replace('/login');
    }
  }, [router]);
}
