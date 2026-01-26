import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 font-medium border transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-surface-2 text-text-secondary border-border',
        primary: 'bg-brand-primary/20 text-brand-primary border-brand-primary/30',
        secondary: 'bg-brand-secondary/20 text-brand-secondary border-brand-secondary/30',
        success: 'bg-semantic-success/20 text-semantic-success border-semantic-success/30',
        warning: 'bg-semantic-warning/20 text-semantic-warning border-semantic-warning/30',
        error: 'bg-semantic-error/20 text-semantic-error border-semantic-error/30',
        accent: 'bg-brand-accent/20 text-brand-accent border-brand-accent/30',
      },
      size: {
        sm: 'text-xs px-2 py-0.5 rounded-md',
        md: 'text-sm px-2.5 py-1 rounded-lg',
        lg: 'text-base px-3 py-1.5 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, dot, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(badgeVariants({ variant, size }), className)}
        {...props}
      >
        {dot && (
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              variant === 'primary' && 'bg-brand-primary',
              variant === 'secondary' && 'bg-brand-secondary',
              variant === 'success' && 'bg-semantic-success',
              variant === 'warning' && 'bg-semantic-warning',
              variant === 'error' && 'bg-semantic-error',
              variant === 'accent' && 'bg-brand-accent',
              variant === 'default' && 'bg-text-secondary'
            )}
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge, badgeVariants };
