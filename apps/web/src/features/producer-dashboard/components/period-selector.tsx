import { useNavigate } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import {
  DEFAULT_METRICS_PERIOD,
  METRICS_PERIODS,
  type MetricsPeriod,
} from '../metrics';

const labels: Record<MetricsPeriod, string> = {
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
  all: 'All time',
};

export function PeriodSelector({ period }: { period: MetricsPeriod }) {
  const navigate = useNavigate();
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">Reporting period</legend>
      <div className="inline-flex rounded-lg border bg-muted p-0.5">
        {METRICS_PERIODS.map((value) => (
          <label key={value} className="relative">
            <input
              type="radio"
              name="metrics-period"
              value={value}
              checked={value === period}
              onChange={() =>
                void navigate({
                  to: '/producer',
                  search:
                    value === DEFAULT_METRICS_PERIOD ? {} : { period: value },
                })
              }
              className="peer sr-only"
            />
            <span
              className={cn(
                'block cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors motion-reduce:transition-none',
                'hover:text-foreground peer-checked:bg-background peer-checked:text-foreground peer-checked:shadow-xs',
                'peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50',
              )}
            >
              {labels[value]}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
