import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const variants = {
  /** Matches `Input`: bordered field on the page background. */
  default:
    'h-10 rounded-md border border-input bg-background pl-3 pr-9 shadow-xs focus-visible:border-ring',
  /** Translucent pill for controls laid over a photo. */
  pill: 'h-9 rounded-full border-0 bg-white/90 pl-4 pr-9 font-medium text-foreground shadow-xs',
} as const;

/**
 * Native `<select>` with the browser arrow replaced by an inset chevron.
 * Use it where a native control is the better fit (inside popovers, compact
 * overlays, long option lists); `Select` covers the custom dropdown case.
 * `className` styles the select; `wrapperClassName` sizes the outer box.
 */
function NativeSelect({
  variant = 'default',
  className,
  wrapperClassName,
  children,
  ...props
}: React.ComponentProps<'select'> & {
  variant?: keyof typeof variants;
  wrapperClassName?: string;
}) {
  return (
    <span
      data-slot="native-select"
      className={cn('relative inline-flex max-w-full', wrapperClassName)}
    >
      <select
        className={cn(
          'w-full min-w-0 cursor-pointer appearance-none truncate text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20',
          variants[variant],
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-foreground/60"
      />
    </span>
  );
}

export { NativeSelect };
