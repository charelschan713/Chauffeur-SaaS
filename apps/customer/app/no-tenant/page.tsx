export default function NoTenantPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md px-6">
        <div className="text-6xl mb-6">🔒</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Invalid Access</h1>
        <p className="text-gray-500 text-base leading-relaxed">
          Please use your company&apos;s booking link to access this portal.
        </p>
        <p className="text-gray-400 text-sm mt-4">
          e.g. <span className="font-mono bg-gray-100 px-2 py-1 rounded">yourcompany.book.chauffeur-solutions.com</span>
        </p>
      </div>
    </div>
  );
}
