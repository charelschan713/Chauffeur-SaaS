import Link from 'next/link';

export default function BookingConfirmedPage({ params }: { params: { reference: string } }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-md p-8 text-center">
        <p className="text-5xl mb-4">✅</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Booking confirmed!</h1>
        <p className="text-gray-500 text-sm mb-4">Reference: <span className="font-mono font-medium text-gray-800">{params.reference}</span></p>
        <p className="text-gray-400 text-sm mb-6">You&apos;ll receive a confirmation shortly. Your driver will be assigned closer to pickup time.</p>
        <Link href="/dashboard" className="block w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
