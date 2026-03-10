'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Toast } from '@/components/ui/Toast';

const STATUS_STYLE: Record<string, { bg: string; label: string }> = {
  DRAFT:              { bg: 'bg-gray-100 text-gray-600',    label: 'Draft'              },
  SUBMITTED:          { bg: 'bg-blue-100 text-blue-700',    label: 'Submitted'          },
  PAID_BY_ADMIN:      { bg: 'bg-green-100 text-green-700',  label: 'Paid by Admin'      },
  RECEIVED_BY_DRIVER: { bg: 'bg-emerald-100 text-emerald-800', label: 'Received by Driver' },
  DISPUTED:           { bg: 'bg-red-100 text-red-700',      label: 'Disputed'           },
};

export default function DriverInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [payNotes, setPayNotes] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [showDisputeForm, setShowDisputeForm] = useState(false);

  const { data: inv, isLoading } = useQuery({
    queryKey: ['admin-driver-invoice', id],
    queryFn: async () => { const r = await api.get(`/admin/driver-invoices/${id}`); return r.data; },
    enabled: !!id,
  });

  const markPaidMutation = useMutation({
    mutationFn: () => api.patch(`/admin/driver-invoices/${id}/mark-paid`, { notes: payNotes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-driver-invoice', id] });
      qc.invalidateQueries({ queryKey: ['admin-driver-invoices'] });
      setToast({ message: 'Invoice marked as paid', tone: 'success' });
    },
    onError: (e: any) => setToast({ message: e.response?.data?.message ?? 'Failed', tone: 'error' }),
  });

  const disputeMutation = useMutation({
    mutationFn: () => api.patch(`/admin/driver-invoices/${id}/dispute`, { dispute_reason: disputeReason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-driver-invoice', id] });
      setShowDisputeForm(false);
      setToast({ message: 'Invoice disputed', tone: 'success' });
    },
    onError: (e: any) => setToast({ message: e.response?.data?.message ?? 'Failed', tone: 'error' }),
  });

  const fmt = (minor: number, ccy = 'AUD') => `${ccy} ${(minor / 100).toFixed(2)}`;

  if (isLoading) return <div className="text-center py-16 text-gray-400">Loading…</div>;
  if (!inv) return <div className="text-center py-16 text-gray-400">Invoice not found</div>;

  const status = STATUS_STYLE[inv.invoice_status] ?? { bg: 'bg-gray-100 text-gray-500', label: inv.invoice_status };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Driver Invoice</p>
            <h1 className="text-2xl font-bold font-mono text-gray-900">{inv.invoice_number}</h1>
            <p className="text-sm text-gray-600 mt-1">Driver: <strong>{inv.driver_name}</strong> · {inv.driver_email}</p>
          </div>
          <span className={`text-sm font-semibold px-3 py-1.5 rounded-full ${status.bg}`}>{status.label}</span>
        </div>
        <div className="mt-4 flex gap-6 text-sm">
          <div><p className="text-gray-400 text-xs">Total</p><p className="font-bold text-lg">{fmt(inv.total_minor, inv.currency)}</p></div>
          <div><p className="text-gray-400 text-xs">Jobs</p><p className="font-bold text-lg">{inv.item_count ?? (inv.items?.length ?? '—')}</p></div>
          <div><p className="text-gray-400 text-xs">Submitted</p><p className="font-medium">{inv.submitted_at ? new Date(inv.submitted_at).toLocaleString('en-AU') : '—'}</p></div>
          {inv.paid_by_admin_at && <div><p className="text-gray-400 text-xs">Paid</p><p className="font-medium text-green-700">{new Date(inv.paid_by_admin_at).toLocaleString('en-AU')}</p></div>}
          {inv.received_by_driver_at && <div><p className="text-gray-400 text-xs">Received</p><p className="font-medium text-emerald-700">{new Date(inv.received_by_driver_at).toLocaleString('en-AU')}</p></div>}
        </div>
        {inv.dispute_reason && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            <p className="text-sm font-semibold text-red-700">⚠️ Disputed</p>
            <p className="text-sm text-red-600">{inv.dispute_reason}</p>
          </div>
        )}
      </div>

      {/* Line items */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Job Line Items</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Amounts reflect admin-confirmed driver payable. Driver cannot modify these amounts.
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Booking Ref','Service Date','Route','Base Pay','Extras','Total Payable'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(inv.items ?? []).map((item: any) => {
              const extras = (item.extra_waiting_pay_minor ?? 0) +
                             (item.extra_waypoint_pay_minor ?? 0) +
                             (item.toll_parking_reimburse_minor ?? 0) +
                             (item.other_adjustment_minor ?? 0);
              return (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-mono font-semibold text-gray-900">{item.booking_reference}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {item.service_date ? new Date(item.service_date).toLocaleDateString('en-AU') : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs max-w-[180px]">
                    <p className="truncate">{item.pickup_address_text}</p>
                    <p className="truncate text-gray-400">→ {item.dropoff_address_text}</p>
                  </td>
                  <td className="px-4 py-3">{fmt(item.base_driver_pay_minor ?? 0, item.currency)}</td>
                  <td className="px-4 py-3 text-gray-500">{extras > 0 ? `+${fmt(extras, item.currency)}` : '—'}</td>
                  <td className="px-4 py-3 font-bold">{fmt(item.driver_payable_minor, item.currency)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50 border-t border-gray-200">
            <tr>
              <td colSpan={5} className="px-4 py-3 text-right font-semibold text-gray-700">Total Driver Payable</td>
              <td className="px-4 py-3 font-bold text-lg">{fmt(inv.total_minor, inv.currency)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Actions */}
      {inv.invoice_status === 'SUBMITTED' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Admin Actions</h2>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Payment notes (optional)</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={payNotes}
              onChange={e => setPayNotes(e.target.value)}
              placeholder="e.g. Paid via bank transfer on 11 Mar 2026"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                if (confirm(`Mark invoice ${inv.invoice_number} as paid? This confirms offline payment to the driver.`)) {
                  markPaidMutation.mutate();
                }
              }}
              disabled={markPaidMutation.isPending}
              className="px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {markPaidMutation.isPending ? 'Processing…' : '💰 Mark Paid'}
            </button>
            <button
              onClick={() => setShowDisputeForm(!showDisputeForm)}
              className="px-5 py-2.5 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50"
            >
              ⚠️ Dispute
            </button>
          </div>
          {showDisputeForm && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <label className="block text-sm font-medium text-red-700">Dispute reason *</label>
              <textarea
                rows={2}
                className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm"
                value={disputeReason}
                onChange={e => setDisputeReason(e.target.value)}
                placeholder="e.g. Incorrect job included, amount mismatch…"
              />
              <button
                onClick={() => { if (disputeReason.trim()) disputeMutation.mutate(); }}
                disabled={!disputeReason.trim() || disputeMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {disputeMutation.isPending ? 'Saving…' : 'Confirm Dispute'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
