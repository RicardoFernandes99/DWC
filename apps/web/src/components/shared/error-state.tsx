import { CloudOff, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from './empty-state';

/**
 * Failed-to-load state in the same shape as `EmptyState`: icon, title, short
 * explanation and a retry button that shows progress while refetching.
 */
export function ErrorState({
  title,
  description = 'Check your connection and try again.',
  onRetry,
  retrying = false,
  size = 'section',
  headingLevel = 'h2',
  className,
}: {
  title: string;
  description?: string;
  onRetry?: () => void;
  retrying?: boolean;
  size?: 'page' | 'section';
  headingLevel?: 'h1' | 'h2' | 'h3';
  className?: string;
}) {
  return (
    <div role="alert" className={className}>
      <EmptyState
        tone="error"
        icon={<CloudOff />}
        title={title}
        description={description}
        size={size}
        headingLevel={headingLevel}
        action={
          onRetry && (
            <Button variant="outline" disabled={retrying} onClick={onRetry}>
              <RotateCw
                aria-hidden="true"
                className={
                  retrying ? 'animate-spin motion-reduce:animate-none' : ''
                }
              />
              {retrying ? 'Trying again…' : 'Try again'}
            </Button>
          )
        }
      />
    </div>
  );
}
