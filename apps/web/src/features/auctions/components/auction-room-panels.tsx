import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
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
}: {
  anchor: AnchoredState | null;
  deadline: string;
  label: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(performance.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const elapsed =
    anchor && now !== null ? Math.max(0, now - anchor.receivedAt) : 0;
  const sampleIsFresh = anchor && (now === null || elapsed < 25_000);
  const remaining = sampleIsFresh
    ? Math.max(
        0,
        Math.ceil(
          (Date.parse(deadline) -
            (Date.parse(anchor.state.serverTime) + elapsed)) /
            1000,
        ),
      )
    : null;
  const text =
    remaining === null
      ? 'Syncing with server…'
      : remaining === 0
        ? '00:00'
        : `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  return (
    <div
      className="rounded-lg border bg-secondary/50 p-4"
      data-auction-countdown
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className="mt-1 font-mono text-3xl font-semibold tabular-nums"
        aria-label={
          remaining === null
            ? 'Countdown syncing'
            : `${remaining} seconds remaining`
        }
      >
        {text}
      </p>
    </div>
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
      className={`space-y-4 ${className ?? ''}`}
      aria-labelledby="auction-history-heading"
      data-auction-history
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="auction-history-heading" className="text-xl font-semibold">
            Bid history
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Accepted bids, newest first.
          </p>
        </div>
        {history.data && (
          <p className="text-sm text-muted-foreground">
            {history.data.total} accepted bids
          </p>
        )}
      </div>
      {history.isPending && (
        <Card className="p-4 text-sm text-muted-foreground" role="status">
          Loading bid history…
        </Card>
      )}
      {history.isError && !history.data && (
        <Card className="p-4" role="alert">
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
        </Card>
      )}
      {history.isRefetchError && history.data && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/15 p-3 text-sm"
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
        <Card className="p-4 text-sm text-muted-foreground">
          No accepted bids yet.
        </Card>
      )}
      {history.data && history.data.items.length > 0 && (
        <>
          <ol
            className="divide-y rounded-lg border bg-card"
            aria-label="Accepted bids"
          >
            {history.data.items.map((bid) => (
              <li
                key={bid.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <span className="min-w-0 break-words">{bid.bidderName}</span>
                <span className="font-semibold tabular-nums">
                  {formatMoney(bid.amountCents)}
                </span>
                <time
                  className="basis-full text-xs text-muted-foreground sm:basis-auto"
                  dateTime={bid.acceptedAt}
                >
                  {localDate(bid.acceptedAt)}
                </time>
              </li>
            ))}
          </ol>
          <nav
            className="flex items-center justify-between gap-3"
            aria-label="Bid history pages"
          >
            <p className="text-sm text-muted-foreground">
              Page {history.data.page} of {pages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={page >= pages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          </nav>
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
