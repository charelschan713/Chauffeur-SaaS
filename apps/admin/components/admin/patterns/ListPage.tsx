'use client';

export function ListPage({
  title,
  filters,
  table,
  pagination,
}: {
  title: string;
  filters?: React.ReactNode;
  table?: React.ReactNode;
  pagination?: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
      </div>
      {filters && <div className="bg-white border rounded p-4">{filters}</div>}
      {table && <div className="bg-white border rounded">{table}</div>}
      {pagination && <div className="flex justify-end">{pagination}</div>}
    </div>
  );
}
