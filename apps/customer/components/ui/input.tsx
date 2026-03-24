import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-11 w-full rounded-[--radius] border border-[hsl(var(--input-border))] bg-[hsl(var(--input))]/95 px-3 py-2 shadow-[var(--shadow-sm)] backdrop-blur-sm',
        'text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]',
        'transition-colors duration-150',
        'focus:outline-none focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary)/0.15)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
