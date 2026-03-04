'use client';

import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  onClose: () => void;
  durationMs?: number;
  tone?: 'success' | 'error';
}

export function Toast({ message, onClose, durationMs = 2500, tone = 'success' }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => onClose(), durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, onClose]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-md shadow text-sm text-white ${
        tone === 'success' ? 'bg-green-600' : 'bg-red-600'
      }`}
    >
      {message}
    </div>
  );
}
