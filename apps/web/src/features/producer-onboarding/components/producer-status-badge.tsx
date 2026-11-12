import type { components } from '@/lib/api-schema';
import { cn } from '@/lib/utils';

type ProducerStatus = NonNullable<
  components['schemas']['UserResponseDto']['producerStatus']
>;

const LABELS: Record<ProducerStatus, string> = {
  pending: 'Pending approval',
  approved: 'Approved',
  rejected: 'Application rejected',
  suspended: 'Suspended',
};

const TONES: Record<ProducerStatus, string> = {
  approved: 'border-primary/30 bg-primary/10 text-primary',
  pending: 'border-warning/40 bg-warning/20 text-foreground',
  rejected: 'border-destructive/30 bg-destructive/10 text-destructive',
  suspended: 'border-destructive/30 bg-destructive/10 text-destructive',
};

/** Producer account status pill shown in the account header. */
export function ProducerStatusBadge({
  status,
  className,
}: {
  status: ProducerStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        TONES[status],
        className,
      )}
    >
      {LABELS[status]}
    </span>
  );
}
