import { ReactNode } from 'react';

interface DetailPageProps {
  title: string;
  subtitle?: string;
  badges?: ReactNode;
  actions?: ReactNode;
  primary: ReactNode;
  secondary?: ReactNode;
}

interface DetailSectionProps {
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function DetailPage({ title, subtitle, badges, actions, primary, secondary }: DetailPageProps) {
  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
            {badges}
          </div>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">{primary}</div>
        <div className="space-y-6">{secondary}</div>
      </div>
    </div>
  );
}

export function DetailSection({ title, children, footer }: DetailSectionProps) {
  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
      {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
      <div className="space-y-3 text-sm text-gray-900">{children}</div>
      {footer && <div className="pt-3 border-t border-gray-100">{footer}</div>}
    </section>
  );
}
