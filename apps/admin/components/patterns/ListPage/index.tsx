import { ReactNode } from 'react';

interface ListPageProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  filters?: ReactNode;
  table: ReactNode;
  footer?: ReactNode;
}

export function ListPage({ title, subtitle, actions, filters, table, footer }: ListPageProps) {
  return (
    <div className="space-y-4">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </header>

      {filters && <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">{filters}</div>}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">{table}</div>

      {footer}
    </div>
  );
}
