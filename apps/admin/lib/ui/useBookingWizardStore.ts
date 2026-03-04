'use client';

import { useCallback, useEffect, useState } from 'react';

export type BookingWizardSection =
  | 'service'
  | 'datetime'
  | 'route'
  | 'requirements'
  | 'car'
  | 'extras';

export type BookingWizardDraft = {
  activeSection: BookingWizardSection;
  values: Record<string, any>;
  waypoints: string[];
};

const STORAGE_KEY = 'bookingWizardState';

function readStorage(): BookingWizardDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BookingWizardDraft;
  } catch {
    return null;
  }
}

function writeStorage(payload: BookingWizardDraft) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function useBookingWizardStore() {
  const [state, setState] = useState<BookingWizardDraft>(() => {
    return readStorage() ?? {
      activeSection: 'service',
      values: {},
      waypoints: [],
    };
  });

  useEffect(() => {
    writeStorage(state);
  }, [state]);

  const update = useCallback((partial: Partial<BookingWizardDraft>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const reset = useCallback(() => {
    const next = { activeSection: 'service' as BookingWizardSection, values: {}, waypoints: [] };
    setState(next);
    writeStorage(next);
  }, []);

  return { state, update, reset };
}
