import { Suspense } from 'react';
import { PayPageClient } from './PayPageClient';

export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0d0f14]">
        <div className="animate-spin h-8 w-8 border-4 border-[#c8a96b] border-t-transparent rounded-full" />
      </div>
    }>
      <PayPageClient token={token} />
    </Suspense>
  );
}
