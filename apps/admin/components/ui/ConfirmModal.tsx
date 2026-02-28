'use client';
import { ReactNode } from 'react';

interface ConfirmModalProps {
  title: string;
  description?: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  confirmText?: string;
  confirmTone?: 'primary' | 'danger';
  loading?: boolean;
  children?: ReactNode;
}

export function ConfirmModal({
  title,
  description,
  isOpen,
  onClose,
  onConfirm,
  confirmText = 'Confirm',
  confirmTone = 'primary',
  loading,
  children,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const confirmColor =
    confirmTone === 'danger'
      ? 'bg-red-600 hover:bg-red-700'
      : 'bg-blue-600 hover:bg-blue-700';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold mb-1">{title}</h3>
          {description && <p className="text-sm text-gray-600">{description}</p>}
        </div>
        <div className="p-6 space-y-4">
          {children}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`px-4 py-2 rounded text-white ${confirmColor} disabled:opacity-60`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
