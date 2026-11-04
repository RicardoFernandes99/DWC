import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, CalendarClock, Gavel } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatMoney, formatUnit, PRODUCT_UNITS } from '@/lib/format';
import { ApiError } from '@/lib/session';
import {
  auctionListKey,
  fetchPublicAuctions,
  type AuctionState,
} from '../auction-data';

const stateOptions: { value: AuctionState | undefined; label: string }[] = [
  { value: undefined, label: 'All auctions' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'active', label: 'Live now' },
  { value: 'finished', label: 'Finished' },
];

function stateLabel(state: AuctionState) {
  if (state === 'upcoming') return 'Upcoming';
  if (state === 'active') return 'Live now';
  return 'Finished';
}

function localDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function auctionUnit(value: string) {
  const unit = PRODUCT_UNITS.find((candidate) => candidate === value);
  return unit ? formatUnit(unit) : value;
}

export function AuctionList({ producerId }: { producerId?: string }) {
  const navigate = useNavigate();
  const search = useSearch({ from: '/auctions' });
  const state = search.state;
  const page = search.page;
  const query = useQuery({
    queryKey: auctionListKey({ page, state, producerId }),
    queryFn: () => fetchPublicAuctions({ page, state, producerId }),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const pages = Math.max(1, Math.ceil((query.data?.total ?? 0) / 12));
  const updateSearch = (next: { page: number; state?: AuctionState }) =>
    void navigate({
      to: '/auctions',
      search: (current) => ({ ...current, ...next }),
      replace: false,
    });

  return (
    <section className="space-y-5" aria-label="Auction listings">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <label htmlFor="auction-state" className="text-sm font-medium">
            Show auctions
          </label>
          <select
            id="auction-state"
            value={state ?? ''}
            onChange={(event) =>
              updateSearch({
                page: 1,
                state: (event.target.value || undefined) as
                  AuctionState | undefined,
              })
            }
            className="mt-1 block h-10 min-w-44 rounded-lg border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {stateOptions.map((option) => (
              <option key={option.label} value={option.value ?? ''}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {query.data && (
          <p className="text-sm text-muted-foreground">
            {query.data.total} {query.data.total === 1 ? 'auction' : 'auctions'}
          </p>
        )}
      </div>

      {query.isPending && (
        <Card className="p-5 text-sm text-muted-foreground" role="status">
          Loading auctions…
        </Card>
      )}
      {query.isError && !query.data && (
        <Card className="p-5" role="alert">
          <p className="text-destructive">
            {query.error instanceof ApiError && query.error.status === 400
              ? 'The auction filter is invalid.'
              : 'Auctions could not load. Check your connection and try again.'}
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
      {query.isError && query.data && (
        <p role="status" className="text-sm text-destructive">
          Could not refresh auction listings. Showing the last results.
        </p>
      )}
      {query.data && query.data.items.length === 0 && (
        <Card className="p-6 md:p-8">
          <CalendarClock className="size-6 text-primary" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-semibold">No auctions here yet</h2>
          <p className="mt-1 max-w-[55ch] text-sm text-muted-foreground">
            Try another state or check back when local producers schedule a lot.
          </p>
        </Card>
      )}
      {query.data && query.data.items.length > 0 && (
        <>
          <ul
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            aria-label="Auctions"
          >
            {query.data.items.map((auction) => {
              const deadline =
                auction.state === 'upcoming'
                  ? auction.startsAt
                  : auction.endsAt;
              const deadlineLabel =
                auction.state === 'upcoming'
                  ? 'Starts'
                  : auction.state === 'active'
                    ? 'Ends'
                    : 'Ended';
              return (
                <li key={auction.id}>
                  <Card className="h-full p-4 transition-colors hover:border-primary/40 md:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={`rounded-md border px-2 py-1 text-xs font-medium ${
                          auction.state === 'active'
                            ? 'border-primary/30 bg-primary/10 text-primary'
                            : auction.state === 'upcoming'
                              ? 'border-warning/40 bg-warning/20 text-foreground'
                              : 'border-border bg-muted text-muted-foreground'
                        }`}
                      >
                        {stateLabel(auction.state)}
                      </span>
                      {auction.state === 'active' && (
                        <span className="inline-flex items-center gap-1 text-xs text-primary">
                          <span className="size-2 rounded-full bg-primary" />
                          Live
                        </span>
                      )}
                    </div>
                    <h3 className="mt-3 text-lg font-semibold leading-snug">
                      {auction.product.name}
                    </h3>
                    <p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted-foreground">
                      {auction.product.description}
                    </p>
                    <p className="mt-4 text-sm">
                      Lot of {auction.quantity}{' '}
                      {auctionUnit(auction.product.unit)} · bids are for the
                      whole lot
                    </p>
                    <dl className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 text-sm">
                      <div>
                        <dt className="text-muted-foreground">
                          {auction.currentBidCents === null
                            ? 'Starting price'
                            : 'Current high bid'}
                        </dt>
                        <dd className="mt-1 font-semibold tabular-nums">
                          {formatMoney(
                            auction.currentBidCents ??
                              auction.startingPriceCents,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">
                          {deadlineLabel}
                        </dt>
                        <dd className="mt-1 tabular-nums">
                          <time dateTime={deadline}>{localDate(deadline)}</time>
                        </dd>
                      </div>
                    </dl>
                    <Link
                      to="/auctions/$auctionId"
                      params={{ auctionId: auction.id }}
                      className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-4 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      data-auction-card-link
                    >
                      <Gavel aria-hidden="true" className="size-4" />
                      {auction.state === 'active'
                        ? 'Watch and bid'
                        : 'View auction'}
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </Link>
                  </Card>
                </li>
              );
            })}
          </ul>
          <nav
            aria-label="Auction pages"
            className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"
          >
            <p className="text-sm text-muted-foreground tabular-nums">
              Page {page} of {pages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => updateSearch({ page: page - 1, state })}
              >
                <ArrowLeft aria-hidden="true" /> Previous
              </Button>
              <Button
                variant="outline"
                disabled={page >= pages}
                onClick={() => updateSearch({ page: page + 1, state })}
              >
                Next <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </nav>
        </>
      )}
    </section>
  );
}

export function AuctionsPage() {
  const search = useSearch({ from: '/auctions' });
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-8 md:py-12">
      <header className="max-w-3xl">
        <p className="text-sm font-medium text-primary">
          Local lots, live bidding
        </p>
        <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Auctions</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground md:text-base">
          Watch local producers' scheduled lots, follow accepted bids and bid as
          an eligible buyer.
        </p>
      </header>
      <AuctionList producerId={search.producerId} />
    </main>
  );
}
