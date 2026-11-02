import { useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  ApiError,
  authenticatedRequest,
  currentUser,
  type User,
} from '@/lib/session';
import { formatMoney, formatUnit } from '@/lib/format';
import type { components } from '@/lib/api-schema';
import {
  OrderCard,
  OrderStatusBadge,
  OrderTimeline,
  RefundSummary,
} from './order-presentation';
import { orderDateLabel, orderSteps } from './order-format';
import { ProducerOrderActions } from './producer-order-actions';

type Audience = 'buyer' | 'producer';
type Order = components['schemas']['OrderResponseDto'];
type OrderList = components['schemas']['OrderListResponseDto'];
type OrderStatus = Order['status'];

function isOrderList(value: Order | OrderList): value is OrderList {
  return 'totalPages' in value;
}

const pageSize = 10;
const queryRoot = ['orders'] as const;
function moneyLabel(cents: number) {
  return formatMoney(cents);
}

function nextStatus(order: Order): OrderStatus | undefined {
  const steps = orderSteps(order.fulfilmentMethod);
  const index = steps.indexOf(order.status);
  return index >= 0 ? steps[index + 1] : undefined;
}

function statusDescription(order: Order) {
  if (order.status === 'cancelled') {
    if (order.origin === 'catalogue') {
      const refundedCents =
        order.refundRequest?.refundedCents ?? order.totalCents;
      return `This order was cancelled and ${formatMoney(refundedCents)} was refunded, including the delivery fee.`;
    }
    return 'This order was cancelled.';
  }
  if (order.refundRequest?.status === 'open')
    return 'A refund request is open. Confirmation is paused until the producer decides.';
  switch (order.status) {
    case 'pending':
      return 'The producer has received this order and will review it.';
    case 'confirmed':
      return order.fulfilmentMethod === 'delivery'
        ? 'The order is confirmed and will be dispatched next.'
        : 'The order is confirmed and will be prepared for collection.';
    case 'shipped':
      return 'This order is on its way.';
    case 'delivered':
      return 'This order was delivered.';
    case 'ready_for_collection':
      return 'This order is ready for collection.';
    case 'collected':
      return 'This order was collected.';
  }
}

export function OrderTrackingPage({ audience }: { audience: Audience }) {
  const params = useParams({ strict: false });
  const id = 'orderId' in params ? params.orderId : undefined;
  const session = useQuery({
    queryKey: ['session'],
    queryFn: currentUser,
    retry: false,
  });
  return (
    <OrderTrackingContent
      key={`${audience}:${id ?? 'list'}:${session.data?.id ?? 'anonymous'}`}
      audience={audience}
      id={id}
      session={session}
    />
  );
}

function OrderTrackingContent({
  audience,
  id,
  session,
}: {
  audience: Audience;
  id: string | undefined;
  session: UseQueryResult<User | null, Error>;
}) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const search = useSearch({ strict: false });
  const page =
    typeof search.page === 'number' && Number.isInteger(search.page)
      ? search.page
      : 1;
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const userId = session.data?.id ?? 'anonymous';
  const orders = useQuery({
    queryKey: id
      ? [...queryRoot, audience, userId, id]
      : [...queryRoot, audience, userId, 'list', page],
    queryFn: async (): Promise<Order | OrderList> => {
      if (id)
        return authenticatedRequest<Order>(`orders/${encodeURIComponent(id)}`);
      return authenticatedRequest<OrderList>(
        `orders?page=${page}&limit=${pageSize}`,
      );
    },
    enabled: Boolean(
      session.data &&
      session.data.role === audience &&
      (!id || /^[a-f\d]{24}$/i.test(id)),
    ),
    retry: false,
  });
  const order =
    id && orders.data && !isOrderList(orders.data) ? orders.data : undefined;
  const mutation = useMutation({
    mutationFn: async (action: {
      endpoint: string;
      method: 'PATCH' | 'POST';
      body?: Record<string, unknown>;
    }) =>
      authenticatedRequest<Order>(action.endpoint, {
        method: action.method,
        body: action.body ? JSON.stringify(action.body) : undefined,
      }),
    onSuccess: async (updated) => {
      if (client.getQueryData<User | null>(['session'])?.id !== userId) return;
      setErrorMessage('');
      setReason('');
      setNotice('Order updated. The latest server status is shown below.');
      client.setQueryData(
        [...queryRoot, audience, userId, updated.id],
        updated,
      );
      await client.invalidateQueries({
        queryKey: [...queryRoot, audience, userId],
      });
    },
    onError: async (error) => {
      setNotice('');
      setErrorMessage(
        error instanceof ApiError && error.status === 409
          ? 'The server rejected this action because the order changed. Refresh the order and review its latest state before deciding what to do.'
          : error instanceof Error
            ? error.message
            : 'The action could not be completed. Please try again.',
      );
      await Promise.all([
        client.invalidateQueries({
          queryKey: [...queryRoot, audience, userId],
        }),
        id
          ? client.invalidateQueries({
              queryKey: [...queryRoot, audience, userId, id],
            })
          : Promise.resolve(),
      ]);
    },
  });

  function act(
    endpoint: string,
    method: 'PATCH' | 'POST',
    body?: Record<string, unknown>,
  ) {
    if (orders.isFetching || orders.isError) return;
    setNotice('');
    setErrorMessage('');
    mutation.mutate({ endpoint, method, body });
  }

  if (session.isPending)
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 md:px-6" role="status">
        Restoring your session…
      </main>
    );
  if (session.error)
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 md:px-6">
        <h1 className="text-2xl font-semibold">Orders are unavailable</h1>
        <p className="mt-3 text-muted-foreground">
          Could not restore your account. Please try again.
        </p>
        <Button
          className="mt-5"
          variant="outline"
          onClick={() => void session.refetch()}
        >
          Try again
        </Button>
      </main>
    );
  const user: User | null | undefined = session.data;
  if (!user || user.role !== audience) return null;

  if (id && !/^[a-f\d]{24}$/i.test(id))
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 md:px-6">
        <h1 className="text-2xl font-semibold">Order reference is invalid</h1>
        <p className="mt-3 text-muted-foreground">
          Order references must contain 24 hexadecimal characters.
        </p>
        <Button
          className="mt-5 min-h-11"
          variant="outline"
          onClick={() =>
            void navigate({
              to: audience === 'buyer' ? '/orders' : '/producer/orders',
              search: { page },
            })
          }
        >
          Back to orders
        </Button>
      </main>
    );

  const title = audience === 'buyer' ? 'Your orders' : 'Producer orders';
  const backToList = () => {
    void navigate({
      to: audience === 'buyer' ? '/orders' : '/producer/orders',
      search: { page },
    });
  };
  const next = order && nextStatus(order);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12 xl:py-16">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">From Farm to Table</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {id ? 'Order details' : title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {audience === 'buyer'
              ? 'Follow delivery or collection and review any refund updates.'
              : 'Fulfil orders one step at a time and manage pending refund requests.'}
          </p>
        </div>
        {id && (
          <Button
            variant="outline"
            className="min-h-11 self-start md:self-auto"
            onClick={backToList}
          >
            <ArrowLeft aria-hidden="true" />
            Back to orders
          </Button>
        )}
      </div>

      {audience === 'producer' && user.producerStatus === 'suspended' && (
        <div
          className="mt-6 rounded-lg border border-highlight bg-highlight/40 p-4 text-sm"
          role="status"
        >
          <p className="font-semibold">Account suspended</p>
          <p className="mt-1">
            Your account is suspended until the issue is resolved. You cannot
            create new auctions or register new products. Existing orders can
            still be fulfilled.
          </p>
        </div>
      )}

      {errorMessage && (
        <div
          className="mt-6 flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"
          role="alert"
        >
          <AlertCircle
            className="mt-0.5 size-4 shrink-0 text-destructive"
            aria-hidden="true"
          />
          <p>{errorMessage}</p>
        </div>
      )}
      {notice && (
        <p
          className="mt-6 rounded-lg border border-primary/30 bg-secondary p-4 text-sm"
          role="status"
        >
          {notice}
        </p>
      )}

      {orders.isPending && (
        <Card className="mt-6 p-6 text-sm text-muted-foreground" role="status">
          Loading orders…
        </Card>
      )}
      {orders.isError && (
        <Card className="mt-6 p-6" role="alert">
          <p className="text-sm text-destructive">
            Could not load orders. Please try again.
          </p>
          <Button
            className="mt-4"
            variant="outline"
            disabled={orders.isFetching}
            onClick={() => void orders.refetch()}
          >
            Retry
          </Button>
        </Card>
      )}
      {orders.isFetching && !orders.isPending && (
        <p className="mt-4 text-sm text-muted-foreground" role="status">
          Refreshing order details…
        </p>
      )}

      {!id && orders.data && isOrderList(orders.data) && (
        <>
          {orders.data.items.length === 0 ? (
            <Card className="mt-8 p-6 md:p-8">
              <h2 className="text-lg font-semibold">No orders yet</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Orders will appear here after checkout.
              </p>
            </Card>
          ) : (
            <div className="mt-6 space-y-4" aria-label="Orders">
              {orders.data.items.map((item) => (
                <OrderCard
                  key={item.id}
                  order={item}
                  audience={audience}
                  page={page}
                />
              ))}
            </div>
          )}
          {orders.data.totalPages > 1 && (
            <nav
              className="mt-6 flex items-center justify-between gap-3"
              aria-label="Order pages"
            >
              <p className="text-sm text-muted-foreground">
                Page {orders.data.page} of {orders.data.totalPages} ·{' '}
                {orders.data.total} orders
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={page <= 1 || orders.isFetching}
                  onClick={() =>
                    void navigate({
                      to: audience === 'buyer' ? '/orders' : '/producer/orders',
                      search: { page: Math.max(1, page - 1) },
                    })
                  }
                >
                  <ChevronLeft aria-hidden="true" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={page >= orders.data.totalPages || orders.isFetching}
                  onClick={() =>
                    void navigate({
                      to: audience === 'buyer' ? '/orders' : '/producer/orders',
                      search: { page: page + 1 },
                    })
                  }
                >
                  Next
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            </nav>
          )}
        </>
      )}

      {id && order && (
        <section className="mt-6 space-y-5" aria-label="Order detail">
          <Card className="p-5 md:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Order reference</p>
                <p className="mt-1 break-all font-mono text-sm">{order.id}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Placed {orderDateLabel(order.createdAt)}
                </p>
              </div>
              <OrderStatusBadge status={order.status} />
            </div>
            <p className="mt-5 text-sm leading-relaxed">
              {statusDescription(order)}
            </p>
            {order.origin === 'auction' && (
              <p className="mt-3 rounded-md bg-secondary p-3 text-sm">
                Auction win · Collection order confirmed automatically.
              </p>
            )}
            {order.status !== 'cancelled' && <OrderTimeline order={order} />}
          </Card>

          <Card className="p-5 md:p-7">
            <h2 className="text-lg font-semibold">Items and totals</h2>
            <ul className="mt-4 divide-y divide-border">
              {order.items.map((line) => (
                <li
                  key={line.productId}
                  className="flex flex-col gap-1 py-3 md:flex-row md:items-center md:justify-between"
                >
                  <span className="font-medium">
                    {line.productName}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {line.quantity} {formatUnit(line.productUnit)} ×{' '}
                      {moneyLabel(line.unitPriceCents)}
                    </span>
                  </span>
                  <span className="tabular-nums">
                    {moneyLabel(line.lineTotalCents)}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="ml-auto mt-4 max-w-sm space-y-2 border-t pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">
                  {moneyLabel(order.subtotalCents)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Delivery fee</dt>
                <dd className="tabular-nums">
                  {moneyLabel(order.deliveryFeeCents)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 text-base font-semibold">
                <dt>Order total</dt>
                <dd className="tabular-nums">{moneyLabel(order.totalCents)}</dd>
              </div>
              {order.payment && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Checkout charge</dt>
                  <dd className="tabular-nums">
                    {moneyLabel(order.payment.amountCents)}
                  </dd>
                </div>
              )}
            </dl>
            {order.fulfilmentMethod === 'delivery' && order.deliveryAddress && (
              <div className="mt-5 border-t pt-4 text-sm">
                <h3 className="font-semibold">Delivery address</h3>
                <p className="mt-2">
                  {order.deliveryAddress.recipientName}
                  <br />
                  {order.deliveryAddress.street}
                  <br />
                  {order.deliveryAddress.postalCode}{' '}
                  {order.deliveryAddress.city}, {order.deliveryAddress.country}
                </p>
                {typeof order.deliveryAddress.notes === 'string' &&
                  order.deliveryAddress.notes && (
                    <p className="mt-2 text-muted-foreground">
                      Note: {order.deliveryAddress.notes}
                    </p>
                  )}
              </div>
            )}
          </Card>

          {order.refundRequest && (
            <RefundSummary
              status={order.refundRequest.status}
              reason={order.refundRequest.reason}
              requestedAt={order.refundRequest.requestedAt}
              decidedAt={order.refundRequest.decidedAt}
              refundedCents={order.refundRequest.refundedCents}
            />
          )}

          {audience === 'buyer' &&
            order.status === 'pending' &&
            order.origin === 'catalogue' &&
            order.refundRequest?.status !== 'open' &&
            order.refundRequest?.status !== 'accepted' && (
              <Card className="p-5 md:p-7">
                <h2 className="text-lg font-semibold">Request a refund</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  The producer will review your request. This order remains
                  pending, and confirmation is paused while the request is open.
                </p>
                <form
                  className="mt-4 space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (reason.trim())
                      act(`orders/${order.id}/refund-requests`, 'POST', {
                        reason: reason.trim(),
                      });
                  }}
                >
                  <label
                    className="block text-sm font-medium"
                    htmlFor="refund-reason"
                  >
                    Reason
                  </label>
                  <Textarea
                    id="refund-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    maxLength={500}
                    required
                    aria-describedby="refund-reason-help"
                  />
                  <p
                    id="refund-reason-help"
                    className="text-xs text-muted-foreground"
                  >
                    Explain why you need the order refunded.
                  </p>
                  <Button
                    disabled={
                      !reason.trim() ||
                      mutation.isPending ||
                      orders.isFetching ||
                      orders.isError
                    }
                    className="min-h-11"
                  >
                    {mutation.isPending ? 'Sending…' : 'Send refund request'}
                  </Button>
                </form>
              </Card>
            )}

          {audience === 'producer' && order.status !== 'cancelled' && (
            <ProducerOrderActions
              order={order}
              next={next}
              pending={
                mutation.isPending || orders.isFetching || orders.isError
              }
              reason={reason}
              setReason={setReason}
              act={act}
            />
          )}
        </section>
      )}
    </main>
  );
}
