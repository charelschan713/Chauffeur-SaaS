'use client';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { BottomNav } from '@/components/BottomNav';
import { BackButton } from '@/components/BackButton';

export default function InvoicesPage() {
  const router = useRouter();
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.get('/driver-app/invoices').then((r) => r.data),
  });

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]" style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}>
      {/* Header */}
      <header
        className="border-b border-[hsl(var(--border))] px-4 sticky top-0 z-10"
        style={{
          background: 'rgba(13,15,20,0.97)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          paddingTop: 'max(12px, env(safe-area-inset-top))',
          paddingBottom: 12,
        }}
      >
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <BackButton fallback="/dashboard" />
          <h1 className="text-lg font-semibold text-[hsl(var(--foreground))]">Invoices</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin h-8 w-8 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="text-5xl text-[hsl(var(--muted-foreground))]">—</div>
            <p className="text-[hsl(var(--muted-foreground))] text-sm">No invoices yet</p>
          </div>
        ) : (
          invoices.map((inv: any) => (
            <div
              key={inv.id}
              className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-4 space-y-2"
            >
              <div className="flex justify-between items-center">
                <span className="font-mono text-sm font-semibold text-[hsl(var(--foreground))]">
                  {inv.invoice_number}
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                  inv.status === 'PAID'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : inv.status === 'OVERDUE'
                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                    : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]'
                }`}>
                  {inv.status}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-[hsl(var(--muted-foreground))]">
                  Issued {new Date(inv.created_at).toLocaleDateString('en-AU')}
                </span>
                <span className="font-semibold text-[hsl(var(--primary))]">
                  ${((inv.total_minor ?? 0) / 100).toFixed(2)} {inv.currency}
                </span>
              </div>
              {inv.submitted_at && (
                <p className="text-xs text-[hsl(var(--muted-foreground)/0.6)]">
                  Submitted {new Date(inv.submitted_at).toLocaleDateString('en-AU')}
                </p>
              )}
            </div>
          ))
        )}
      </main>

      <BottomNav />
    </div>
  );
}
