import { queryOptions, keepPreviousData } from '@tanstack/react-query';
import type { components } from '@/lib/api-schema';
import { ApiError, authenticatedRequest } from '@/lib/session';

export type ProducerMetrics =
  components['schemas']['ProducerMetricsResponseDto'];
export type MetricsPeriod = ProducerMetrics['period'];

export const METRICS_PERIODS: readonly MetricsPeriod[] = [
  '7d',
  '30d',
  '90d',
  'all',
];
export const DEFAULT_METRICS_PERIOD: MetricsPeriod = '7d';

/** Invalid, missing or default periods fall back to 30d. */
export function parseMetricsPeriod(value: unknown): MetricsPeriod {
  return (
    METRICS_PERIODS.find((period) => period === value) ?? DEFAULT_METRICS_PERIOD
  );
}

/** Shared by every route that can render the dashboard; omits the default. */
export function validateMetricsSearch(search: Record<string, unknown>): {
  period?: MetricsPeriod;
} {
  const period = parseMetricsPeriod(search.period);
  return period === DEFAULT_METRICS_PERIOD ? {} : { period };
}

/** Prefix used to invalidate every cached period after product changes. */
export const producerMetricsKey = ['producer-metrics'] as const;

export function producerMetricsOptions(period: MetricsPeriod) {
  return queryOptions({
    queryKey: [...producerMetricsKey, period] as const,
    queryFn: () =>
      authenticatedRequest<ProducerMetrics>(
        `producer/metrics?period=${period}`,
      ),
    staleTime: 0,
    refetchOnMount: 'always',
    placeholderData: keepPreviousData,
    retry: (count, error) =>
      count < 1 &&
      !(error instanceof ApiError && [401, 403].includes(error.status)),
  });
}
