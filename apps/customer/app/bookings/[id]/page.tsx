import { Suspense } from 'react';
import { BookingDetailClient } from './BookingDetailClient';

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <BookingDetailClient id={id} />
    </Suspense>
  );
}
