'use client';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function InvoicesPage() {
  const router = useRouter();
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.get('/customer-portal/invoices').then((r) => r.data),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-xl">←</button>
          <h1 className="text-lg font-semibold text-gray-900">Invoices</h1>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">🧾</p>
            <p>No invoices yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((inv: any) => (
              <div key={inv.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-mono text-sm font-medium text-gray-900">{inv.invoice_number}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${inv.status === 'PAID' ? 'bg-green-100 text-green-800' : inv.status === 'OVERDUE' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'}`}>
                    {inv.status}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Issued {new Date(inv.issued_at).toLocaleDateString()}</span>
                  <span className="font-semibold text-gray-900">
                    {((inv.total_minor ?? 0) / 100).toFixed(2)} {inv.currency}
                  </span>
                </div>
                {inv.due_date && (
                  <p className="text-xs text-gray-400 mt-1">Due {new Date(inv.due_date).toLocaleDateString()}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
