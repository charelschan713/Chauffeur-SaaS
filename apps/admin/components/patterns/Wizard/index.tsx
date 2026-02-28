import { ReactNode } from 'react';

interface WizardStep {
  id: string;
  label: string;
}

interface WizardProps {
  steps: ReadonlyArray<WizardStep>;
  currentStepId: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function WizardLayout({ steps, currentStepId, children, footer }: WizardProps) {
  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-4">
        {steps.map((step) => {
          const isActive = step.id === currentStepId;
          return (
            <li
              key={step.id}
              className={`flex items-center gap-2 text-sm font-medium ${
                isActive ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              <span
                className={`w-6 h-6 flex items-center justify-center rounded-full border text-xs ${
                  isActive ? 'border-blue-600' : 'border-gray-300'
                }`}
              >
                {steps.indexOf(step) + 1}
              </span>
              {step.label}
            </li>
          );
        })}
      </ol>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">{children}</div>

      {footer && <div className="flex justify-end gap-3">{footer}</div>}
    </div>
  );
}
