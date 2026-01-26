import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const spinnerVariants = cva(
  'animate-spin',
  {
    variants: {
      size: {
        sm: 'h-4 w-4',
        md: 'h-6 w-6',
        lg: 'h-8 w-8',
        xl: 'h-12 w-12',
      },
      color: {
        primary: 'text-brand-primary',  // #FF0099 - DEFAULT
        secondary: 'text-brand-secondary',
        white: 'text-white',
        muted: 'text-text-tertiary',
      },
    },
    defaultVariants: {
      size: 'md',
      color: 'primary',  // CRITICAL: Default is PINK, never blue
    },
  }
);

export interface SpinnerProps extends VariantProps<typeof spinnerVariants> {
  className?: string;
}

const Spinner = ({ size, color, className }: SpinnerProps) => (
  <Loader2 className={cn(spinnerVariants({ size, color }), className)} />
);

Spinner.displayName = 'Spinner';

// Full page loader component
const PageLoader = ({ text = 'Loading...' }: { text?: string }) => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="flex flex-col items-center gap-4">
      <Spinner size="xl" color="primary" />
      <p className="text-text-secondary animate-pulse">{text}</p>
    </div>
  </div>
);

PageLoader.displayName = 'PageLoader';

// Inline loader for buttons or small areas
const InlineLoader = ({ className }: { className?: string }) => (
  <Spinner size="sm" color="primary" className={className} />
);

InlineLoader.displayName = 'InlineLoader';

export { Spinner, PageLoader, InlineLoader, spinnerVariants };
