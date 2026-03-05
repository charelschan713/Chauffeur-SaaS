'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/admin/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';

const STATUS_BADGE: Record<string, 'neutral' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'neutral',
  SENT: 'warning',
  PAID: 'success',
  OVERDUE: 'danger',
  VOID: 'neutral',
};

function formatMinor(minor: number, currency = 'AUD') {
  return `${(minor / 100).toFixed(2)} ${currency}`;
}

function InvoiceRow({ inv, onView }: { inv: any; onView: (inv: any) => void }) {
  return (
    <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => onView(inv)}>
      <td className="px-4 py-3 text-sm font-mono text-gray-800">{inv.invoice_number}</td>
      <td className="px-4 py-3 text-sm text-gray-600">{inv.customer_name ?? '—'}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{inv.issued_at ? new Date(inv.issued_at).toLocaleDateString() : '—'}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</td>
      <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatMinor(inv.total_minor ?? 0, inv.currency)}</td>
      <td className="px-4 py-3">
        <Badge variant={STATUS_BADGE[inv.status] ?? 'neutral'}>{inv.status}</Badge>
      </td>
    </tr>
  );
}

export default function InvoicesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'CUSTOMER' | 'PARTNER'>('CUSTOMER');
  const [selected, setSelected] = useState<any>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', tab],
    queryFn: () =>
      api.get(`/invoices?type=${tab}&limit=100`).then((r) => r.data),
  });

  const invoices: any[] = data?.data ?? [];

  const markPaidMut = useMutation({
    mutationFn: (id: string) => api.patch(`/invoices/${id}`, { status: 'PAID', paid_at: new Date().toISOString() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      setSelected(null);
      setToast({ message: 'Invoice marked as paid', tone: 'success' });
    },
    onError: () => setToast({ message: 'Failed to update invoice', tone: 'error' }),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description="Manage customer and partner invoices" />

      {toast && (
        <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />
      )}

      <div className="flex gap-2">
        {(['CUSTOMER', 'PARTNER'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {t === 'CUSTOMER' ? '👤 Customer' : '🤝 Partner'}
          </button>
        ))}
      </div>

      <Card title={`${tab === 'CUSTOMER' ? 'Customer' : 'Partner'} Invoices`}>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-6 w-6 border-4 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : invoices.length === 0 ? (
          <p className="text-center py-8 text-gray-400">No invoices found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Issued</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv: any) => (
                  <InvoiceRow key={inv.id} inv={inv} onView={setSelected} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Invoice detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{selected.invoice_number}</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <Badge variant={STATUS_BADGE[selected.status] ?? 'neutral'}>{selected.status}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount</span>
                <span className="font-medium">{formatMinor(selected.total_minor ?? 0, selected.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Issued</span>
                <span>{selected.issued_at ? new Date(selected.issued_at).toLocaleDateString() : '—'}</span>
              </div>
              {selected.due_date && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Due</span>
                  <span>{new Date(selected.due_date).toLocaleDateString()}</span>
                </div>
              )}
              {selected.notes && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-gray-500 mb-1">Notes</p>
                  <p className="text-gray-700">{selected.notes}</p>
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              {selected.status !== 'PAID' && (
                <Button
                  onClick={() => markPaidMut.mutate(selected.id)}
                  variant="primary"
                >
                  {markPaidMut.isPending ? 'Saving...' : '✓ Mark as Paid'}
                </Button>
              )}
              <Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
