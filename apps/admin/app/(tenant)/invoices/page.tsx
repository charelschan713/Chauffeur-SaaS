'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Toast } from '@/components/ui/Toast';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

// ── helpers ─────────────────────────────────────────────────────────────────

function toDisplay(minor: number) { return (minor / 100).toFixed(2); }

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  const map: Record<string, any> = {
    PAID: 'success', SENT: 'neutral', DRAFT: 'neutral',
    OVERDUE: 'danger', CANCELLED: 'danger', VOID: 'danger',
  };
  return map[status] ?? 'neutral';
}

const STATUS_OPTIONS = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED', 'VOID'];
const TYPE_OPTIONS = ['CUSTOMER', 'DRIVER'];

// ── Create / Edit Modal ──────────────────────────────────────────────────────

function InvoiceModal({ invoice, onClose, onSave }: {
  invoice?: any;
  onClose: () => void;
  onSave: (data: any) => void;
}) {
  const isEdit = !!invoice;
  const [form, setForm] = useState({
    invoice_type: invoice?.invoice_type ?? 'CUSTOMER',
    status: invoice?.status ?? 'DRAFT',
    recipient_name: invoice?.recipient_name ?? '',
    recipient_email: invoice?.recipient_email ?? '',
    booking_id: invoice?.booking_id ?? '',
    issue_date: invoice?.issue_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    due_date: invoice?.due_date?.slice(0, 10) ?? '',
    subtotal_minor: invoice?.subtotal_minor ?? 0,
    tax_minor: invoice?.tax_minor ?? 0,
    discount_minor: invoice?.discount_minor ?? 0,
    total_minor: invoice?.total_minor ?? 0,
    notes: invoice?.notes ?? '',
    internal_notes: invoice?.internal_notes ?? '',
    line_items: invoice?.line_items ?? [],
  });

  const [lineItem, setLineItem] = useState({ description: '', qty: 1, unit_price_minor: 0 });

  function addLine() {
    if (!lineItem.description) return;
    const amount = lineItem.qty * lineItem.unit_price_minor;
    const next = [...form.line_items, { ...lineItem, amount_minor: amount }];
    const subtotal = next.reduce((s: number, l: any) => s + l.amount_minor, 0);
    setForm((f) => ({
      ...f,
      line_items: next,
      subtotal_minor: subtotal,
      total_minor: subtotal + f.tax_minor - f.discount_minor,
    }));
    setLineItem({ description: '', qty: 1, unit_price_minor: 0 });
  }

  function removeLine(i: number) {
    const next = form.line_items.filter((_: any, idx: number) => idx !== i);
    const subtotal = next.reduce((s: number, l: any) => s + l.amount_minor, 0);
    setForm((f) => ({
      ...f,
      line_items: next,
      subtotal_minor: subtotal,
      total_minor: subtotal + f.tax_minor - f.discount_minor,
    }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit Invoice' : 'New Invoice'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-6 space-y-4">
          {/* Type + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select
                value={form.invoice_type}
                onChange={(e) => setForm((f) => ({ ...f, invoice_type: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                {TYPE_OPTIONS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Recipient */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Recipient Name *</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.recipient_name}
                onChange={(e) => setForm((f) => ({ ...f, recipient_name: e.target.value }))}
                placeholder="John Smith"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.recipient_email}
                onChange={(e) => setForm((f) => ({ ...f, recipient_email: e.target.value }))}
                placeholder="john@example.com"
              />
            </div>
          </div>

          {/* Dates + Booking */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Issue Date</label>
              <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.issue_date}
                onChange={(e) => setForm((f) => ({ ...f, issue_date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label>
              <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Booking ID</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono text-xs"
                value={form.booking_id}
                onChange={(e) => setForm((f) => ({ ...f, booking_id: e.target.value }))}
                placeholder="optional"
              />
            </div>
          </div>

          {/* Line items */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">Line Items</label>
            {form.line_items.length > 0 && (
              <table className="w-full text-sm mb-3">
                <thead>
                  <tr className="text-xs text-gray-400 border-b">
                    <th className="text-left py-1">Description</th>
                    <th className="text-right py-1">Qty</th>
                    <th className="text-right py-1">Unit</th>
                    <th className="text-right py-1">Amount</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {form.line_items.map((l: any, i: number) => (
                    <tr key={i} className="border-b">
                      <td className="py-1.5">{l.description}</td>
                      <td className="text-right py-1.5">{l.qty}</td>
                      <td className="text-right py-1.5">${toDisplay(l.unit_price_minor)}</td>
                      <td className="text-right py-1.5 font-medium">${toDisplay(l.amount_minor)}</td>
                      <td className="text-right py-1.5">
                        <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {/* Add line */}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <input className="w-full border rounded px-2 py-1.5 text-xs"
                  placeholder="Description" value={lineItem.description}
                  onChange={(e) => setLineItem((l) => ({ ...l, description: e.target.value }))} />
              </div>
              <div className="w-14">
                <input type="number" className="w-full border rounded px-2 py-1.5 text-xs"
                  placeholder="Qty" value={lineItem.qty}
                  onChange={(e) => setLineItem((l) => ({ ...l, qty: Number(e.target.value) }))} />
              </div>
              <div className="w-24">
                <input type="number" className="w-full border rounded px-2 py-1.5 text-xs"
                  placeholder="Unit $" value={lineItem.unit_price_minor / 100}
                  onChange={(e) => setLineItem((l) => ({ ...l, unit_price_minor: Math.round(Number(e.target.value) * 100) }))} />
              </div>
              <button onClick={addLine}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-xs font-medium whitespace-nowrap">
                + Add
              </button>
            </div>
          </div>

          {/* Totals */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span>${toDisplay(form.subtotal_minor)}</span>
            </div>
            <div className="flex justify-between text-sm items-center gap-2">
              <span className="text-gray-500">Tax</span>
              <input type="number" className="w-24 border rounded px-2 py-1 text-xs text-right"
                value={form.tax_minor / 100}
                onChange={(e) => {
                  const t = Math.round(Number(e.target.value) * 100);
                  setForm((f) => ({ ...f, tax_minor: t, total_minor: f.subtotal_minor + t - f.discount_minor }));
                }} />
            </div>
            <div className="flex justify-between text-sm items-center gap-2">
              <span className="text-gray-500">Discount</span>
              <input type="number" className="w-24 border rounded px-2 py-1 text-xs text-right"
                value={form.discount_minor / 100}
                onChange={(e) => {
                  const d = Math.round(Number(e.target.value) * 100);
                  setForm((f) => ({ ...f, discount_minor: d, total_minor: f.subtotal_minor + f.tax_minor - d }));
                }} />
            </div>
            <div className="flex justify-between text-base font-bold border-t pt-1.5">
              <span>Total</span>
              <span>${toDisplay(form.total_minor)}</span>
            </div>
          </div>

          {/* Notes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes (visible to recipient)</label>
              <textarea className="w-full border rounded px-3 py-2 text-sm" rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Internal Notes</label>
              <textarea className="w-full border rounded px-3 py-2 text-sm" rows={3}
                value={form.internal_notes}
                onChange={(e) => setForm((f) => ({ ...f, internal_notes: e.target.value }))} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)}>
            {isEdit ? 'Update Invoice' : 'Create Invoice'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const qc = useQueryClient();
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; invoice?: any } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', typeFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get(`/invoices?${params}`);
      return res.data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (modal?.mode === 'edit' && modal.invoice?.id) {
        await api.patch(`/invoices/${modal.invoice.id}`, payload);
      } else {
        await api.post('/invoices', payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      setModal(null);
      setToast({ message: modal?.mode === 'edit' ? 'Invoice updated' : 'Invoice created', tone: 'success' });
    },
    onError: () => setToast({ message: 'Save failed', tone: 'error' }),
  });

  const markPaidMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/invoices/${id}/mark-paid`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      setToast({ message: 'Marked as paid', tone: 'success' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/invoices/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      setDeleteTarget(null);
      setToast({ message: 'Invoice deleted', tone: 'success' });
    },
  });

  const invoices: any[] = data?.data ?? [];

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-sm text-gray-500 mt-1">Manage customer and driver invoices</p>
        </div>
        <Button onClick={() => setModal({ mode: 'create' })}>+ New Invoice</Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm text-gray-700"
        >
          <option value="">All Types</option>
          {TYPE_OPTIONS.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm text-gray-700"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <div className="text-sm text-gray-400 self-center ml-auto">
          {data?.total ?? 0} invoices
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <LoadingSpinner />
      ) : invoices.length === 0 ? (
        <EmptyState title="No invoices" description="Create your first invoice to get started." />
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Invoice #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Recipient</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Issue Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Due Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs font-semibold text-gray-900">{inv.invoice_number}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      inv.invoice_type === 'DRIVER' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {inv.invoice_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    <div>{inv.recipient_name}</div>
                    {inv.recipient_email && <div className="text-xs text-gray-400">{inv.recipient_email}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{inv.issue_date?.slice(0, 10)}</td>
                  <td className="px-4 py-3 text-gray-600">{inv.due_date?.slice(0, 10) || '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    ${toDisplay(inv.total_minor)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusTone(inv.status)}>{inv.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      {inv.status !== 'PAID' && inv.status !== 'VOID' && (
                        <button
                          onClick={() => markPaidMutation.mutate(inv.id)}
                          className="text-xs text-green-600 hover:text-green-700 font-medium"
                        >
                          Mark Paid
                        </button>
                      )}
                      <button
                        onClick={() => setModal({ mode: 'edit', invoice: inv })}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(inv.id)}
                        className="text-xs text-red-500 hover:text-red-600 font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <InvoiceModal
          invoice={modal.invoice}
          onClose={() => setModal(null)}
          onSave={(data) => saveMutation.mutate(data)}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Invoice?"
        description="This invoice will be permanently removed from records."
        confirmText="Delete"
        confirmTone="danger"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
      />
    </div>
  );
}
