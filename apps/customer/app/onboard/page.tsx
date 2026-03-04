import { Suspense } from 'react';
import { OnboardClient } from './OnboardClient';

export default function OnboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400 text-sm">
        Loading invitation...
      </div>
    }>
      <OnboardClient />
    </Suspense>
  );
}
