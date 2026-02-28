import { ReactNode } from 'react';

interface ConsoleLayoutProps {
  queue: ReactNode;
  workspace: ReactNode;
  resources: ReactNode;
  header?: ReactNode;
}

export function ConsoleLayout({ queue, workspace, resources, header }: ConsoleLayoutProps) {
  return (
    <div className="h-full flex flex-col gap-4">
      {header && <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">{header}</div>}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 overflow-auto">{queue}</div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 overflow-auto xl:col-span-1">{workspace}</div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 overflow-auto">{resources}</div>
      </div>
    </div>
  );
}
