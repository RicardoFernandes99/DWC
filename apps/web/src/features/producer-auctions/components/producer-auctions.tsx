import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
} from '@tanstack/react-router';
import { ArrowLeft, CalendarClock, Plus, RefreshCw } from 'lucide-react';
import type { components } from '@/lib/api-schema';
import { formatMoney, formatUnit, PRODUCT_UNITS } from '@/lib/format';
import { ApiError, authenticatedRequest, type User } from '@/lib/session';
import { sessionOptions } from '@/lib/session-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AuctionForm } from './auction-form';
import {
  auctionKey,
  auctionListKey,
  fetchAuction,
  fetchProducerProduct,
  fetchProducerProducts,
  producerProductKey,
  producerProductListKey,
  type Auction,
  type Product,
} from './auction-data';
import { useAuctionBeforeStart } from './use-auction-before-start';
import { EmptyState } from '@/components/shared/empty-state';

type AuctionList = components['schemas']['AuctionListResponseDto'];
type ProducerStatus = User['producerStatus'];
const SUSPENDED_COPY =
  'Your account is suspended until the issue is resolved. You cannot create new auctions or register new products.';

function fetchAuctions(page: number): Promise<AuctionList> {
  return authenticatedRequest<AuctionList>(
    `producer/auctions?page=${page}&limit=50`,
  );
}

function localDateTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function auctionUnit(value: string) {
  const unit = PRODUCT_UNITS.find((candidate) => candidate === value);
  return unit ? formatUnit(unit) : value;
}

function statusLabel(auction: Auction) {
  if (auction.status === 'cancelled') return 'Cancelled';
  if (auction.status === 'finished' || auction.state === 'finished')
    return 'Finished';
  if (auction.status === 'active') return 'Active';
  return 'Scheduled';
}

function statusClass(auction: Auction) {
  if (auction.status === 'cancelled')
    return 'border-destructive/30 bg-destructive/10 text-destructive';
  if (auction.status === 'active')
    return 'border-primary/30 bg-primary/10 text-primary';
  if (auction.status === 'finished' || auction.state === 'finished')
    return 'border-border bg-muted text-muted-foreground';
  return 'border-warning/40 bg-warning/20 text-foreground';
}

function AuctionStatusBanner({
  status,
  rejectionReason,
}: {
  status: ProducerStatus;
  rejectionReason: string | null;
}) {
  if (status === 'suspended')
    return (
      <Card
        role="alert"
        className="border-destructive/40 bg-destructive/10 p-4 md:p-5"
      >
        <h2 className="font-semibold text-destructive">Account suspended</h2>
        <p className="mt-1 max-w-[70ch] text-sm leading-relaxed">
          {SUSPENDED_COPY}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          You can review existing auctions and cancel a scheduled lot before it
          starts. Active auctions continue normally.
        </p>
      </Card>
    );
  if (status === 'pending')
    return (
      <Card
        role="status"
        className="border-warning/40 bg-warning/20 p-4 md:p-5"
      >
        <h2 className="font-semibold">Pending approval</h2>
        <p className="mt-1 text-sm">
          Auction creation and editing are available after an administrator
          approves your producer application.
        </p>
      </Card>
    );
  if (status === 'rejected')
    return (
      <Card
        role="alert"
        className="border-destructive/30 bg-destructive/10 p-4 md:p-5"
      >
        <h2 className="font-semibold text-destructive">
          Producer application rejected
        </h2>
        <p className="mt-1 text-sm">
          Auction creation and editing are unavailable until your application is
          approved.
        </p>
        {rejectionReason && (
          <p className="mt-2 text-sm">Reason: {rejectionReason}</p>
        )}
      </Card>
    );
  return null;
}

function AuctionListView({
  status,
  writable,
}: {
  status: ProducerStatus;
  writable: boolean;
}) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: [...auctionListKey, page],
    queryFn: () => fetchAuctions(page),
    staleTime: 0,
  });
  const canCreate = status === 'approved' && writable;
  const showHeaderCreate = canCreate && query.data?.items.length !== 0;
  return (
    <section className="space-y-5" aria-labelledby="producer-auctions-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="producer-auctions-title" className="text-2xl font-semibold">
            Your auctions
          </h1>
          <p className="mt-1 max-w-[65ch] text-sm text-muted-foreground">
            Review scheduled lots, current auctions and completed sales.
          </p>
        </div>
        {showHeaderCreate && (
          <Button
            onClick={() => void navigate({ to: '/producer/auctions/new' })}
          >
            <Plus aria-hidden="true" /> Create auction
          </Button>
        )}
      </div>
      {query.isPending && (
        <Card className="p-5 text-sm text-muted-foreground" role="status">
          Loading your auctions…
        </Card>
      )}
      {query.isError && (
        <Card className="p-5" role="alert">
          <p className="text-sm text-destructive">
            Could not load your auctions.
          </p>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => void query.refetch()}
          >
            Try again
          </Button>
        </Card>
      )}
      {query.data && query.data.items.length === 0 && (
        <EmptyState
          icon={<CalendarClock />}
          title="No auctions yet"
          description="A fixed lot reserves its quantity from your product stock until the auction is cancelled or settled."
          action={
            canCreate ? (
              <Button
                onClick={() => void navigate({ to: '/producer/auctions/new' })}
              >
                <Plus aria-hidden="true" /> Schedule your first lot
              </Button>
            ) : undefined
          }
        />
      )}
      {query.data && query.data.items.length > 0 && (
        <div className="overflow-hidden rounded-xl border bg-card">
          <ul className="divide-y divide-border" aria-label="Producer auctions">
            {query.data.items.map((auction) => (
              <li key={auction.id}>
                <div className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-5">
                  <Link
                    to="/producer/auctions/$auctionId"
                    params={{ auctionId: auction.id }}
                    className="grid min-w-0 gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate font-semibold">
                          {auction.product.name}
                        </h2>
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${statusClass(auction)}`}
                        >
                          {statusLabel(auction)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {auction.quantity} {auctionUnit(auction.product.unit)} ·
                        Starts {localDateTime(auction.startsAt)}
                      </p>
                    </div>
                    <p className="text-sm font-medium tabular-nums md:text-right">
                      {auction.currentBidCents
                        ? `High bid ${formatMoney(auction.currentBidCents)}`
                        : `Opening at ${formatMoney(auction.startingPriceCents)}`}
                    </p>
                  </Link>
                  <Link
                    to="/auctions/$auctionId"
                    params={{ auctionId: auction.id }}
                    className="inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4 md:justify-self-end"
                    data-auction-card-link
                  >
                    Open public room
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          {query.data.total > query.data.items.length && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
              <p className="text-muted-foreground">
                Page {query.data.page} of{' '}
                {Math.ceil(query.data.total / query.data.limit)}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * query.data.limit >= query.data.total}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function CancelControl({
  auction,
  status,
  writable,
}: {
  auction: Auction;
  status: ProducerStatus;
  writable: boolean;
}) {
  const client = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState('');
  const [reloadMessage, setReloadMessage] = useState('');
  const beforeStart = useAuctionBeforeStart(auction.startsAt);
  const cancellable =
    writable &&
    auction.status === 'scheduled' &&
    beforeStart === true &&
    (status === 'approved' || status === 'suspended');
  const cancel = useMutation({
    mutationFn: () =>
      authenticatedRequest<Auction>(`producer/auctions/${auction.id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ revision: auction.revision }),
      }),
    onSuccess: async (saved) => {
      client.setQueryData(auctionKey(saved.id), saved);
      setMessage(
        'Auction cancelled. Its reserved product quantity has been released.',
      );
      setConfirming(false);
      await Promise.all([
        client.invalidateQueries({ queryKey: auctionListKey }),
        client.invalidateQueries({ queryKey: producerProductListKey }),
        client.invalidateQueries({
          queryKey: producerProductKey(auction.productId),
        }),
      ]);
      try {
        const products = await fetchProducerProducts();
        client.setQueryData(producerProductListKey, products);
      } catch {
        setReloadMessage(
          'Auction cancelled, but current product stock could not be refreshed. Reload the producer products list to confirm available and reserved amounts.',
        );
      }
    },
    onError: (error) => {
      setMessage(
        error instanceof ApiError && error.status === 409
          ? 'This auction started or changed on the server. Nothing was cancelled.'
          : error instanceof Error
            ? error.message
            : 'Could not cancel this auction.',
      );
    },
  });
  const reload = async () => {
    setReloadMessage('');
    try {
      const fresh = await fetchAuction(auction.id);
      client.setQueryData(auctionKey(auction.id), fresh);
      setMessage(
        `Current server state: ${statusLabel(fresh)}. Review it before taking another action.`,
      );
    } catch {
      setReloadMessage('Could not reload the current auction. Try again.');
    }
  };
  if (!cancellable && !message) return null;
  return (
    <div className="space-y-2">
      {cancellable && !confirming && (
        <Button
          variant="destructive"
          onClick={() => {
            setMessage('');
            setConfirming(true);
          }}
        >
          Cancel auction
        </Button>
      )}
      {confirming && (
        <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-medium">
            Cancel this scheduled auction and release {auction.quantity}{' '}
            {auctionUnit(auction.product.unit)} back to available stock?
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate()}
            >
              {cancel.isPaused
                ? 'Waiting for connection…'
                : cancel.isPending
                  ? 'Cancelling…'
                  : 'Confirm cancellation'}
            </Button>
            <Button
              variant="outline"
              disabled={cancel.isPending}
              onClick={() => setConfirming(false)}
            >
              Keep auction
            </Button>
          </div>
          {cancel.isPaused && (
            <p role="status" className="text-sm text-muted-foreground">
              Waiting for a connection. Cancellation will continue automatically
              when you’re back online.
            </p>
          )}
        </div>
      )}
      {message && (
        <div
          role={cancel.isError ? 'alert' : 'status'}
          className={`space-y-2 rounded-lg border p-3 text-sm ${cancel.isError ? 'border-warning/40 bg-warning/20' : 'border-primary/30 bg-primary/5'}`}
        >
          <p>{message}</p>
          {cancel.isError &&
            cancel.error instanceof ApiError &&
            cancel.error.status === 409 && (
              <Button variant="outline" size="sm" onClick={() => void reload()}>
                <RefreshCw aria-hidden="true" /> Reload current auction
              </Button>
            )}
          {reloadMessage && (
            <p role="alert" className="text-destructive">
              {reloadMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function StockSummary({ product }: { product: Product }) {
  return (
    <div className="mt-5 rounded-lg border bg-secondary/40 p-4 text-sm">
      <h2 className="font-medium">Current product stock</h2>
      <p className="mt-1 text-muted-foreground">
        {product.availableStock} {formatUnit(product.unit)} available for normal
        sales · {product.reservedStock} {formatUnit(product.unit)} reserved
        across auctions.
      </p>
    </div>
  );
}

function AuctionDetail({
  auction,
  status,
  rejectionReason,
  writable,
}: {
  auction: Auction;
  status: ProducerStatus;
  rejectionReason: string | null;
  writable: boolean;
}) {
  const navigate = useNavigate();
  const stockQuery = useQuery({
    queryKey: producerProductKey(auction.productId),
    queryFn: () => fetchProducerProduct(auction.productId),
    enabled: status === 'approved',
    staleTime: 0,
  });
  const beforeStart = useAuctionBeforeStart(auction.startsAt);
  const upcoming = auction.status === 'scheduled' && beforeStart === true;
  const editable = upcoming && status === 'approved' && writable;
  return (
    <section className="space-y-5" aria-labelledby="auction-detail-title">
      <div>
        <Button asChild variant="outline" size="sm">
          <Link to="/producer/auctions">
            <ArrowLeft aria-hidden="true" /> All auctions
          </Link>
        </Button>
      </div>
      <AuctionStatusBanner status={status} rejectionReason={rejectionReason} />
      <Card className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 id="auction-detail-title" className="text-2xl font-semibold">
                {auction.product.name}
              </h1>
              <span
                className={`rounded-md border px-2 py-0.5 text-xs font-medium ${statusClass(auction)}`}
              >
                {statusLabel(auction)}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Lot of {auction.quantity} {auctionUnit(auction.product.unit)} ·
              bids are for the whole lot
            </p>
          </div>
          {editable && (
            <Button
              onClick={() =>
                void navigate({
                  to: '/producer/auctions/$auctionId/edit',
                  params: { auctionId: auction.id },
                })
              }
            >
              Edit scheduled auction
            </Button>
          )}
          <Button asChild variant="outline">
            <Link to="/auctions/$auctionId" params={{ auctionId: auction.id }}>
              Open public room
            </Link>
          </Button>
        </div>
        <dl className="mt-6 grid gap-x-6 gap-y-4 border-t pt-5 text-sm sm:grid-cols-2 xl:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Starting price for lot</dt>
            <dd className="mt-1 font-medium tabular-nums">
              {formatMoney(auction.startingPriceCents)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Minimum increment</dt>
            <dd className="mt-1 font-medium tabular-nums">
              {formatMoney(auction.minimumIncrementCents)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Current high bid</dt>
            <dd className="mt-1 font-medium tabular-nums">
              {auction.currentBidCents === null
                ? 'No bids yet'
                : formatMoney(auction.currentBidCents)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Starts in your local time</dt>
            <dd className="mt-1 font-medium">
              <time dateTime={auction.startsAt}>
                {localDateTime(auction.startsAt)}
              </time>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Ends in your local time</dt>
            <dd className="mt-1 font-medium">
              <time dateTime={auction.endsAt}>
                {localDateTime(auction.endsAt)}
              </time>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Auction ID</dt>
            <dd className="mt-1 break-all font-mono text-xs">{auction.id}</dd>
          </div>
        </dl>
        <p className="mt-5 rounded-lg border bg-secondary/40 p-4 text-sm">
          The lot quantity is reserved from normal product sales until the
          auction is cancelled or settled.
        </p>
        {status === 'approved' && stockQuery.data && (
          <StockSummary product={stockQuery.data} />
        )}
        {status === 'approved' && stockQuery.isError && (
          <div
            role="alert"
            className="mt-5 space-y-2 rounded-lg border p-4 text-sm"
          >
            <p className="text-destructive">
              Could not refresh the product’s available and reserved stock.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void stockQuery.refetch()}
            >
              Reload product stock
            </Button>
          </div>
        )}
        {status === 'approved' && stockQuery.isPending && (
          <p role="status" className="mt-5 text-sm text-muted-foreground">
            Loading current product stock…
          </p>
        )}
        <div className="mt-5">
          <CancelControl
            auction={auction}
            status={status}
            writable={writable}
          />
        </div>
      </Card>
      {!upcoming && (
        <p className="text-sm text-muted-foreground">
          Auction terms are locked after the scheduled start.
        </p>
      )}
    </section>
  );
}

function AuctionRouteContent({
  status,
  rejectionReason,
  writable,
}: {
  status: ProducerStatus;
  rejectionReason: string | null;
  writable: boolean;
}) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const params = useParams({ strict: false });
  const isCreate = pathname.endsWith('/new');
  const isEdit = pathname.endsWith('/edit');
  const auctionId =
    typeof params.auctionId === 'string' ? params.auctionId : undefined;
  const auctionQuery = useQuery({
    queryKey: auctionId ? auctionKey(auctionId) : ['producer-auction', 'none'],
    queryFn: () => fetchAuction(auctionId!),
    enabled: Boolean(auctionId),
    staleTime: 0,
  });
  const beforeStart = useAuctionBeforeStart(auctionQuery.data?.startsAt);
  if (isCreate || isEdit) {
    const canCreate = status === 'approved';
    if (!canCreate)
      return (
        <div className="space-y-5">
          <Button asChild size="sm" variant="outline">
            <Link to="/producer/auctions">
              <ArrowLeft aria-hidden="true" /> All auctions
            </Link>
          </Button>
          <AuctionStatusBanner
            status={status}
            rejectionReason={rejectionReason}
          />
          <Card className="p-5">
            <h1 className="text-xl font-semibold">
              Auction changes unavailable
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your current producer status does not allow new auction lots or
              edits. Existing auction details remain available.
            </p>
          </Card>
        </div>
      );
    if (isCreate) return <AuctionForm writable={writable} />;
    if (auctionQuery.isPending && !auctionQuery.data)
      return (
        <Card className="p-5 text-sm text-muted-foreground" role="status">
          Loading current auction…
        </Card>
      );
    if (auctionQuery.isError && !auctionQuery.data)
      return (
        <Card className="p-5" role="alert">
          <p className="text-sm text-destructive">
            Could not load the current auction.
          </p>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => void auctionQuery.refetch()}
          >
            Try again
          </Button>
        </Card>
      );
    if (!auctionQuery.data) return null;
    if (beforeStart === undefined && auctionQuery.data.status === 'scheduled')
      return (
        <Card className="p-5 text-sm text-muted-foreground" role="status">
          Checking whether the auction is still scheduled to start…
        </Card>
      );
    if (auctionQuery.data.status !== 'scheduled' || beforeStart !== true)
      return (
        <div className="space-y-5">
          <AuctionStatusBanner
            status={status}
            rejectionReason={rejectionReason}
          />
          <Card className="space-y-3 p-5" role="status">
            <h1 className="text-xl font-semibold">
              This auction can no longer be edited
            </h1>
            <p className="text-sm text-muted-foreground">
              The server reports that the scheduled start has passed or the
              auction is no longer scheduled. No edit form is available.
            </p>
            <Button asChild variant="outline">
              <Link
                to="/producer/auctions/$auctionId"
                params={{ auctionId: auctionQuery.data.id }}
              >
                View current auction
              </Link>
            </Button>
          </Card>
        </div>
      );
    return (
      <div className="space-y-5">
        <AuctionStatusBanner
          status={status}
          rejectionReason={rejectionReason}
        />
        {auctionQuery.isError && auctionQuery.data && (
          <div
            role="alert"
            className="rounded-lg border border-warning/40 bg-warning/20 p-3 text-sm"
          >
            Could not refresh the current auction. The form shows the last
            loaded values; a save may be rejected if they changed.
          </div>
        )}
        <AuctionForm
          key={auctionQuery.data.id}
          auction={auctionQuery.data}
          writable={writable}
        />
      </div>
    );
  }

  if (auctionId) {
    if (auctionQuery.isPending && !auctionQuery.data)
      return (
        <Card className="p-5 text-sm text-muted-foreground" role="status">
          Loading auction details…
        </Card>
      );
    if (auctionQuery.isError && !auctionQuery.data)
      return (
        <Card className="p-5" role="alert">
          <p className="text-sm text-destructive">
            Could not load this auction.
          </p>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => void auctionQuery.refetch()}
          >
            Try again
          </Button>
        </Card>
      );
    if (auctionQuery.data)
      return (
        <>
          {auctionQuery.isError && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-warning/40 bg-warning/20 p-3 text-sm"
            >
              Could not refresh this auction. The details shown may be out of
              date.
            </div>
          )}
          <AuctionDetail
            auction={auctionQuery.data}
            status={status}
            rejectionReason={rejectionReason}
            writable={writable}
          />
        </>
      );
  }
  return (
    <div className="space-y-5">
      <AuctionStatusBanner status={status} rejectionReason={rejectionReason} />
      <AuctionListView status={status} writable={writable} />
    </div>
  );
}

export function ProducerAuctions({
  status,
  rejectionReason,
}: { status?: ProducerStatus; rejectionReason?: string | null } = {}) {
  const session = useQuery({ ...sessionOptions, staleTime: 0 });
  if (session.isPending)
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6" role="status">
        Restoring your session…
      </main>
    );
  if (!session.data || session.data.role !== 'producer')
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6" role="alert">
        Producer sign-in is required to view these auctions.
      </main>
    );
  const currentStatus = status ?? session.data.producerStatus;
  const currentRejectionReason =
    rejectionReason ?? session.data.producerRejectionReason;
  const writable = !session.isError && !session.isFetching;
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-6 md:py-12 xl:py-14">
      {session.isError && (
        <div
          role="alert"
          className="rounded-lg border border-warning/40 bg-warning/20 p-4 text-sm"
        >
          Your producer status could not be refreshed. Auctions are read-only
          until we can verify your current approval.
        </div>
      )}
      {session.isFetching && !session.isError && (
        <p role="status" className="text-sm text-muted-foreground">
          Checking your current producer approval…
        </p>
      )}
      <AuctionRouteContent
        status={currentStatus}
        rejectionReason={currentRejectionReason}
        writable={writable}
      />
    </main>
  );
}
