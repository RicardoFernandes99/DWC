import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectPillProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  containerClassName?: string;
}

export const SelectPill = React.forwardRef<HTMLSelectElement, SelectPillProps>(
  ({ className, containerClassName, children, ...props }, ref) => {
    return (
      <div
        className={cn('relative inline-flex items-center', containerClassName)}
      >
        <select
          ref={ref}
          className={cn(
            'h-10 w-full appearance-none rounded-full border border-input bg-card pl-4 pr-9 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 size-4 text-muted-foreground"
        />
      </div>
    );
  },
);

SelectPill.displayName = 'SelectPill';
