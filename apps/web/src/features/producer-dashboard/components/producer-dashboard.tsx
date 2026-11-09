import { useQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/session';
import {
  parseMetricsPeriod,
  producerMetricsOptions,
  type ProducerMetrics,
} from '../metrics';
import { BestSellers } from './best-sellers';
import { LowStock } from './low-stock';
import { PeriodSelector } from './period-selector';
import { SalesSummary } from './sales-summary';

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function rangeCopy(data: ProducerMetrics) {
  const to = dateFormatter.format(new Date(data.to));
  return data.from
    ? `Orders placed ${dateFormatter.format(new Date(data.from))} – ${to}`
    : `Orders placed all time, up to ${to}`;
}

export function ProducerDashboard({ canEdit }: { canEdit: boolean }) {
  // /producer can resolve to the splat route, so read search non-strictly.
  const period = parseMetricsPeriod(useSearch({ strict: false }).period);
  const query = useQuery(producerMetricsOptions(period));
  const data = query.data;
  const forbidden =
    query.error instanceof ApiError && query.error.status === 403;
  const switching = query.isPlaceholderData;

  return (
    <section
      className="mt-8"
      aria-labelledby="dashboard-title"
      aria-busy={query.isFetching}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="dashboard-title" className="text-2xl font-semibold">
            Sales and stock
          </h2>
          <p className="mt-1 text-sm text-muted-foreground" role="status">
            {data ? rangeCopy(data) : 'Orders, best sellers and low stock.'}
            {data && switching && ' · Updating…'}
            {data && !switching && query.isFetching && ' · Refreshing…'}
          </p>
        </div>
        <PeriodSelector period={period} />
      </div>

      {!data && query.isPending && (
        <div
          role="status"
          className="mt-4 flex min-h-64 items-center justify-center rounded-lg border text-sm text-muted-foreground"
        >
          Loading sales and stock...
        </div>
      )}

      {!data && query.isError && (
        <div role="alert" className="mt-4 rounded-lg border p-4 text-sm">
          <p>
            {forbidden
              ? 'Your account cannot view sales metrics right now.'
              : 'Could not load sales and stock.'}
          </p>
          {!forbidden && (
            <Button
              className="mt-3"
              variant="outline"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              {query.isFetching ? 'Retrying...' : 'Retry'}
            </Button>
          )}
        </div>
      )}

      {data && (
        <>
          {query.isError && !switching && (
            <div role="alert" className="mt-3 rounded-lg border p-4 text-sm">
              <p>
                {forbidden
                  ? 'Your account cannot view sales metrics right now.'
                  : 'Could not refresh sales and stock. The figures shown may be out of date.'}
              </p>
              {!forbidden && (
                <Button
                  className="mt-3"
                  variant="outline"
                  disabled={query.isFetching}
                  onClick={() => void query.refetch()}
                >
                  Retry
                </Button>
              )}
            </div>
          )}
          <div className={switching ? 'opacity-60' : undefined}>
            <SalesSummary sales={data.sales} />
            <div className="mt-8 grid gap-8 md:grid-cols-2">
              <BestSellers items={data.bestSellers} />
              <LowStock lowStock={data.lowStock} canEdit={canEdit} />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
