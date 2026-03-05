import { Suspense } from 'react';
import { BookingDetailClient } from './BookingDetailClient';

export default function BookingDetailPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <BookingDetailClient id={params.id} />
    </Suspense>
  );
}
