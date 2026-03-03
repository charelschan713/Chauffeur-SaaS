'use client';

export function AdminTopbar() {
  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
      <div>
        <p className="text-xs text-gray-500">Tenant</p>
        <p className="text-sm font-semibold text-gray-900">AS Chauffeured</p>
      </div>
      <div className="flex items-center gap-4">
        <button className="text-gray-500 hover:text-gray-700 text-sm">Notifications</button>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gray-200" />
          <div className="text-sm text-gray-700">Admin</div>
        </div>
      </div>
    </header>
  );
}
