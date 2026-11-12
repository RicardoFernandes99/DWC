import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Shared empty state: icon in a soft circle, title, short explanation and an
 * optional action. `size="page"` is for a whole screen, `"section"` for a
 * block inside a page.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  size = 'section',
  headingLevel = 'h2',
  tone = 'default',
  className,
  titleId,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  size?: 'page' | 'section';
  headingLevel?: 'h1' | 'h2' | 'h3';
  /** `error` tints the icon circle for failed-to-load states. */
  tone?: 'default' | 'error';
  className?: string;
  titleId?: string;
}) {
  const Heading = headingLevel;
  const page = size === 'page';
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border bg-card text-center shadow-2xs',
        page ? 'p-10 md:p-14' : 'p-6 md:p-8',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          'grid place-items-center rounded-full [&_svg]:stroke-[1.5]',
          tone === 'error'
            ? 'bg-destructive/10 text-destructive'
            : 'bg-secondary text-primary',
          page ? 'size-16 [&_svg]:size-8' : 'size-12 [&_svg]:size-6',
        )}
      >
        {icon}
      </div>
      <Heading
        id={titleId}
        className={cn(
          'font-editorial font-semibold',
          page ? 'mt-4 text-2xl' : 'mt-3 text-lg',
        )}
      >
        {title}
      </Heading>
      {description && (
        <p
          className={cn(
            'max-w-md leading-relaxed text-muted-foreground',
            page ? 'mt-2 text-sm' : 'mt-1 text-sm',
          )}
        >
          {description}
        </p>
      )}
      {action && <div className={page ? 'mt-6' : 'mt-4'}>{action}</div>}
    </section>
  );
}
