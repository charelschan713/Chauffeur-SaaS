import { Suspense } from 'react';
import { BookPageClient } from './BookPageClient';

export default function BookPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Loading...</div>}>
      <BookPageClient />
    </Suspense>
  );
}
