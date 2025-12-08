import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/helpers';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap text-sm font-semibold ring-offset-[#0D0D0D] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2D92] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-[#FF2D92] text-white hover:bg-[#FF1A85] shadow-lg shadow-pink-500/25',
        blue: 'bg-[#3B82F6] text-white hover:bg-[#2563EB] shadow-lg shadow-blue-500/25',
        destructive: 'bg-red-500 text-white hover:bg-red-600',
        outline: 'border-2 border-gray-700 bg-transparent text-white hover:bg-gray-800 hover:border-gray-600',
        secondary: 'bg-[#1A1A1A] text-white hover:bg-[#222222] border border-gray-800',
        ghost: 'text-gray-400 hover:bg-gray-800 hover:text-white',
        link: 'text-[#FF2D92] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-6 py-2 rounded-xl',
        sm: 'h-9 px-4 rounded-lg text-xs',
        lg: 'h-14 px-8 rounded-xl text-base',
        xl: 'h-16 px-10 rounded-xl text-lg',
        icon: 'h-10 w-10 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
