import { Suspense } from 'react';
import { QuoteClient } from './QuoteClient';

export default function QuotePage() {
  return (
    <Suspense>
      <QuoteClient />
    </Suspense>
  );
}
