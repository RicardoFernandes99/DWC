import { Link } from '@tanstack/react-router';
import { Card } from '@/components/ui/card';
import { formatLabel, formatMoney } from '@/lib/format';
import type { components } from '@/lib/api-schema';
import { orderDateLabel, orderStatusText, orderSteps } from './order-format';

type Order = components['schemas']['OrderResponseDto'];
type OrderStatus = Order['status'];
type Audience = 'buyer' | 'producer';
type RefundStatus = NonNullable<Order['refundRequest']>['status'];

export function OrderCard({
  order,
  audience,
  page,
}: {
  order: Order;
  audience: Audience;
  page: number;
}) {
  const detail =
    audience === 'buyer' ? '/orders/$orderId' : '/producer/orders/$orderId';
  const steps = orderSteps(order.fulfilmentMethod);
  const index = steps.indexOf(order.status);
  return (
    <Card className="p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            {audience === 'buyer'
              ? typeof order.producerName === 'string'
                ? order.producerName
                : 'Local producer'
              : typeof order.buyerName === 'string'
                ? order.buyerName
                : 'Buyer'}{' '}
            · {orderDateLabel(order.createdAt)}
          </p>
          <Link
            to={detail}
            params={{ orderId: order.id }}
            search={{ page }}
            className="mt-1 inline-flex min-h-11 items-center break-all font-medium text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Order {order.id.slice(-8).toUpperCase()}
          </Link>
          <p className="mt-1 text-sm text-muted-foreground">
            {order.items.map((item) => item.productName).join(', ')}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>
      {order.status !== 'cancelled' && index >= 0 && (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none"
              style={{ width: `${((index + 1) / steps.length) * 100}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {orderStatusText(order.status)} ·{' '}
            {formatLabel(order.fulfilmentMethod)}
          </p>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm">
        <span>
          {order.items.length} {order.items.length === 1 ? 'item' : 'items'} ·{' '}
          {order.fulfilmentMethod === 'delivery' ? 'Delivery' : 'Collection'}
        </span>
        <span className="font-semibold tabular-nums">
          {formatMoney(order.totalCents)}
        </span>
      </div>
    </Card>
  );
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const terminal = status === 'cancelled';
  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-md border px-3 text-sm font-medium ${terminal ? 'border-destructive/40 bg-destructive/5 text-destructive' : 'border-primary/30 bg-secondary text-foreground'}`}
    >
      {orderStatusText(status)}
    </span>
  );
}

export function OrderTimeline({ order }: { order: Order }) {
  const steps = orderSteps(order.fulfilmentMethod);
  const activeIndex = steps.indexOf(order.status);
  return (
    <ol
      className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4"
      aria-label={`${formatLabel(order.fulfilmentMethod)} timeline`}
    >
      {steps.map((step, index) => {
        const history = order.statusHistory.find(
          (item) => item.status === step,
        );
        const reached = history !== undefined || index <= activeIndex;
        return (
          <li
            key={step}
            className={`min-w-0 rounded-md border p-3 ${history ? 'border-primary/40 bg-secondary' : reached ? 'border-primary/25' : 'border-border bg-muted/30'}`}
          >
            <p className="text-sm font-medium">{orderStatusText(step)}</p>
            {history ? (
              <>
                <p className="mt-1 text-xs text-muted-foreground">
                  {orderDateLabel(history.timestamp)}
                </p>
                {typeof history.note === 'string' && history.note && (
                  <p className="mt-2 break-words text-xs">{history.note}</p>
                )}
              </>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                {reached ? 'Current step' : 'Up next'}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function RefundSummary({
  status,
  reason,
  requestedAt,
  decidedAt,
  refundedCents,
}: {
  status: RefundStatus;
  reason: string | null;
  requestedAt: string;
  decidedAt: string | null;
  refundedCents: number | null;
}) {
  return (
    <Card
      className={`p-5 md:p-7 ${status === 'open' ? 'border-highlight' : ''}`}
    >
      <h2 className="text-lg font-semibold">
        Refund request · {formatLabel(status)}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Requested {orderDateLabel(requestedAt)}
        {decidedAt ? ` · Decided ${orderDateLabel(decidedAt)}` : ''}
      </p>
      {reason && (
        <p className="mt-3 whitespace-pre-wrap break-words text-sm">
          <span className="font-medium">
            {status === 'declined'
              ? 'Producer response: '
              : status === 'open'
                ? 'Buyer reason: '
                : 'Request reason: '}
          </span>
          {reason}
        </p>
      )}
      {status === 'accepted' && refundedCents !== null && (
        <p className="mt-4 font-semibold tabular-nums">
          Refunded {formatMoney(refundedCents)}
        </p>
      )}
    </Card>
  );
}
