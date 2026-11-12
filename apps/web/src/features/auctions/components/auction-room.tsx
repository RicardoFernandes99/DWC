import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import {
  ArrowLeft,
  CalendarClock,
  Clock,
  Gavel,
  RefreshCw,
  Tag,
  TrendingUp,
} from 'lucide-react';
import type { components } from '@/lib/api-schema';
import {
  producerKey,
  type PublicProducer,
} from '@/features/catalogue/use-listing-search';
import { ApiError, publicRequest } from '@/lib/session';
import { sessionOptions } from '@/lib/session-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  formatLabel,
  formatMoney,
  formatUnit,
  PRODUCT_UNITS,
} from '@/lib/format';
import {
  auctionKey,
  auctionLiveKey,
  auctionResultKey,
  fetchAuctionLive,
  fetchAuctionResult,
  fetchPublicAuction,
  validAuctionId,
} from '../auction-data';
import type { AuctionLiveState } from '../auction-data';
import { AuctionBidForm } from './auction-bid-form';
import {
  AuctionCountdown,
  AuctionHistory,
  BuyerResult,
  RoomUnavailable,
} from './auction-room-panels';
import {
  auctionStatusLabel,
  isAuctionLiveStatePayload,
  minimumBid,
} from './auction-room-utils';
import { useAuctionLive } from './use-auction-live';

type CatalogueProduct = components['schemas']['CatalogueProductDto'];

function auctionUnit(value: string) {
  const unit = PRODUCT_UNITS.find((candidate) => candidate === value);
  return unit ? formatUnit(unit) : value;
}

type AuctionLiveSnapshot = {
  state: AuctionLiveState;
  receivedAt: number;
};

function isAuctionLiveSnapshot(value: unknown): value is AuctionLiveSnapshot {
  return (
    typeof value === 'object' &&
    value !== null &&
    'state' in value &&
    isAuctionLiveStatePayload(value.state) &&
    'receivedAt' in value &&
    typeof value.receivedAt === 'number' &&
    Number.isFinite(value.receivedAt)
  );
}

function AuctionRoom({ auctionId }: { auctionId: string }) {
  const session = useQuery(sessionOptions);
  const auctionQuery = useQuery({
    queryKey: auctionKey(auctionId),
    queryFn: () => fetchPublicAuction(auctionId),
    retry: false,
    refetchInterval: 15_000,
  });
  const liveQuery = useQuery<AuctionLiveSnapshot>({
    queryKey: auctionLiveKey(auctionId),
    queryFn: async (): Promise<AuctionLiveSnapshot> => ({
      state: await fetchAuctionLive(auctionId),
      receivedAt: performance.now(),
    }),
    structuralSharing: (previous, next) => {
      if (!isAuctionLiveSnapshot(next)) return previous;
      if (!isAuctionLiveSnapshot(previous)) return next;
      if (next.state.revision < previous.state.revision) return previous;
      if (
        next.state.revision === previous.state.revision &&
        Date.parse(next.state.serverTime) <
          Date.parse(previous.state.serverTime)
      )
        return previous;
      return next;
    },
    retry: false,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });
  const user = session.data;
  const productId = auctionQuery.data?.productId;
  const producerId = auctionQuery.data?.producerId;
  const productQuery = useQuery({
    queryKey: ['catalogue', 'product', productId ?? ''],
    queryFn: () =>
      publicRequest<CatalogueProduct>(
        `products/${encodeURIComponent(productId ?? '')}`,
      ),
    enabled: Boolean(productId),
    retry: false,
  });
  const producerQuery = useQuery({
    queryKey: producerKey(producerId ?? ''),
    queryFn: () =>
      publicRequest<PublicProducer>(
        `producers/${encodeURIComponent(producerId ?? '')}`,
      ),
    enabled: Boolean(producerId),
    retry: false,
  });
  const liveRoom = useAuctionLive(auctionId, user?.id, liveQuery.data);
  const resultQuery = useQuery({
    queryKey: auctionResultKey(auctionId, user?.id ?? ''),
    queryFn: () => fetchAuctionResult(auctionId),
    enabled: user?.role === 'buyer' && auctionQuery.data?.status === 'finished',
    retry: false,
    refetchInterval: 5000,
  });

  if (!validAuctionId(auctionId))
    return <RoomUnavailable title="Auction not found" />;
  if (auctionQuery.isPending)
    return (
      <main className="mx-auto max-w-6xl px-4 py-10" role="status">
        Loading auction…
      </main>
    );
  if (
    auctionQuery.isError &&
    (!auctionQuery.data ||
      (auctionQuery.error instanceof ApiError &&
        auctionQuery.error.status === 404))
  )
    return <RoomUnavailable title="Auction unavailable" />;
  const auction = auctionQuery.data;
  if (!auction) return null;

  const currentState = liveRoom.live?.state;
  const nextMinimum = minimumBid(currentState);
  const currentStatus = currentState?.state ?? auction.state;
  const upcoming = currentStatus === 'upcoming';
  const deadline = upcoming
    ? auction.startsAt
    : (currentState?.endsAt ?? auction.endsAt);
  const result = resultQuery.data;
  const statusLabel =
    currentState?.state === 'finished' && auction.status !== 'finished'
      ? 'Ended · settling'
      : currentStatus === 'active'
        ? 'Live now'
        : auctionStatusLabel(auction);
  const endsAt = currentState?.endsAt ?? auction.endsAt;
  return (
    <main
      className="mx-auto max-w-7xl space-y-5 px-4 py-6 md:px-8 md:py-8"
      data-auction-room
    >
      <Link
        to="/auctions"
        search={{ page: 1 }}
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> All auctions
      </Link>
      {auctionQuery.isError && (
        <p
          role="status"
          className="rounded-lg border border-warning/40 bg-warning/15 p-3 text-sm"
        >
          Could not refresh the auction details. Showing the last server
          response.
        </p>
      )}
      {liveQuery.isError && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
          role="alert"
        >
          <span>
            Could not sync the server clock. The countdown will resume when a
            fresh server snapshot arrives.
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void liveQuery.refetch()}
          >
            <RefreshCw aria-hidden="true" /> Sync now
          </Button>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-[auto_1fr] lg:gap-5">
        <section className="relative min-w-0 overflow-hidden rounded-xl bg-primary lg:col-start-1 lg:row-start-1">
          <div className="aspect-[4/3] md:aspect-[16/9]">
            {productQuery.data?.imageUrl ? (
              <img
                src={productQuery.data.imageUrl}
                alt={auction.product.name}
                className="size-full object-cover"
              />
            ) : (
              <div className="grid size-full place-items-center bg-gradient-to-br from-primary to-primary/70 text-primary-foreground/40">
                <Gavel aria-hidden="true" className="size-16" />
              </div>
            )}
          </div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/20" />
          <div className="absolute inset-x-0 top-0 flex flex-wrap gap-2 p-3 md:p-4">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${currentStatus === 'active' ? 'bg-destructive text-white' : 'bg-white/90 text-foreground'}`}
            >
              {currentStatus === 'active' && (
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-white"
                />
              )}
              {statusLabel}
            </span>
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-foreground">
              {formatLabel(auction.product.productionMethod)}
            </span>
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-foreground">
              {formatLabel(auction.product.category)}
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 p-4 text-white md:p-6">
            <div className="min-w-0">
              {producerQuery.data && (
                <p className="text-xs font-medium tracking-wide text-white/80 uppercase">
                  {producerQuery.data.farmName} · {producerQuery.data.city}
                </p>
              )}
              <h1 className="mt-1 text-3xl leading-tight font-semibold break-words text-white md:text-4xl">
                {auction.product.name}
              </h1>
            </div>
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
        </section>

        <aside className="space-y-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <AuctionCountdown
            anchor={liveRoom.live}
            deadline={deadline}
            label={
              upcoming
                ? 'Starts in'
                : currentStatus === 'active'
                  ? 'Bidding closes in'
                  : 'Auction closed'
            }
            startsAt={auction.startsAt}
            endsAt={endsAt}
            viewerCount={liveRoom.viewerCount}
            live={currentStatus === 'active'}
          />
          <p role="status" className="sr-only" aria-live="polite">
            {liveRoom.connectionMessage}
          </p>
          {session.isPending ? null : (
            <AuctionBidForm
              key={`${auctionId}:${user?.id ?? 'guest'}`}
              auctionId={auctionId}
              user={user}
              live={currentState}
              socket={liveRoom.socket}
              onAcknowledged={(acknowledgedState) => {
                if (acknowledgedState)
                  liveRoom.applyAcknowledgedState(acknowledgedState);
                void liveQuery.refetch();
                void auctionQuery.refetch();
              }}
            />
          )}
          {auction.status === 'finished' &&
            user?.role === 'buyer' &&
            (resultQuery.isPending ? (
              <Card className="p-4 text-sm text-muted-foreground" role="status">
                Checking persisted auction result…
              </Card>
            ) : resultQuery.isError ? (
              <Card className="p-4" role="alert">
                <p className="text-sm text-destructive">
                  Your auction result could not load.
                </p>
                <Button
                  className="mt-3"
                  variant="outline"
                  onClick={() => void resultQuery.refetch()}
                >
                  Try again
                </Button>
              </Card>
            ) : result ? (
              <BuyerResult result={result} />
            ) : null)}
          {auction.status === 'finished' &&
            auction.currentBidCents === null && (
              <Card className="p-4" role="status">
                <h2 className="font-semibold">Closed without bids</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  No accepted bids were placed. The reserved lot has been
                  released by the server.
                </p>
              </Card>
            )}
          {auction.status === 'active' && auction.state === 'finished' && (
            <Card className="border-warning/40 bg-warning/10 p-4" role="status">
              <h2 className="font-semibold">Auction ended</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The server deadline has passed. Settlement is pending, so no
                winner is shown yet.
              </p>
            </Card>
          )}
          <AuctionHistory auctionId={auctionId} />
        </aside>
        <div className="min-w-0 space-y-4 lg:col-start-1 lg:row-start-2">
          <dl className="grid grid-cols-2 divide-x divide-y rounded-xl border bg-card md:grid-cols-4 md:divide-y-0 [&>div:nth-child(2)]:border-r-0 md:[&>div:nth-child(2)]:border-r">
            <StatTile
              icon={<Tag aria-hidden="true" />}
              label="Starting price"
              value={formatMoney(auction.startingPriceCents)}
              hint="Whole lot"
            />
            <StatTile
              icon={<TrendingUp aria-hidden="true" />}
              label="Min increment"
              value={formatMoney(auction.minimumIncrementCents)}
              hint={`Next bid ${formatMoney(nextMinimum || auction.startingPriceCents)}`}
            />
            <StatTile
              icon={<CalendarClock aria-hidden="true" />}
              label="Starts"
              value={shortTime(auction.startsAt)}
              hint={shortDay(auction.startsAt)}
            />
            <StatTile
              icon={<Clock aria-hidden="true" />}
              label="Ends"
              value={shortTime(endsAt)}
              hint={shortDay(endsAt)}
            />
          </dl>

          <section className="rounded-xl border bg-card p-4 md:p-5">
            {producerQuery.data && (
              <div className="mb-4 flex items-center gap-3 border-b pb-4">
                <span
                  aria-hidden="true"
                  className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-primary"
                >
                  {producerQuery.data.farmName
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join('')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{producerQuery.data.farmName}</p>
                  <p className="text-sm text-muted-foreground">
                    {producerQuery.data.city}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link
                    to="/farm/$producerId"
                    params={{ producerId: auction.producerId }}
                  >
                    Visit farm
                  </Link>
                </Button>
              </div>
            )}
            <h2 className="font-sans text-sm font-semibold">About this lot</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Lot of {auction.quantity} {auctionUnit(auction.product.unit)} ·
              bids are for the whole lot
            </p>
            <p className="mt-3 max-w-[70ch] leading-relaxed whitespace-pre-line">
              {auction.product.description}
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

function StatTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="p-3 md:p-4">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground [&_svg]:size-3.5 [&_svg]:text-primary">
        {icon} {label}
      </dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
      <dd className="text-xs text-muted-foreground">{hint}</dd>
    </div>
  );
}

function shortTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function shortDay(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(value));
}

export function AuctionRoomRoute() {
  const { auctionId } = useParams({ from: '/auctions/$auctionId' });
  const normalizedAuctionId = auctionId.toLowerCase();
  return (
    <AuctionRoom key={normalizedAuctionId} auctionId={normalizedAuctionId} />
  );
}
