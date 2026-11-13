import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Check, CircleCheck, CircleDashed } from 'lucide-react';
import { formatLabel, formatMoney } from '@/lib/format';
import type { components } from '@/lib/api-schema';
import { orderDateLabel, orderStatusText, orderSteps } from './order-format';

type Order = components['schemas']['OrderResponseDto'];
type Audience = 'buyer' | 'producer';

export function OrderRow({
  order,
  audience,
  page,
  stage,
}: {
  order: Order;
  audience: Audience;
  page: number;
  /** List tab to return to; omitted for the default "open" tab. */
  stage?: 'completed' | 'cancelled';
}) {
  const name = audience === 'buyer' ? order.producerName : order.buyerName;
  return (
    <li>
      <Link
        className="order-row"
        to={
          audience === 'buyer'
            ? '/orders/$orderId'
            : '/producer/orders/$orderId'
        }
        params={{ orderId: order.id }}
        search={{ page, ...(stage ? { stage } : {}) }}
      >
        <div className="order-row-identity">
          <span className="order-reference">
            #{order.id.slice(-8).toUpperCase()}
          </span>
          <span className="order-row-name">
            {typeof name === 'string'
              ? name
              : audience === 'buyer'
                ? 'Local producer'
                : 'Buyer'}
          </span>
          <span className="order-row-products">
            {order.items.map((item) => item.productName).join(', ')}
          </span>
        </div>
        <div className="order-row-date">
          <span>
            {new Intl.DateTimeFormat('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            }).format(new Date(order.createdAt))}
          </span>
          <span>{formatLabel(order.fulfilmentMethod)}</span>
        </div>
        <div className="order-row-state">
          <OrderStatusBadge status={order.status} />
          {order.refundRequest?.status === 'open' && (
            <span className="order-refund-note">Refund requested</span>
          )}
        </div>
        <span className="order-row-total">{formatMoney(order.totalCents)}</span>
        <ArrowUpRight
          className="order-row-arrow"
          size={18}
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

export function OrderStatusBadge({ status }: { status: Order['status'] }) {
  const complete = status === 'delivered' || status === 'collected';
  return (
    <span className="order-status" data-state={status}>
      <span aria-hidden="true" className="order-status-dot" />
      {orderStatusText(status)}
      {complete && <Check size={13} aria-hidden="true" />}
    </span>
  );
}

export function OrderTimeline({ order }: { order: Order }) {
  const steps = orderSteps(order.fulfilmentMethod);
  const activeIndex = steps.indexOf(order.status);
  return (
    <ol
      className="order-timeline"
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
            data-reached={reached}
            aria-current={order.status === step ? 'step' : undefined}
          >
            <span className="order-timeline-marker" aria-hidden="true">
              {reached ? (
                <Check size={13} strokeWidth={2.5} />
              ) : (
                <span>{index + 1}</span>
              )}
            </span>
            <span className="order-timeline-label">
              {orderStatusText(step)}
            </span>
            <span className="order-timeline-date">
              {history
                ? new Intl.DateTimeFormat('en-GB', {
                    day: 'numeric',
                    month: 'short',
                  }).format(new Date(history.timestamp))
                : 'Upcoming'}
            </span>
            {typeof history?.note === 'string' &&
              history.note &&
              history.note !== 'Order created via checkout' && (
                <span className="order-timeline-note">{history.note}</span>
              )}
          </li>
        );
      })}
    </ol>
  );
}

export function RefundSummary({
  request,
}: {
  request: NonNullable<Order['refundRequest']>;
}) {
  const Icon = request.status === 'open' ? CircleDashed : CircleCheck;
  return (
    <section className="order-refund-summary" aria-labelledby="refund-title">
      <div className="order-section-heading">
        <Icon size={18} aria-hidden="true" />
        <h2 id="refund-title">
          Refund request · {formatLabel(request.status)}
        </h2>
      </div>
      <p className="order-meta">
        Requested {orderDateLabel(request.requestedAt)}
        {request.decidedAt
          ? ` · Decided ${orderDateLabel(request.decidedAt)}`
          : ''}
      </p>
      {request.reason && (
        <p className="order-refund-reason">
          <span>
            {request.status === 'declined'
              ? 'Producer response'
              : 'Buyer reason'}
          </span>
          {request.reason}
        </p>
      )}
      {request.status === 'accepted' && request.refundedCents !== null && (
        <p className="order-refunded">
          Refunded {formatMoney(request.refundedCents)}
        </p>
      )}
    </section>
  );
}
