import * as React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

const Skeleton = ({ className, ...props }: SkeletonProps) => (
  <div
    className={cn(
      'skeleton rounded-lg',
      className
    )}
    {...props}
  />
);

Skeleton.displayName = 'Skeleton';

// Pre-built skeleton patterns

const SkeletonText = ({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) => (
  <div className={cn('space-y-2', className)}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        className={cn(
          'h-4',
          i === lines - 1 ? 'w-3/4' : 'w-full'
        )}
      />
    ))}
  </div>
);

SkeletonText.displayName = 'SkeletonText';

const SkeletonCard = ({ className }: { className?: string }) => (
  <div className={cn('bg-surface-1 border border-border rounded-2xl p-5', className)}>
    <div className="flex items-center gap-4 mb-4">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
    <SkeletonText lines={3} />
    <div className="flex gap-3 mt-4 pt-4 border-t border-border">
      <Skeleton className="h-10 w-24 rounded-xl" />
      <Skeleton className="h-10 w-24 rounded-xl" />
    </div>
  </div>
);

SkeletonCard.displayName = 'SkeletonCard';

const SkeletonAvatar = ({
  size = 'md',
  className,
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) => {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  };

  return (
    <Skeleton className={cn('rounded-full', sizeClasses[size], className)} />
  );
};

SkeletonAvatar.displayName = 'SkeletonAvatar';

const SkeletonButton = ({
  size = 'md',
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) => {
  const sizeClasses = {
    sm: 'h-9 w-20',
    md: 'h-11 w-28',
    lg: 'h-14 w-36',
  };

  return (
    <Skeleton className={cn('rounded-xl', sizeClasses[size], className)} />
  );
};

SkeletonButton.displayName = 'SkeletonButton';

const SkeletonInput = ({ className }: { className?: string }) => (
  <div className={cn('space-y-1.5', className)}>
    <Skeleton className="h-4 w-20" />
    <Skeleton className="h-11 w-full rounded-xl" />
  </div>
);

SkeletonInput.displayName = 'SkeletonInput';

export {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonInput,
};
