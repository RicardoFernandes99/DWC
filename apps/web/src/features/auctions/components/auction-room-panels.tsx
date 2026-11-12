import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatMoney } from '@/lib/format';
import {
  auctionHistoryKey,
  fetchAuctionHistory,
  type AuctionResult,
} from '../auction-data';
import { localDate, type AnchoredState } from './auction-room-utils';

export function AuctionCountdown({
  anchor,
  deadline,
  label,
  startsAt,
  endsAt,
  viewerCount,
  live,
}: {
  anchor: AnchoredState | null;
  deadline: string;
  label: string;
  startsAt: string;
  endsAt: string;
  viewerCount: number | null;
  live: boolean;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(performance.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const elapsed =
    anchor && now !== null ? Math.max(0, now - anchor.receivedAt) : 0;
  const sampleIsFresh = anchor && (now === null || elapsed < 25_000);
  const serverNow = sampleIsFresh
    ? Date.parse(anchor.state.serverTime) + elapsed
    : null;
  const remaining =
    serverNow === null
      ? null
      : Math.max(0, Math.ceil((Date.parse(deadline) - serverNow) / 1000));
  const hours = remaining === null ? 0 : Math.floor(remaining / 3600);
  const minutes = remaining === null ? 0 : Math.floor((remaining % 3600) / 60);
  const seconds = remaining === null ? 0 : remaining % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  const text =
    remaining === null
      ? '--:--'
      : hours > 0
        ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
        : `${pad(minutes)}:${pad(seconds)}`;
  const span = Date.parse(endsAt) - Date.parse(startsAt);
  const progress =
    live && serverNow !== null && span > 0
      ? Math.min(1, Math.max(0, (serverNow - Date.parse(startsAt)) / span))
      : null;
  const finalPhase = live && remaining !== null && remaining <= 300;
  return (
    <section
      className="overflow-hidden rounded-xl bg-primary p-5 text-primary-foreground shadow-sm"
      data-auction-countdown
      aria-label="Auction timer"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider uppercase opacity-90">
          {live && (
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary-foreground opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-primary-foreground" />
            </span>
          )}
          {finalPhase ? 'Final minutes' : label}
        </p>
        <p
          className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-2.5 py-1 text-xs font-medium tabular-nums"
          data-auction-viewers
        >
          <Eye aria-hidden="true" className="size-3.5" />
          {viewerCount === null ? (
            <span aria-label="Viewer count unavailable while offline">—</span>
          ) : (
            `${viewerCount} watching`
          )}
        </p>
      </div>
      <p
        className="mt-2 font-mono text-5xl font-semibold tracking-tight tabular-nums"
        aria-label={
          remaining === null
            ? 'Countdown syncing'
            : `${remaining} seconds remaining`
        }
      >
        {text}
      </p>
      {remaining === null && (
        <p className="mt-1 text-xs opacity-75">
          Syncing with the server clock…
        </p>
      )}
      {progress !== null && (
        <div
          className="mt-4 h-1.5 overflow-hidden rounded-full bg-primary-foreground/20"
          role="progressbar"
          aria-label="Auction progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div
            className="h-full rounded-full bg-primary-foreground transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}
    </section>
  );
}

export function BuyerResult({ result }: { result: AuctionResult }) {
  if (result.state === 'pending')
    return (
      <Card className="border-warning/40 bg-warning/10 p-4" role="status">
        <h2 className="font-semibold">Settlement is still processing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The auction has ended. The server will confirm the saved result here.
        </p>
      </Card>
    );
  if (result.state === 'not_winner')
    return (
      <Card className="p-4" role="status">
        <h2 className="font-semibold">No winning order was recorded for you</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This auction is closed. Check the public bid history for its final
          bids.
        </p>
      </Card>
    );
  return (
    <Card
      className="border-primary/30 bg-primary/5 p-4"
      role="status"
      data-auction-result
    >
      <h2 className="font-semibold text-primary">You won this auction</h2>
      <p className="mt-1 text-sm">
        {result.paymentStatus === 'succeeded'
          ? 'Payment succeeded and your collection order is confirmed.'
          : 'Your collection order is recorded. Payment status is not available yet.'}
      </p>
      {result.orderId && (
        <Link
          to="/orders/$orderId"
          params={{ orderId: result.orderId }}
          search={{ page: 1 }}
          className="mt-3 inline-flex min-h-11 items-center underline underline-offset-4"
        >
          View collection order
        </Link>
      )}
    </Card>
  );
}

function bidderInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join('') || '?'
  );
}

function timeAgo(value: string) {
  const seconds = Math.max(
    0,
    Math.round((Date.now() - Date.parse(value)) / 1000),
  );
  if (Number.isNaN(seconds)) return '';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return localDate(value);
}

export function AuctionHistory({
  auctionId,
  className,
}: {
  auctionId: string;
  className?: string;
}) {
  const [page, setPage] = useState(1);
  const history = useQuery({
    queryKey: auctionHistoryKey(auctionId, page),
    queryFn: () => fetchAuctionHistory(auctionId, page),
    refetchInterval: 10_000,
    retry: false,
  });
  const pages = Math.max(1, Math.ceil((history.data?.total ?? 0) / 10));
  return (
    <section
      className={`rounded-xl border bg-card p-4 md:p-5 ${className ?? ''}`}
      aria-labelledby="auction-history-heading"
      data-auction-history
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="auction-history-heading"
          className="inline-flex items-center gap-2 font-sans text-base font-semibold"
        >
          <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
          Bid activity
        </h2>
        {history.data && (
          <p className="text-xs text-muted-foreground">
            {history.data.total} {history.data.total === 1 ? 'bid' : 'bids'}
          </p>
        )}
      </div>
      {history.isPending && (
        <p className="mt-4 text-sm text-muted-foreground" role="status">
          Loading bid history…
        </p>
      )}
      {history.isError && !history.data && (
        <div className="mt-4" role="alert">
          <p className="text-sm text-destructive">
            Bid history could not load.
          </p>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => void history.refetch()}
          >
            Try again
          </Button>
        </div>
      )}
      {history.isRefetchError && history.data && (
        <div
          className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/15 p-3 text-sm"
          role="status"
        >
          <span>Bid history may be out of date. Retrying…</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void history.refetch()}
          >
            Retry now
          </Button>
        </div>
      )}
      {history.data && history.data.items.length === 0 && (
        <p className="mt-4 rounded-lg bg-secondary/50 p-4 text-center text-sm text-muted-foreground">
          No bids yet. Be the first to bid.
        </p>
      )}
      {history.data && history.data.items.length > 0 && (
        <>
          <ol
            className="mt-3 max-h-80 space-y-1 overflow-y-auto overscroll-contain pr-1"
            aria-label="Accepted bids"
            tabIndex={0}
          >
            {history.data.items.map((bid, index) => {
              const leading = page === 1 && index === 0;
              return (
                <li
                  key={bid.id}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${leading ? 'bg-secondary' : ''}`}
                >
                  <span
                    aria-hidden="true"
                    className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold ${leading ? 'bg-primary text-primary-foreground' : 'bg-secondary text-primary'}`}
                  >
                    {bidderInitials(bid.bidderName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {bid.bidderName}
                    </p>
                    <time
                      className="text-xs text-muted-foreground"
                      dateTime={bid.acceptedAt}
                      title={localDate(bid.acceptedAt)}
                    >
                      {timeAgo(bid.acceptedAt)}
                    </time>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-semibold tabular-nums ${leading ? 'text-base' : 'text-sm text-muted-foreground'}`}
                    >
                      {formatMoney(bid.amountCents)}
                    </p>
                    <p
                      className={`text-[11px] font-medium ${leading ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                      {leading ? 'Leading' : 'Outbid'}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
          {pages > 1 && (
            <nav
              className="mt-3 flex items-center justify-end gap-2"
              aria-label="Bid history pages"
            >
              <span className="mr-auto text-xs text-muted-foreground tabular-nums">
                Page {history.data.page} of {pages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Newer
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= pages}
                onClick={() => setPage((value) => value + 1)}
              >
                Older
              </Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

export function RoomUnavailable({ title }: { title: string }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 md:px-8" role="alert">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This auction may have been removed or is no longer public.
      </p>
      <Button asChild className="mt-5" variant="outline">
        <Link to="/auctions" search={{ page: 1 }}>
          <ArrowLeft aria-hidden="true" /> All auctions
        </Link>
      </Button>
    </main>
  );
}
