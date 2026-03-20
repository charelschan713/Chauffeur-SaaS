'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/errors';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  bookingRef: string;
  totalMinor: number;
  currency: string;
  customerEmail: string;
  paymentStatus: string;
  onUpdated: () => void;
}

function formatMinor(minor: number, currency: string) {
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

export function PaymentModal({
  isOpen,
  onClose,
  bookingId,
  bookingRef,
  totalMinor,
  currency,
  customerEmail,
  paymentStatus,
  onUpdated,
}: PaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleMarkPaid() {
    setLoading(true); setError(null);
    try {
      await api.post(`/bookings/${bookingId}/mark-paid`);
      setSuccess('Marked as paid');
      onUpdated();
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to mark as paid'));
    } finally { setLoading(false); }
  }

  async function handleSendPayLink() {
    setLoading(true); setError(null);
    try {
      await api.post(`/bookings/${bookingId}/send-payment-link`);
      setSuccess(`Payment link sent to ${customerEmail}`);
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Failed to send payment link'));
    } finally { setLoading(false); }
  }

  async function handleChargeNow() {
    setLoading(true); setError(null);
    try {
      await api.post(`/bookings/${bookingId}/charge`);
      setSuccess('Payment charged successfully');
      onUpdated();
    } catch (e: any) {
      setError(getApiErrorMessage(e, 'Charge failed'));
    } finally { setLoading(false); }
  }

  const isPaid = ['PAID', 'SETTLED'].includes(paymentStatus);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h3 className="font-semibold text-gray-900">Payment</h3>
            <p className="text-xs text-gray-500 mt-0.5">{bookingRef}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Amount */}
          <div className="bg-gray-50 rounded-lg p-4 flex justify-between items-center">
            <span className="text-sm text-gray-600">Total Amount</span>
            <span className="text-xl font-bold text-gray-900">{formatMinor(totalMinor, currency)}</span>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Status:</span>
            <span className={`font-semibold ${isPaid ? 'text-green-600' : 'text-orange-500'}`}>
              {paymentStatus}
            </span>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">{success}</div>
          )}

          {!isPaid && (
            <div className="space-y-2">
              {/* Send pay link */}
              <button
                onClick={handleSendPayLink}
                disabled={loading}
                className="w-full flex items-center justify-between px-4 py-3 border border-blue-200 rounded-lg hover:bg-blue-50 text-sm text-blue-700 disabled:opacity-50"
              >
                <span className="font-medium">📧 Send Payment Link</span>
                <span className="text-xs text-blue-400">Email to {customerEmail}</span>
              </button>

              {/* Charge saved card */}
              <button
                onClick={handleChargeNow}
                disabled={loading}
                className="w-full flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm text-gray-700 disabled:opacity-50"
              >
                <span className="font-medium">💳 Charge Saved Card</span>
                <span className="text-xs text-gray-400">Via Stripe</span>
              </button>

              {/* Manual mark paid */}
              <button
                onClick={handleMarkPaid}
                disabled={loading}
                className="w-full flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm text-gray-700 disabled:opacity-50"
              >
                <span className="font-medium">✅ Mark as Paid</span>
                <span className="text-xs text-gray-400">Cash / EFT / Other</span>
              </button>
            </div>
          )}

          {isPaid && (
            <p className="text-sm text-center text-gray-500">This booking has already been paid.</p>
          )}
        </div>

        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full border rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
