import { Suspense } from 'react';
import BookingChangeApproveClient from './Client';

export const dynamic = 'force-dynamic';

export default function BookingChangeApprovePage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-white">Loading...</div>}>
      <BookingChangeApproveClient />
    </Suspense>
  );
}
