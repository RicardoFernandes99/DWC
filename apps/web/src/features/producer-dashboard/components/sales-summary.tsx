import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { formatMoney } from '@/lib/format';
import type { ProducerMetrics } from '../metrics';

function Tile({
  label,
  value,
  note,
  className,
}: {
  label: string;
  value: string;
  note?: string;
  className?: string;
}) {
  return (
    <Card className={cn('min-w-0 p-4', className)}>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
      {note && <dd className="mt-1 text-xs text-muted-foreground">{note}</dd>}
    </Card>
  );
}

function Channel({
  label,
  orderCount,
  revenueCents,
}: {
  label: string;
  orderCount: number;
  revenueCents: number;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium tabular-nums">
        {formatMoney(revenueCents)}
        <span className="font-normal text-muted-foreground">
          {' '}
          · {orderCount} {orderCount === 1 ? 'order' : 'orders'}
        </span>
      </dd>
    </div>
  );
}

export function SalesSummary({ sales }: { sales: ProducerMetrics['sales'] }) {
  return (
    <>
      <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Tile label="Orders" value={String(sales.orderCount)} />
        <Tile
          label="Product revenue"
          value={formatMoney(sales.productRevenueCents)}
        />
        <Tile
          label="Delivery fees"
          value={formatMoney(sales.deliveryFeesCents)}
          note="Not included in revenue"
          className="col-span-2 md:col-span-1"
        />
      </dl>
      <dl className="mt-3 grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
        <Channel
          label="Catalogue sales"
          orderCount={sales.catalogue.orderCount}
          revenueCents={sales.catalogue.productRevenueCents}
        />
        <Channel
          label="Auction sales"
          orderCount={sales.auction.orderCount}
          revenueCents={sales.auction.productRevenueCents}
        />
      </dl>
    </>
  );
}
