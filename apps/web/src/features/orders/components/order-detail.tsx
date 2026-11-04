import { Check, Package, Truck, MapPin, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatLabel, formatMoney, formatUnit } from '@/lib/format';
import type { components } from '@/lib/api-schema';
import { OrderReview } from '@/features/reviews/components/order-review';
import { OrderTimeline, RefundSummary } from './order-presentation';
import { orderDateLabel, orderStatusText } from './order-format';
import {
  ProducerOrderActions,
  type OrderAction,
} from './producer-order-actions';

type Order = components['schemas']['OrderResponseDto'];
export function OrderDetail({
  order,
  audience,
  next,
  description,
  pending,
  reason,
  setReason,
  act,
}: {
  order: Order;
  audience: 'buyer' | 'producer';
  next: Order['status'] | undefined;
  description: string;
  pending: boolean;
  reason: string;
  setReason: (value: string) => void;
  act: OrderAction;
}) {
  const complete = order.status === 'delivered' || order.status === 'collected';
  const canRequest =
    audience === 'buyer' &&
    order.status === 'pending' &&
    order.origin === 'catalogue' &&
    order.refundRequest?.status !== 'open' &&
    order.refundRequest?.status !== 'accepted';
  const partner = audience === 'buyer' ? order.producerName : order.buyerName;
  const Icon = complete
    ? Check
    : order.fulfilmentMethod === 'delivery'
      ? Truck
      : Package;
  return (
    <div className="order-detail-grid" aria-label="Order detail">
      <div className="order-main-column">
        <section
          className="order-progress"
          aria-labelledby="order-progress-title"
        >
          <div className="order-progress-top">
            <span className="order-method">
              <Icon size={18} aria-hidden="true" />
              {formatLabel(order.fulfilmentMethod)}
              {order.origin === 'auction' ? ' · Auction win' : ''}
            </span>
            <span className="order-meta">
              {typeof partner === 'string'
                ? partner
                : audience === 'buyer'
                  ? 'Local producer'
                  : 'Buyer'}
            </span>
          </div>
          <h2 id="order-progress-title" className="order-current-status">
            {order.status === 'cancelled'
              ? 'Cancelled & refunded'
              : orderStatusText(order.status)}
          </h2>
          <p className="order-progress-description">{description}</p>
          {order.status !== 'cancelled' && <OrderTimeline order={order} />}
          {order.status === 'cancelled' && (
            <p className="order-terminal-note">
              <Check size={16} aria-hidden="true" />
              No further action is needed.
            </p>
          )}
        </section>
        {audience === 'producer' && order.status !== 'cancelled' && (
          <ProducerOrderActions
            order={order}
            next={next}
            pending={pending}
            reason={reason}
            setReason={setReason}
            act={act}
          />
        )}
        {order.refundRequest && <RefundSummary request={order.refundRequest} />}
        {audience === 'buyer' && complete && <OrderReview orderId={order.id} />}
        {canRequest && (
          <details className="order-request-disclosure">
            <summary>
              Need to request a refund?<span aria-hidden="true">+</span>
            </summary>
            <div className="order-disclosure-content">
              <p className="order-action-copy">
                The producer will review your request. Confirmation is paused
                while the request is open.
              </p>
              <form
                className="order-refund-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (reason.trim())
                    act(`orders/${order.id}/refund-requests`, 'POST', {
                      reason: reason.trim(),
                    });
                }}
              >
                <label htmlFor="refund-reason">Reason</label>
                <Textarea
                  id="refund-reason"
                  maxLength={500}
                  required
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  aria-describedby="refund-reason-help"
                />
                <p id="refund-reason-help" className="order-meta">
                  Explain why you need the order refunded.
                </p>
                <Button disabled={!reason.trim() || pending}>
                  {pending ? 'Sending…' : 'Send refund request'}
                </Button>
              </form>
            </div>
          </details>
        )}
        <section className="order-items" aria-labelledby="order-items-title">
          <div className="order-section-heading">
            <h2 id="order-items-title">What’s in your order</h2>
            <span className="order-meta">
              {order.items.length}{' '}
              {order.items.length === 1 ? 'product' : 'products'}
            </span>
          </div>
          <ul>
            {order.items.map((line) => (
              <li key={line.productId}>
                <span className="order-item-quantity">
                  {line.quantity}
                  <span>{formatUnit(line.productUnit)}</span>
                </span>
                <div className="order-item-name">
                  <span>{line.productName}</span>
                  <span>
                    {formatMoney(line.unitPriceCents)} /{' '}
                    {formatUnit(line.productUnit)}
                  </span>
                </div>
                <span className="order-item-total">
                  {formatMoney(line.lineTotalCents)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <aside className="order-sidebar" aria-label="Payment and fulfilment">
        <section
          className="order-receipt"
          aria-labelledby="order-payment-title"
        >
          <div className="order-section-heading">
            <h2 id="order-payment-title">Payment summary</h2>
            <CreditCard size={17} aria-hidden="true" />
          </div>
          <p className="order-receipt-total">{formatMoney(order.totalCents)}</p>
          <p className="order-meta">Paid for this order</p>
          <dl>
            <div>
              <dt>Products</dt>
              <dd>{formatMoney(order.subtotalCents)}</dd>
            </div>
            <div>
              <dt>Delivery fee</dt>
              <dd>
                {order.deliveryFeeCents === 0
                  ? 'Free'
                  : formatMoney(order.deliveryFeeCents)}
              </dd>
            </div>
            <div className="order-receipt-sum">
              <dt>Order total</dt>
              <dd>{formatMoney(order.totalCents)}</dd>
            </div>
          </dl>
          {order.payment && (
            <div className="order-payment-method">
              <span>Card ending {order.payment.cardLast4}</span>
              {order.payment.amountCents !== order.totalCents && (
                <span>
                  Shared checkout charge{' '}
                  {formatMoney(order.payment.amountCents)}
                </span>
              )}
              <span>Payment simulated · EUR</span>
            </div>
          )}
          {order.status === 'cancelled' && (
            <div className="order-receipt-refund">
              <Check size={15} aria-hidden="true" />
              <span>
                Refunded{' '}
                {formatMoney(
                  order.refundRequest?.refundedCents ?? order.totalCents,
                )}
              </span>
            </div>
          )}
        </section>
        <section
          className="order-fulfilment"
          aria-labelledby="order-fulfilment-title"
        >
          <div className="order-section-heading">
            <MapPin size={17} aria-hidden="true" />
            <h2 id="order-fulfilment-title">
              {order.fulfilmentMethod === 'delivery'
                ? 'Delivering to'
                : 'Collection'}
            </h2>
          </div>
          {order.deliveryAddress ? (
            <>
              <address>
                {order.deliveryAddress.recipientName}
                <br />
                {order.deliveryAddress.street}
                <br />
                {order.deliveryAddress.postalCode} {order.deliveryAddress.city}
                <br />
                {order.deliveryAddress.country}
              </address>
              {typeof order.deliveryAddress.notes === 'string' &&
                order.deliveryAddress.notes && (
                  <p className="order-address-note">
                    {order.deliveryAddress.notes}
                  </p>
                )}
            </>
          ) : (
            <p className="order-action-copy">
              Collect from{' '}
              {typeof order.producerName === 'string'
                ? order.producerName
                : 'the producer'}
              . Your producer will mark the order ready before collection.
            </p>
          )}
        </section>
        <details className="order-reference-details">
          <summary>Order information</summary>
          <dl>
            <dt>Reference</dt>
            <dd>{order.id}</dd>
            <dt>Placed</dt>
            <dd>{orderDateLabel(order.createdAt)}</dd>
            <dt>Source</dt>
            <dd>{formatLabel(order.origin)}</dd>
          </dl>
        </details>
      </aside>
    </div>
  );
}
