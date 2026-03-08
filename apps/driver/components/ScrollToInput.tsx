'use client';
import { useEffect } from 'react';

/**
 * ScrollToInput — globally handles keyboard-obscured inputs on iOS.
 *
 * When a user taps any input/textarea/select:
 * 1. Wait for the keyboard to finish animating (~300ms)
 * 2. scrollIntoView with a 80px top offset so the input isn't hidden
 *    behind the sticky header either.
 *
 * Mount once in layout.tsx — no props needed.
 */
export function ScrollToInput() {
  useEffect(() => {
    const KEYBOARD_DELAY = 350; // ms — iOS keyboard animation duration

    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;

      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, KEYBOARD_DELAY);
    };

    document.addEventListener('focusin', onFocus, true);
    return () => document.removeEventListener('focusin', onFocus, true);
  }, []);

  return null;
}
