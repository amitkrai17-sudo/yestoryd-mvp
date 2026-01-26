import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const readingSurfaceVariants = cva(
  // Base: Light background for readability
  'bg-paper text-ink shadow-reading',
  {
    variants: {
      ageGroup: {
        young: 'rounded-3xl border-4 border-brand-secondary', // Ages 4-6: Friendly, colorful
        older: 'rounded-xl border border-zinc-200',           // Ages 7-12: Clean, minimal
        default: 'rounded-2xl',                               // Generic
      },
      padding: {
        sm: 'p-4 md:p-6',
        md: 'p-6 md:p-8',
        lg: 'p-8 md:p-12',
      },
      maxWidth: {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
        full: 'max-w-full',
      },
    },
    defaultVariants: {
      ageGroup: 'default',
      padding: 'md',
      maxWidth: '2xl',
    },
  }
);

export interface ReadingSurfaceProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof readingSurfaceVariants> {
  centered?: boolean;
}

const ReadingSurface = React.forwardRef<HTMLDivElement, ReadingSurfaceProps>(
  ({ className, ageGroup, padding, maxWidth, centered = true, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          readingSurfaceVariants({ ageGroup, padding, maxWidth }),
          centered && 'mx-auto',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ReadingSurface.displayName = 'ReadingSurface';

// Pre-styled text components for reading content
const ReadingTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn('font-display text-2xl md:text-3xl font-bold text-gray-900 mb-4 md:mb-6', className)}
    {...props}
  />
));
ReadingTitle.displayName = 'ReadingTitle';

const ReadingText = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      'font-reading text-lg md:text-xl leading-relaxed md:leading-loose text-gray-800 tracking-wide',
      className
    )}
    {...props}
  />
));
ReadingText.displayName = 'ReadingText';

// Wrapper that creates the dark shell + white card pattern
const ReadingContainer = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={cn('min-h-screen bg-surface-0 flex items-center justify-center p-4 md:p-8', className)}>
    {children}
  </div>
);

ReadingContainer.displayName = 'ReadingContainer';

export {
  ReadingSurface,
  ReadingTitle,
  ReadingText,
  ReadingContainer,
  readingSurfaceVariants,
};
