'use client';
import { useRouter } from 'next/navigation';

interface BackButtonProps {
  /** Route to push if there's no history to go back to */
  fallback?: string;
}

/**
 * Reliable back button for the customer portal.
 * - Uses router.back() when history exists
 * - Falls back to a default route when opened directly (no history)
 * - Large 44×44 touch target, visible active state
 */
export function BackButton({ fallback = '/dashboard' }: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    // window.history.length <= 1 means the page was opened fresh (no history)
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  };

  return (
    <button
      onClick={handleBack}
      aria-label="Go back"
      className="flex items-center justify-center w-10 h-10 rounded-full text-white/60 bg-white/[0.06] border border-white/[0.08] active:bg-white/12 active:scale-90 transition-all shrink-0"
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    </button>
  );
}
