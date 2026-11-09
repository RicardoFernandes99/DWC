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
import { AuctionCard } from '@/features/auctions/components/auction-card';
import {
  auctionKey,
  auctionListKey,
  fetchAuction,
  fetchProducerProduct,
  fetchProducerProducts,
  producerProductKey,
  producerProductListKey,
  type Auction,
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
  const products = useQuery({
    queryKey: producerProductListKey,
    queryFn: fetchProducerProducts,
    staleTime: 60_000,
  });
  const photoById = new Map(
    (products.data?.items ?? []).map((item) => [item.id, item.imageUrl]),
  );
  return (
    <section className="space-y-5" aria-labelledby="producer-auctions-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 id="producer-auctions-title" className="text-3xl md:text-4xl">
          Auctions
        </h1>
        {showHeaderCreate && (
          <Button
            onClick={() => void navigate({ to: '/producer/auctions/new' })}
          >
            <Plus aria-hidden="true" /> New auction
          </Button>
        )}
      </div>
      {query.isPending && (
        <div
          role="status"
          className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4"
        >
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="aspect-[4/5] animate-pulse rounded-lg bg-secondary motion-reduce:animate-none"
            />
          ))}
        </div>
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
        <>
          <ul
            className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4"
            aria-label="Producer auctions"
          >
            {query.data.items.map((auction) => (
              <li key={auction.id}>
                <AuctionCard
                  auction={auction}
                  scope="producer"
                  photo={
                    products.isPending
                      ? undefined
                      : (photoById.get(auction.productId) ?? null)
                  }
                />
              </li>
            ))}
          </ul>
          {query.data.total > query.data.items.length && (
            <nav
              aria-label="Auction pages"
              className="flex flex-wrap items-center gap-3"
            >
              <p className="mr-auto text-sm text-muted-foreground tabular-nums">
                Page {query.data.page} of{' '}
                {Math.ceil(query.data.total / query.data.limit)}
              </p>
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={page * query.data.limit >= query.data.total}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </nav>
          )}
        </>
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
  const photo = stockQuery.data?.imageUrl ?? undefined;
  const live = auction.status === 'active';
  return (
    <section className="space-y-5" aria-labelledby="auction-detail-title">
      <Link
        to="/producer/auctions"
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Back to auctions
      </Link>
      <AuctionStatusBanner status={status} rejectionReason={rejectionReason} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-5">
        <div className="relative min-w-0 overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/70">
          <div className="aspect-[4/3] md:aspect-[16/10] lg:aspect-auto lg:h-full lg:min-h-[26rem]">
            {photo ? (
              <img src={photo} alt="" className="size-full object-cover" />
            ) : (
              <div className="grid size-full place-items-center text-primary-foreground/30">
                <CalendarClock
                  aria-hidden="true"
                  className="size-16 stroke-[1.2]"
                />
              </div>
            )}
          </div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/25" />
          <div className="absolute inset-x-0 top-0 flex flex-wrap gap-2 p-3 md:p-4">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${live ? 'bg-destructive text-white' : 'bg-white/90 text-foreground'}`}
            >
              {live && (
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-white"
                />
              )}
              {statusLabel(auction)}
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 p-4 text-white md:p-6">
            <h1
              id="auction-detail-title"
              className="min-w-0 text-3xl leading-tight break-words text-white md:text-5xl"
            >
              {auction.product.name}
            </h1>
            <div className="text-right">
              <p className="text-xs font-medium tracking-wide text-white/80 uppercase">
                Lot size
              </p>
              <p className="text-2xl font-semibold tabular-nums">
                {auction.quantity}{' '}
                <span className="text-sm font-normal">
                  {auctionUnit(auction.product.unit)}
                </span>
              </p>
            </div>
          </div>
        </div>

        <aside className="flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card">
          <div className="border-b bg-secondary/40 p-5">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {auction.currentBidCents === null
                ? 'Starting price'
                : 'Current high bid'}
            </p>
            <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">
              {formatMoney(
                auction.currentBidCents ?? auction.startingPriceCents,
              )}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {auction.currentBidCents === null
                ? 'No bids yet. Bids are for the whole lot.'
                : 'Bids are for the whole lot.'}
            </p>
          </div>
          <dl className="divide-y px-5 text-sm">
            <div className="flex justify-between gap-3 py-3">
              <dt className="text-muted-foreground">Minimum increment</dt>
              <dd className="font-medium tabular-nums">
                {formatMoney(auction.minimumIncrementCents)}
              </dd>
            </div>
            <div className="flex justify-between gap-3 py-3">
              <dt className="text-muted-foreground">Starts</dt>
              <dd className="text-right font-medium">
                <time dateTime={auction.startsAt}>
                  {localDateTime(auction.startsAt)}
                </time>
              </dd>
            </div>
            <div className="flex justify-between gap-3 py-3">
              <dt className="text-muted-foreground">Ends</dt>
              <dd className="text-right font-medium">
                <time dateTime={auction.endsAt}>
                  {localDateTime(auction.endsAt)}
                </time>
              </dd>
            </div>
            {status === 'approved' && stockQuery.data && (
              <div className="flex justify-between gap-3 py-3">
                <dt className="text-muted-foreground">Product stock</dt>
                <dd className="text-right font-medium tabular-nums">
                  {stockQuery.data.availableStock}{' '}
                  {formatUnit(stockQuery.data.unit)} available ·{' '}
                  {stockQuery.data.reservedStock} reserved
                </dd>
              </div>
            )}
          </dl>
          {status === 'approved' && stockQuery.isError && (
            <div role="alert" className="space-y-2 px-5 pb-3 text-sm">
              <p className="text-destructive">
                Could not refresh the product stock.
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
          <div className="mt-auto space-y-3 p-5">
            {editable && (
              <Button
                size="lg"
                className="h-12 w-full text-base"
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
            <Button asChild variant="outline" className="w-full">
              <Link
                to="/auctions/$auctionId"
                params={{ auctionId: auction.id }}
              >
                View public room
              </Link>
            </Button>
            <CancelControl
              auction={auction}
              status={status}
              writable={writable}
            />
            {!upcoming && (
              <p className="text-center text-xs text-muted-foreground">
                Terms are locked after the scheduled start.
              </p>
            )}
          </div>
        </aside>
      </div>
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
      <main
        className="mx-auto max-w-[1440px] px-4 py-8 md:px-8 xl:px-12"
        role="status"
      >
        Restoring your session…
      </main>
    );
  if (!session.data || session.data.role !== 'producer')
    return (
      <main
        className="mx-auto max-w-[1440px] px-4 py-8 md:px-8 xl:px-12"
        role="alert"
      >
        Producer sign-in is required to view these auctions.
      </main>
    );
  const currentStatus = status ?? session.data.producerStatus;
  const currentRejectionReason =
    rejectionReason ?? session.data.producerRejectionReason;
  const writable = !session.isError && !session.isFetching;
  return (
    <main className="mx-auto max-w-[1440px] space-y-6 px-4 py-8 md:px-8 md:py-10 xl:px-12">
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
