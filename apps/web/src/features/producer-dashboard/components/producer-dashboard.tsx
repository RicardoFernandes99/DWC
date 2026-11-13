import { useQuery } from '@tanstack/react-query';
import { Link, useSearch } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import type { components } from '@/lib/api-schema';
import { formatMoney, formatUnit } from '@/lib/format';
import { ApiError, authenticatedRequest } from '@/lib/session';
import { cn } from '@/lib/utils';
import {
  DEFAULT_METRICS_PERIOD,
  parseMetricsPeriod,
  producerMetricsOptions,
  type ProducerMetrics,
} from '../metrics';
import { PeriodSelector } from './period-selector';

type ProductList = components['schemas']['ProducerProductListResponseDto'];

const card = 'rounded-xl border bg-card p-4 md:p-5';

/** Attention banner for orders that need the producer to act. */
export function AttentionBanner() {
  const query = useQuery(producerMetricsOptions(DEFAULT_METRICS_PERIOD));
  const attention = query.data?.attention;
  if (!attention) return null;
  const total = attention.pendingOrders + attention.openRefunds;
  if (total === 0) return null;
  const parts = [
    attention.pendingOrders &&
      `${attention.pendingOrders} new ${attention.pendingOrders === 1 ? 'order' : 'orders'}`,
    attention.openRefunds &&
      `${attention.openRefunds} refund ${attention.openRefunds === 1 ? 'request' : 'requests'}`,
  ].filter(Boolean);
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-highlight/40 bg-highlight/25 px-4 py-3 md:px-5"
    >
      <p className="text-sm">
        <strong className="font-semibold">
          {total} {total === 1 ? 'order needs' : 'orders need'} you
        </strong>{' '}
        — {parts.join(' and ')}.
      </p>
      <Button asChild size="sm">
        <Link to="/producer/orders" search={{ page: 1 }}>
          Open orders
        </Link>
      </Button>
    </div>
  );
}

export function ProducerDashboard({ canEdit }: { canEdit: boolean }) {
  // /producer can resolve to the splat route, so read search non-strictly.
  const period = parseMetricsPeriod(useSearch({ strict: false }).period);
  const query = useQuery(producerMetricsOptions(period));
  const data = query.data;
  const forbidden =
    query.error instanceof ApiError && query.error.status === 403;

  return (
    <section
      className="mt-6 space-y-4"
      aria-labelledby="dashboard-title"
      aria-busy={query.isFetching}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="dashboard-title" className="text-2xl">
            Sales
          </h2>
          <p className="text-sm text-muted-foreground">
            Orders not cancelled or refunded
          </p>
        </div>
        <PeriodSelector period={period} />
      </div>

      {!data && query.isPending && (
        <div
          role="status"
          className="grid min-h-64 place-items-center rounded-xl border bg-card text-sm text-muted-foreground"
        >
          Loading sales…
        </div>
      )}
      {query.isError && (
        <div role="alert" className="rounded-xl border bg-card p-4 text-sm">
          <p>
            {forbidden
              ? 'Your account cannot view sales metrics right now.'
              : data
                ? 'Could not refresh sales. The figures shown may be out of date.'
                : 'Could not load sales.'}
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

      {data && (
        <div
          className={cn('space-y-4', query.isPlaceholderData && 'opacity-60')}
        >
          <SalesCards data={data} />
          {data.daily.length > 0 && <OrdersChart daily={data.daily} />}
          <div className="grid gap-4 md:grid-cols-2">
            <BestSellers data={data} />
            <StockHealth canEdit={canEdit} />
          </div>
        </div>
      )}
    </section>
  );
}

function Delta({
  current,
  previous,
  money,
  period,
}: {
  current: number;
  previous: number;
  money?: boolean;
  period: string;
}) {
  const diff = current - previous;
  const text =
    diff === 0
      ? 'Same as'
      : `${diff > 0 ? '+' : '−'}${money ? formatMoney(Math.abs(diff)) : Math.abs(diff)} vs`;
  return (
    <p
      className={cn(
        'mt-2 text-xs font-medium',
        diff > 0 ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      {text} previous {period}
    </p>
  );
}

const periodName: Record<ProducerMetrics['period'], string> = {
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
  all: '',
};

function SalesCards({ data }: { data: ProducerMetrics }) {
  const { sales, previous } = data;
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      <div className={card}>
        <dt className="text-sm text-muted-foreground">Orders</dt>
        <dd className="mt-1 font-editorial text-4xl tabular-nums">
          {sales.orderCount}
        </dd>
        {previous ? (
          <Delta
            current={sales.orderCount}
            previous={previous.orderCount}
            period={periodName[data.period]}
          />
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">All time</p>
        )}
      </div>
      <div className={card}>
        <dt className="text-sm text-muted-foreground">Product revenue</dt>
        <dd className="mt-1 font-editorial text-4xl tabular-nums">
          {formatMoney(sales.productRevenueCents)}
        </dd>
        {previous ? (
          <Delta
            money
            current={sales.productRevenueCents}
            previous={previous.productRevenueCents}
            period={periodName[data.period]}
          />
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">All time</p>
        )}
      </div>
    </dl>
  );
}

const dayFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

function OrdersChart({ daily }: { daily: ProducerMetrics['daily'] }) {
  const max = Math.max(1, ...daily.map((day) => day.orderCount));
  const total = daily.reduce((sum, day) => sum + day.orderCount, 0);
  return (
    <section className={card} aria-labelledby="orders-chart-title">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="orders-chart-title" className="text-xl">
          Orders per day
        </h3>
        <p className="text-xs text-muted-foreground">
          Catalogue and auction orders
        </p>
      </div>
      <div
        role="img"
        aria-label={`${total} orders over ${daily.length} days, at most ${max} in one day.`}
        className="mt-4 flex h-32 items-end gap-[2px] md:gap-1"
      >
        {daily.map((day) => (
          <div
            key={day.date}
            title={`${dayFormatter.format(new Date(day.date))}: ${day.orderCount} ${day.orderCount === 1 ? 'order' : 'orders'}`}
            className={cn(
              'min-w-0 flex-1 rounded-t-sm',
              day.orderCount ? 'bg-primary' : 'bg-border',
            )}
            style={{
              height: day.orderCount
                ? `${Math.max(8, (day.orderCount / max) * 100)}%`
                : '3px',
            }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
        <span>{dayFormatter.format(new Date(daily[0]!.date))}</span>
        <span>{dayFormatter.format(new Date(daily.at(-1)!.date))}</span>
      </div>
    </section>
  );
}

function BestSellers({ data }: { data: ProducerMetrics }) {
  return (
    <section className={card} aria-labelledby="best-sellers-title">
      <h3 id="best-sellers-title" className="text-xl">
        Best sellers
      </h3>
      {data.bestSellers.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No sales in this period.
        </p>
      ) : (
        <ol className="mt-2 divide-y text-sm">
          {data.bestSellers.map((item) => (
            <li
              key={item.productId}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <span className="min-w-0 truncate">{item.productName}</span>
              <span className="flex shrink-0 items-baseline gap-3 tabular-nums">
                <span className="text-xs text-muted-foreground">
                  {item.orderCount} {item.orderCount === 1 ? 'order' : 'orders'}
                </span>
                <span className="font-semibold">
                  {formatMoney(item.productRevenueCents)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function StockHealth({ canEdit }: { canEdit: boolean }) {
  const query = useQuery({
    queryKey: ['producer-products', 'stock-health'],
    queryFn: () =>
      authenticatedRequest<ProductList>('producer/products?page=1&limit=50'),
  });
  const items = (query.data?.items ?? [])
    .filter((product) => !product.archivedAt)
    .sort(
      (left, right) =>
        left.availableStock / Math.max(1, left.lowStockThreshold) -
        right.availableStock / Math.max(1, right.lowStockThreshold),
    )
    .slice(0, 6);
  return (
    <section className={card} aria-labelledby="stock-health-title">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="stock-health-title" className="text-xl">
          Stock health
        </h3>
        <Link
          to="/producer/products"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Products
        </Link>
      </div>
      {query.isPending ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading stock…</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {canEdit ? 'Add a product to track its stock.' : 'No products yet.'}
        </p>
      ) : (
        <ul className="mt-3 space-y-3 text-sm">
          {items.map((product) => {
            const low = product.availableStock <= product.lowStockThreshold;
            // Full bar at four times the low-stock threshold.
            const fill = Math.min(
              1,
              product.availableStock /
                Math.max(1, product.lowStockThreshold * 4),
            );
            return (
              <li key={product.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate">{product.name}</span>
                  <span
                    className={cn(
                      'shrink-0 tabular-nums',
                      low
                        ? 'font-medium text-destructive'
                        : 'text-muted-foreground',
                    )}
                  >
                    {product.availableStock} {formatUnit(product.unit)}
                    {low && ' · low'}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      low ? 'bg-highlight' : 'bg-primary',
                    )}
                    style={{ width: `${Math.max(4, fill * 100)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
