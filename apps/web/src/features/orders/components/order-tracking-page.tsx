import { useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  Link,
  useNavigate,
  useParams,
  useSearch,
} from '@tanstack/react-router';
import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import {
  ApiError,
  authenticatedRequest,
  currentUser,
  type User,
} from '@/lib/session';
import { formatMoney } from '@/lib/format';
import type { components } from '@/lib/api-schema';
import { OrderRow } from './order-presentation';
import { orderSteps } from './order-format';
import { OrderDetail } from './order-detail';
import './orders.css';
import { EmptyState } from '@/components/shared/empty-state';
import { ReceiptText } from 'lucide-react';
type Audience = 'buyer' | 'producer';
type Order = components['schemas']['OrderResponseDto'];
type OrderList = components['schemas']['OrderListResponseDto'];
type OrderStatus = Order['status'];

function isOrderList(value: Order | OrderList): value is OrderList {
  return 'totalPages' in value;
}

const pageSize = 10;
const queryRoot = ['orders'] as const;

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
    <main className="orders-screen">
      {id && (
        <Button variant="link" className="order-back" onClick={backToList}>
          <ArrowLeft aria-hidden="true" />
          Back to orders
        </Button>
      )}
      <header className="orders-heading">
        <div>
          <h1>{id ? `Order #${id.slice(-8).toUpperCase()}` : title}</h1>
          <p>
            {id
              ? 'Every detail, from farm to handover.'
              : audience === 'buyer'
                ? 'Good food. All accounted for.'
                : 'From your farm to their table.'}
          </p>
        </div>
        {!id && orders.data && isOrderList(orders.data) && (
          <span className="orders-count">
            <strong>{orders.data.total}</strong>{' '}
            {orders.data.total === 1 ? 'order' : 'orders'}
          </span>
        )}
      </header>
      {audience === 'producer' && user.producerStatus === 'suspended' && (
        <div className="order-account-notice" role="status">
          <AlertCircle size={20} aria-hidden="true" />
          <p>
            <strong>Your producer account is suspended</strong>
            <span>
              You can still fulfil existing orders. New products and auctions
              are unavailable until the suspension is resolved.
            </span>
          </p>
        </div>
      )}
      {errorMessage && (
        <div className="order-feedback" data-error="true" role="alert">
          <AlertCircle size={17} aria-hidden="true" />
          <p>{errorMessage}</p>
        </div>
      )}
      {notice && (
        <p className="order-feedback" role="status">
          {notice}
        </p>
      )}
      {orders.isPending && (
        <div
          className="order-loading"
          role="status"
          aria-label="Loading orders"
        >
          <span>Loading orders…</span>
          <div />
          <div />
          <div />
        </div>
      )}
      {orders.isError && (
        <Card className="mt-6 p-6 shadow-none" role="alert">
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
        <p className="order-refreshing" role="status">
          Refreshing order details…
        </p>
      )}
      {!id && orders.data && isOrderList(orders.data) && (
        <section className="orders-ledger" aria-label="Order history">
          <div className="orders-list-heading">
            <h2>Order history</h2>
            <span>Most recent first</span>
          </div>
          {orders.data.items.length === 0 ? (
            <EmptyState
              icon={<ReceiptText />}
              title="No orders yet"
              description={
                audience === 'buyer'
                  ? 'Orders from local producers will appear here after checkout.'
                  : 'Your customer orders will appear here, ready to prepare and fulfil.'
              }
              action={
                audience === 'buyer' ? (
                  <Button asChild variant="outline">
                    <Link to="/">Explore the market</Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="orders-column-labels" aria-hidden="true">
                <span>
                  {audience === 'buyer'
                    ? 'Order / producer'
                    : 'Order / customer'}
                </span>
                <span>Placed / fulfilment</span>
                <span>Status</span>
                <span>Total</span>
                <span />
              </div>
              <ul className="orders-list" aria-label="Orders">
                {orders.data.items.map((item) => (
                  <OrderRow
                    key={item.id}
                    order={item}
                    audience={audience}
                    page={page}
                  />
                ))}
              </ul>
            </>
          )}
          {orders.data.totalPages > 1 && (
            <nav className="orders-pagination" aria-label="Order pages">
              <p>
                Page <strong>{orders.data.page}</strong> of{' '}
                {orders.data.totalPages}
              </p>
              <div>
                <Button
                  variant="ghost"
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
        </section>
      )}
      {id && order && (
        <OrderDetail
          order={order}
          audience={audience}
          next={next}
          description={statusDescription(order) ?? ''}
          pending={mutation.isPending || orders.isFetching || orders.isError}
          reason={reason}
          setReason={setReason}
          act={act}
        />
      )}
    </main>
  );
}
