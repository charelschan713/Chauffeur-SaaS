'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Toast } from '@/components/ui/Toast';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(minor: number) { return (minor / 100).toFixed(2); }
function fmtDate(d: string) { return d?.slice(0, 10) ?? '—'; }

function expiryBadge(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  return status === 'PAID' ? 'success'
    : status === 'SENT' || status === 'DRAFT' ? 'neutral'
    : 'danger';
}

const STATUS_CHIP: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SENT: 'bg-blue-100 text-blue-700',
  PAID: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-200 text-gray-500',
  VOID: 'bg-gray-200 text-gray-500',
};

// ── Customer Invoice Modal ───────────────────────────────────────────────────

function CustomerModal({ invoice, onClose, onSave }: { invoice?: any; onClose: () => void; onSave: (d: any) => void }) {
  const [form, setForm] = useState({
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
    line_items: (invoice?.line_items as any[]) ?? [],
  });
  const [li, setLi] = useState({ description: '', qty: 1, unit: 0 });

  function addLine() {
    if (!li.description) return;
    const amt = li.qty * li.unit;
    const next = [...form.line_items, { description: li.description, qty: li.qty, unit_price_minor: li.unit, amount_minor: amt }];
    const sub = next.reduce((s: number, l: any) => s + l.amount_minor, 0);
    setForm(f => ({ ...f, line_items: next, subtotal_minor: sub, total_minor: sub + f.tax_minor - f.discount_minor }));
    setLi({ description: '', qty: 1, unit: 0 });
  }

  function removeLine(i: number) {
    const next = form.line_items.filter((_: any, idx: number) => idx !== i);
    const sub = next.reduce((s: number, l: any) => s + l.amount_minor, 0);
    setForm(f => ({ ...f, line_items: next, subtotal_minor: sub, total_minor: sub + f.tax_minor - f.discount_minor }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-lg">{invoice ? 'Edit Customer Invoice' : 'New Customer Invoice'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Recipient Name *</label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.recipient_name}
                onChange={e => setForm(f => ({ ...f, recipient_name: e.target.value }))} placeholder="Customer name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm" value={form.recipient_email}
                onChange={e => setForm(f => ({ ...f, recipient_email: e.target.value }))} placeholder="customer@email.com" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Issue Date</label>
              <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.issue_date}
                onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label>
              <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {['DRAFT','SENT','PAID','OVERDUE','CANCELLED'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Line items */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">Line Items</label>
            {form.line_items.length > 0 && (
              <table className="w-full text-sm mb-3 border rounded overflow-hidden">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr><th className="text-left px-3 py-2">Description</th><th className="text-right px-3 py-2">Qty</th><th className="text-right px-3 py-2">Unit $</th><th className="text-right px-3 py-2">Amount</th><th className="w-8" /></tr>
                </thead>
                <tbody className="divide-y">
                  {form.line_items.map((l: any, i: number) => (
                    <tr key={i}>
                      <td className="px-3 py-2">{l.description}</td>
                      <td className="text-right px-3 py-2">{l.qty}</td>
                      <td className="text-right px-3 py-2">${fmt(l.unit_price_minor)}</td>
                      <td className="text-right px-3 py-2 font-medium">${fmt(l.amount_minor)}</td>
                      <td className="px-2"><button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600">✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <input className="w-full border rounded px-2 py-1.5 text-sm" placeholder="Description"
                  value={li.description} onChange={e => setLi(l => ({ ...l, description: e.target.value }))} />
              </div>
              <input type="number" className="w-14 border rounded px-2 py-1.5 text-sm" placeholder="Qty"
                value={li.qty} onChange={e => setLi(l => ({ ...l, qty: Number(e.target.value) }))} />
              <input type="number" className="w-24 border rounded px-2 py-1.5 text-sm" placeholder="Unit $"
                value={li.unit / 100} onChange={e => setLi(l => ({ ...l, unit: Math.round(Number(e.target.value) * 100) }))} />
              <button onClick={addLine} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium">+ Add</button>
            </div>
          </div>

          {/* Totals */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            {[
              { label: 'Subtotal', value: fmt(form.subtotal_minor), readOnly: true },
            ].map(r => (
              <div key={r.label} className="flex justify-between text-sm"><span className="text-gray-500">{r.label}</span><span>${r.value}</span></div>
            ))}
            <div className="flex justify-between text-sm items-center gap-2">
              <span className="text-gray-500">Tax (GST)</span>
              <input type="number" className="w-24 border rounded px-2 py-1 text-xs text-right" value={form.tax_minor / 100}
                onChange={e => { const t = Math.round(Number(e.target.value)*100); setForm(f => ({ ...f, tax_minor: t, total_minor: f.subtotal_minor + t - f.discount_minor })); }} />
            </div>
            <div className="flex justify-between text-sm items-center gap-2">
              <span className="text-gray-500">Discount</span>
              <input type="number" className="w-24 border rounded px-2 py-1 text-xs text-right" value={form.discount_minor / 100}
                onChange={e => { const d = Math.round(Number(e.target.value)*100); setForm(f => ({ ...f, discount_minor: d, total_minor: f.subtotal_minor + f.tax_minor - d })); }} />
            </div>
            <div className="flex justify-between font-bold text-base border-t pt-2">
              <span>Total</span><span>${fmt(form.total_minor)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea className="w-full border rounded px-3 py-2 text-sm" rows={2} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({ ...form, invoice_type: 'CUSTOMER' })}>
            {invoice ? 'Update Invoice' : 'Create Invoice'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Driver Invoice Modal ─────────────────────────────────────────────────────

function DriverModal({ invoice, onClose, onSave }: { invoice?: any; onClose: () => void; onSave: (d: any) => void }) {
  const [driverSearch, setDriverSearch] = useState('');
  const [selectedJobs, setSelectedJobs] = useState<string[]>(
    invoice?.jobs?.map((j: any) => j.assignment_id).filter(Boolean) ?? []
  );
  const [form, setForm] = useState({
    recipient_name: invoice?.recipient_name ?? invoice?.driver_full_name ?? '',
    issue_date: invoice?.issue_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    due_date: invoice?.due_date?.slice(0, 10) ?? '',
    notes: invoice?.notes ?? '',
    status: invoice?.status ?? 'DRAFT',
    submitted_by_driver_id: invoice?.submitted_by_driver_id ?? '',
  });

  // Fetch completed jobs
  const { data: jobsData = [] } = useQuery({
    queryKey: ['completed-jobs', form.submitted_by_driver_id],
    queryFn: async () => {
      const res = await api.get('/invoices/driver-jobs/completed' +
        (form.submitted_by_driver_id ? `?driver_id=${form.submitted_by_driver_id}` : ''));
      return res.data ?? [];
    },
  });

  const jobs: any[] = jobsData;

  // Fetch drivers
  const { data: driversData } = useQuery({
    queryKey: ['dispatch-drivers'],
    queryFn: async () => { const res = await api.get('/drivers'); return res.data ?? []; },
  });
  const drivers: any[] = Array.isArray(driversData) ? driversData : (driversData?.data ?? []);
  const filteredDrivers = useMemo(() => {
    if (!driverSearch) return drivers.slice(0, 20);
    return drivers.filter((d: any) => d.full_name?.toLowerCase().includes(driverSearch.toLowerCase()));
  }, [drivers, driverSearch]);

  function toggleJob(assignmentId: string) {
    setSelectedJobs(prev =>
      prev.includes(assignmentId) ? prev.filter(id => id !== assignmentId) : [...prev, assignmentId]
    );
  }

  const selectedJobObjs = jobs.filter((j: any) => selectedJobs.includes(j.assignment_id));
  const totalMinor = selectedJobObjs.reduce((s: number, j: any) => s + (j.driver_pay_minor ?? 0), 0);

  function handleSave() {
    onSave({
      invoice_type: 'DRIVER',
      status: form.status,
      recipient_name: form.recipient_name || 'Driver',
      issue_date: form.issue_date,
      due_date: form.due_date || null,
      notes: form.notes,
      submitted_by_driver_id: form.submitted_by_driver_id || null,
      subtotal_minor: totalMinor,
      tax_minor: 0,
      discount_minor: 0,
      total_minor: totalMinor,
      jobs: selectedJobObjs.map((j: any) => ({
        booking_id: j.booking_id,
        assignment_id: j.assignment_id,
        description: `${j.booking_reference} — ${j.pickup_address_text?.slice(0, 40)} → ${j.dropoff_address_text?.slice(0, 40)}`,
        amount_minor: j.driver_pay_minor ?? 0,
      })),
      line_items: selectedJobObjs.map((j: any) => ({
        description: `${j.booking_reference} · ${new Date(j.pickup_at_utc).toLocaleDateString('en-AU')}`,
        qty: 1,
        unit_price_minor: j.driver_pay_minor ?? 0,
        amount_minor: j.driver_pay_minor ?? 0,
      })),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h2 className="font-semibold text-lg">{invoice ? 'Edit Driver Invoice' : 'New Driver Invoice'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Driver select */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">Driver</label>
            <input className="w-full border rounded-lg px-3 py-2 text-sm mb-2" placeholder="Search driver…"
              value={driverSearch} onChange={e => setDriverSearch(e.target.value)} />
            {driverSearch && filteredDrivers.length > 0 && (
              <div className="border rounded-lg overflow-hidden max-h-36 overflow-y-auto">
                {filteredDrivers.map((d: any) => (
                  <button key={d.id} type="button"
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${form.submitted_by_driver_id === d.id ? 'bg-blue-50' : ''}`}
                    onClick={() => {
                      setForm(f => ({ ...f, submitted_by_driver_id: d.id, recipient_name: d.full_name }));
                      setDriverSearch(d.full_name);
                      setSelectedJobs([]);
                    }}>
                    <span>{d.full_name}</span>
                    {form.submitted_by_driver_id === d.id && <span className="text-blue-600 text-xs">✓ Selected</span>}
                  </button>
                ))}
              </div>
            )}
            {form.submitted_by_driver_id && (
              <div className="mt-1 text-xs text-green-600 font-medium">✓ {form.recipient_name}</div>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Issue Date</label>
              <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.issue_date}
                onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label>
              <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {['DRAFT','SENT','PAID'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Job selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-700">
                Select Jobs to Include
                {selectedJobs.length > 0 && <span className="ml-2 text-blue-600">{selectedJobs.length} selected</span>}
              </label>
              {jobs.length > 0 && (
                <button type="button" className="text-xs text-blue-600 hover:underline"
                  onClick={() => setSelectedJobs(jobs.map((j: any) => j.assignment_id))}>
                  Select All ({jobs.length})
                </button>
              )}
            </div>
            {jobs.length === 0 ? (
              <div className="border rounded-lg p-4 text-center text-sm text-gray-400">
                {form.submitted_by_driver_id ? 'No unlinked completed jobs for this driver' : 'Select a driver to see their completed jobs'}
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                {jobs.map((j: any) => {
                  const selected = selectedJobs.includes(j.assignment_id);
                  return (
                    <label key={j.assignment_id}
                      className={`flex items-start gap-3 px-4 py-3 cursor-pointer border-b last:border-0 hover:bg-gray-50 ${selected ? 'bg-blue-50' : ''}`}>
                      <input type="checkbox" checked={selected} onChange={() => toggleJob(j.assignment_id)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-gray-900">{j.booking_reference}</span>
                          <span className="text-sm font-semibold text-gray-900 shrink-0">
                            ${fmt(j.driver_pay_minor ?? 0)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {new Date(j.pickup_at_utc).toLocaleDateString('en-AU')} · {j.pickup_address_text?.slice(0, 35)} → {j.dropoff_address_text?.slice(0, 35)}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea className="w-full border rounded px-3 py-2 text-sm" rows={2} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>

        {/* Footer with total */}
        <div className="border-t px-6 py-4 flex items-center justify-between shrink-0">
          <div className="text-sm">
            <span className="text-gray-500">Total Payable: </span>
            <span className="text-lg font-bold text-gray-900">${fmt(totalMinor)}</span>
            {selectedJobs.length > 0 && <span className="text-xs text-gray-400 ml-2">({selectedJobs.length} jobs)</span>}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.submitted_by_driver_id && selectedJobs.length === 0}>
              {invoice ? 'Update Invoice' : 'Create Invoice'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Invoice Row ──────────────────────────────────────────────────────────────

function InvoiceRow({ inv, type, onEdit, onMarkPaid, onApprove, onDelete }: {
  inv: any; type: 'CUSTOMER' | 'DRIVER';
  onEdit: () => void; onMarkPaid: () => void; onApprove?: () => void; onDelete: () => void;
}) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-5 py-3 font-mono text-xs font-semibold text-gray-900">{inv.invoice_number}</td>
      <td className="px-4 py-3 text-gray-900">
        <div className="font-medium text-sm">{inv.recipient_name}</div>
        {inv.recipient_email && <div className="text-xs text-gray-400">{inv.recipient_email}</div>}
        {type === 'DRIVER' && inv.driver_full_name && (
          <div className="text-xs text-purple-600">👤 {inv.driver_full_name}</div>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(inv.issue_date)}</td>
      <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(inv.due_date)}</td>
      <td className="px-4 py-3 text-right font-semibold text-gray-900">${fmt(inv.total_minor)}</td>
      <td className="px-4 py-3">
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_CHIP[inv.status] ?? 'bg-gray-100 text-gray-600'}`}>
          {inv.status}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2 justify-end items-center flex-wrap">
          {type === 'DRIVER' && inv.status === 'DRAFT' && onApprove && (
            <button onClick={onApprove} className="text-xs text-blue-600 hover:text-blue-700 font-medium">Approve</button>
          )}
          {inv.status !== 'PAID' && inv.status !== 'VOID' && inv.status !== 'CANCELLED' && (
            <button onClick={onMarkPaid} className="text-xs text-green-600 hover:text-green-700 font-medium">Mark Paid</button>
          )}
          <button onClick={onEdit} className="text-xs text-blue-600 hover:text-blue-700 font-medium">Edit</button>
          <button onClick={onDelete} className="text-xs text-red-500 hover:text-red-600 font-medium">Delete</button>
        </div>
      </td>
    </tr>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'CUSTOMER' | 'DRIVER'>('CUSTOMER');
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; invoice?: any; type: 'CUSTOMER' | 'DRIVER' } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', activeTab, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ type: activeTab });
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

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/invoices/${id}/approve`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); setToast({ message: 'Invoice approved', tone: 'success' }); },
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => api.post(`/invoices/${id}/mark-paid`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); setToast({ message: 'Marked as paid', tone: 'success' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/invoices/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); setDeleteTarget(null); setToast({ message: 'Invoice deleted', tone: 'success' }); },
  });

  const invoices: any[] = data?.data ?? [];

  // Stats
  const totalOutstanding = invoices.filter(i => ['DRAFT','SENT','OVERDUE'].includes(i.status)).reduce((s, i) => s + i.total_minor, 0);
  const totalPaid = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.total_minor, 0);

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-sm text-gray-500 mt-1">
            {activeTab === 'CUSTOMER' ? 'Customer invoices — income from services' : 'Driver invoices — payments to drivers'}
          </p>
        </div>
        <Button onClick={() => setModal({ mode: 'create', type: activeTab })}>
          + New {activeTab === 'CUSTOMER' ? 'Customer' : 'Driver'} Invoice
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b gap-0">
        {(['CUSTOMER', 'DRIVER'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setStatusFilter(''); }}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'CUSTOMER' ? '📥 Customer Income' : '📤 Driver Payments'}
          </button>
        ))}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">{activeTab === 'CUSTOMER' ? 'Outstanding' : 'Pending Payment'}</div>
          <div className="text-xl font-bold text-gray-900">${fmt(totalOutstanding)}</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Paid</div>
          <div className="text-xl font-bold text-green-600">${fmt(totalPaid)}</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Total Invoices</div>
          <div className="text-xl font-bold text-gray-900">{data?.total ?? 0}</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Showing</div>
          <div className="text-xl font-bold text-gray-900">{invoices.length}</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-3 items-center">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm text-gray-700">
          <option value="">All Statuses</option>
          {['DRAFT','SENT','PAID','OVERDUE','CANCELLED'].map(s => <option key={s}>{s}</option>)}
        </select>
        <span className="text-xs text-gray-400 ml-auto">{data?.total ?? 0} total</span>
      </div>

      {/* Table */}
      {isLoading ? <LoadingSpinner /> : invoices.length === 0 ? (
        <EmptyState
          title={`No ${activeTab.toLowerCase()} invoices`}
          description={activeTab === 'CUSTOMER'
            ? 'Create your first customer invoice to track income.'
            : 'Create a driver invoice to record driver payments. You can select multiple jobs at once.'}
        />
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Invoice #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  {activeTab === 'CUSTOMER' ? 'Customer' : 'Driver'}
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Issue Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Due Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  {activeTab === 'CUSTOMER' ? 'Amount' : 'Payable'}
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map(inv => (
                <InvoiceRow
                  key={inv.id}
                  inv={inv}
                  type={activeTab}
                  onEdit={() => setModal({ mode: 'edit', invoice: inv, type: activeTab })}
                  onMarkPaid={() => markPaidMutation.mutate(inv.id)}
                  onApprove={activeTab === 'DRIVER' ? () => approveMutation.mutate(inv.id) : undefined}
                  onDelete={() => setDeleteTarget(inv.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {modal?.type === 'CUSTOMER' && (
        <CustomerModal
          invoice={modal.invoice}
          onClose={() => setModal(null)}
          onSave={d => saveMutation.mutate(d)}
        />
      )}
      {modal?.type === 'DRIVER' && (
        <DriverModal
          invoice={modal.invoice}
          onClose={() => setModal(null)}
          onSave={d => saveMutation.mutate(d)}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Invoice?"
        description="This invoice will be permanently removed."
        confirmText="Delete"
        confirmTone="danger"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
      />
    </div>
  );
}
