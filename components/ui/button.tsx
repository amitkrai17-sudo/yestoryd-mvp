'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // Base styles
  `inline-flex items-center justify-center gap-2 font-semibold
   transition-all duration-200
   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0
   disabled:pointer-events-none disabled:opacity-50
   active:scale-[0.98]`,
  {
    variants: {
      variant: {
        primary: `
          bg-brand-primary text-white
          hover:bg-brand-primary/90 hover:shadow-[0_0_20px_-5px_rgba(255,0,153,0.5)]
          focus-visible:ring-brand-primary
        `,
        secondary: `
          bg-surface-2 text-white border border-border
          hover:bg-surface-3
          focus-visible:ring-brand-secondary
        `,
        outline: `
          bg-transparent text-brand-primary border border-brand-primary
          hover:bg-brand-primary/10
          focus-visible:ring-brand-primary
        `,
        ghost: `
          bg-transparent text-white
          hover:bg-white/10
          focus-visible:ring-white
        `,
        danger: `
          bg-semantic-error text-white
          hover:bg-semantic-error/90
          focus-visible:ring-semantic-error
        `,
        whatsapp: `
          bg-[#25D366] text-white
          hover:bg-[#25D366]/90 hover:shadow-[0_0_20px_-5px_rgba(37,211,102,0.5)]
          focus-visible:ring-[#25D366]
        `,
      },
      size: {
        sm: 'h-9 px-3 text-sm rounded-lg',
        md: 'h-11 px-4 text-base rounded-xl min-h-[44px]',
        lg: 'h-14 px-6 text-lg rounded-xl min-h-[48px]',
        icon: 'h-11 w-11 rounded-xl',
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      fullWidth: false,
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, loading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-current" />
        ) : leftIcon ? (
          leftIcon
        ) : null}
        {children}
        {!loading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
