import { ReactNode } from 'react';
import { PageHeader } from '@/components/admin/PageHeader';

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
    <div className="space-y-6">
      <PageHeader title={title} description={subtitle} actions={actions} />

      {filters && <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">{filters}</div>}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">{table}</div>

      {footer}
    </div>
  );
}
