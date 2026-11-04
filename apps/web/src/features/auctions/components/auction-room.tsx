import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, RefreshCw, Users } from 'lucide-react';
import { ApiError } from '@/lib/session';
import { sessionOptions } from '@/lib/session-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatMoney, formatUnit, PRODUCT_UNITS } from '@/lib/format';
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
  localDate,
  minimumBid,
} from './auction-room-utils';
import { useAuctionLive } from './use-auction-live';

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
  const displayedBid = currentState
    ? currentState.currentBidCents
    : auction.currentBidCents;
  const nextMinimum = minimumBid(currentState);
  const currentStatus = currentState?.state ?? auction.state;
  const upcoming = currentStatus === 'upcoming';
  const deadline = upcoming
    ? auction.startsAt
    : (currentState?.endsAt ?? auction.endsAt);
  const result = resultQuery.data;
  return (
    <main
      className="mx-auto max-w-6xl space-y-6 px-4 py-7 md:px-8 md:py-10"
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
      <header className="grid gap-6 border-b pb-6 md:grid-cols-[minmax(0,1fr)_16rem] md:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border bg-secondary px-2 py-1 text-xs font-medium">
              {currentState?.state === 'finished' &&
              auction.status !== 'finished'
                ? 'Auction ended · settlement pending'
                : currentState?.state === 'active'
                  ? 'Live now'
                  : auctionStatusLabel(auction)}
            </span>
          </div>
          <h1 className="mt-3 break-words text-3xl font-semibold leading-tight md:text-4xl">
            {auction.product.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Lot of {auction.quantity} {auctionUnit(auction.product.unit)} · bids
            are for the whole lot
          </p>
          <p className="mt-4 max-w-[70ch] whitespace-pre-line leading-relaxed">
            {auction.product.description}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
          <AuctionCountdown
            anchor={liveRoom.live}
            deadline={deadline}
            label={upcoming ? 'Starts in' : 'Time remaining'}
          />
          <div className="rounded-lg border bg-card p-4" data-auction-viewers>
            <p className="text-sm text-muted-foreground">Viewers</p>
            <p className="mt-1 inline-flex items-center gap-2 text-2xl font-semibold tabular-nums">
              <Users aria-hidden="true" className="size-5 text-primary" />
              {liveRoom.viewerCount === null ? (
                <span aria-label="Viewer count unavailable while offline">
                  —
                </span>
              ) : (
                liveRoom.viewerCount
              )}
            </p>
            {liveRoom.viewerCount === null && (
              <p className="mt-1 text-xs text-muted-foreground">
                Unavailable while offline
              </p>
            )}
          </div>
        </div>
      </header>
      <p
        role="status"
        className="text-xs text-muted-foreground"
        aria-live="polite"
      >
        {liveRoom.connectionMessage}
      </p>
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
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:grid-rows-[auto_1fr]">
        <aside className="space-y-4 xl:col-start-2 xl:row-span-2 xl:row-start-1">
          {session.isPending ? (
            <Card className="p-4 text-sm text-muted-foreground" role="status">
              Restoring your session…
            </Card>
          ) : (
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
          {liveRoom.connected && currentState && (
            <p className="text-xs text-muted-foreground">
              State revision {currentState.revision} · minimum next bid{' '}
              {formatMoney(nextMinimum)}
            </p>
          )}
        </aside>
        <Card className="min-w-0 p-4 md:p-5 xl:col-start-1 xl:row-start-1">
          <dl className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Starting price</dt>
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
                {displayedBid === null
                  ? 'No bids yet'
                  : formatMoney(displayedBid)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Scheduled start</dt>
              <dd className="mt-1 font-medium">
                <time dateTime={auction.startsAt}>
                  {localDate(auction.startsAt)}
                </time>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Scheduled end</dt>
              <dd className="mt-1 font-medium">
                <time dateTime={currentState?.endsAt ?? auction.endsAt}>
                  {localDate(currentState?.endsAt ?? auction.endsAt)}
                </time>
              </dd>
            </div>
            {currentState?.currentBidderName && (
              <div>
                <dt className="text-muted-foreground">Current leader</dt>
                <dd className="mt-1 font-medium">
                  {currentState.currentBidderName}
                </dd>
              </div>
            )}
          </dl>
        </Card>
        <AuctionHistory
          auctionId={auctionId}
          className="xl:col-start-1 xl:row-start-2"
        />
      </div>
    </main>
  );
}

export function AuctionRoomRoute() {
  const { auctionId } = useParams({ from: '/auctions/$auctionId' });
  const normalizedAuctionId = auctionId.toLowerCase();
  return (
    <AuctionRoom key={normalizedAuctionId} auctionId={normalizedAuctionId} />
  );
}
