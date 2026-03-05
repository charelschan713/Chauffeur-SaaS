'use client';
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[--radius] text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 shadow-sm',
        secondary:
          'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--accent))]',
        outline:
          'border border-[hsl(var(--border))] bg-transparent text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]',
        ghost:
          'bg-transparent text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]',
        destructive:
          'bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] hover:opacity-90',
        link:
          'bg-transparent text-[hsl(var(--primary))] underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        sm:   'h-9 px-3 text-xs',
        md:   'h-11 px-5',
        lg:   'h-12 px-7 text-base',
        xl:   'h-14 px-8 text-base font-semibold',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

export { Button, buttonVariants };
