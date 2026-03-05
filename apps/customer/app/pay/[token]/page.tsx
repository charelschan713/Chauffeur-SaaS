import { Suspense } from 'react';
import { PayPageClient } from './PayPageClient';

export default function PayPage({ params }: { params: { token: string } }) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <PayPageClient token={params.token} />
    </Suspense>
  );
}
