'use client';

export function DetailPage({
  title,
  tabs,
  content,
  sidePanel,
}: {
  title: string;
  tabs?: React.ReactNode;
  content?: React.ReactNode;
  sidePanel?: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        {tabs && <div className="mt-3">{tabs}</div>}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3 space-y-6">{content}</div>
        <aside className="xl:col-span-1">{sidePanel}</aside>
      </div>
    </div>
  );
}
