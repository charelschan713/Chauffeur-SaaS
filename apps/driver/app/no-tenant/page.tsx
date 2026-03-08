export default function NoTenantPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md px-6">
        <div className="mb-6 flex justify-center">
          <svg className="h-14 w-14 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <rect x="5" y="11" width="14" height="10" rx="2" /><path strokeLinecap="round" d="M8 11V7a4 4 0 018 0v4" />
          </svg>
        </div>
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
