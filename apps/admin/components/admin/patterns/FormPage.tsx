'use client';

export function FormPage({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        {actions}
      </div>
      <div className="bg-white border rounded p-6">{children}</div>
    </div>
  );
}
