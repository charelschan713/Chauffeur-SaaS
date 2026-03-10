'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import Link from 'next/link';

const STATUS_STYLE: Record<string, string> = {
  DRAFT:              'bg-gray-100 text-gray-600',
  SUBMITTED:          'bg-blue-100 text-blue-700',
  PAID_BY_ADMIN:      'bg-green-100 text-green-700',
  RECEIVED_BY_DRIVER: 'bg-emerald-100 text-emerald-800',
  DISPUTED:           'bg-red-100 text-red-700',
};

export default function DriverInvoicesPage() {
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['admin-driver-invoices'],
    queryFn: async () => { const r = await api.get('/admin/driver-invoices'); return r.data; },
  });

  const fmt = (minor: number, ccy = 'AUD') =>
    `${ccy} ${(minor / 100).toFixed(2)}`;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Driver Invoices</h1>
        <p className="text-sm text-gray-500 mt-1">
          Invoices submitted by drivers for payment. Separate from customer invoices.
        </p>
      </div>

      {isLoading && <div className="text-gray-400 text-center py-16">Loading…</div>}

      {!isLoading && invoices.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-3xl mb-3">🧾</p>
          <p className="font-semibold">No driver invoices yet</p>
          <p className="text-sm mt-1">Driver invoices will appear here once drivers submit them.</p>
        </div>
      )}

      {!isLoading && invoices.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Invoice #','Driver','Jobs','Total','Status','Submitted','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv: any) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-semibold text-gray-900">{inv.invoice_number}</td>
                  <td className="px-4 py-3 text-gray-700">{inv.driver_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{inv.item_count ?? '—'}</td>
                  <td className="px-4 py-3 font-semibold">{fmt(inv.total_minor, inv.currency)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[inv.invoice_status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {inv.invoice_status}
                    </span>
                    {inv.dispute_reason && (
                      <p className="text-xs text-red-600 mt-0.5 truncate max-w-[140px]" title={inv.dispute_reason}>
                        {inv.dispute_reason}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {inv.submitted_at ? new Date(inv.submitted_at).toLocaleDateString('en-AU') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/driver-invoices/${inv.id}`}
                      className="text-blue-600 hover:underline text-xs font-medium">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
