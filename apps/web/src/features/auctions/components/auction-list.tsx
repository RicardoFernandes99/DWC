import { ErrorState } from '@/components/shared/error-state';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AuctionCard } from './auction-card';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/session';
import {
  auctionListKey,
  fetchPublicAuctions,
  type AuctionState,
} from '../auction-data';
import { EmptyState } from '@/components/shared/empty-state';

const stateOptions: { value: AuctionState | undefined; label: string }[] = [
  { value: undefined, label: 'All auctions' },
  { value: 'active', label: 'Live now' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'finished', label: 'Finished' },
];

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

  const total = query.data?.total ?? 0;
  const first = (page - 1) * 12 + 1;
  const last = first + (query.data?.items.length ?? 0) - 1;

  return (
    <section className="space-y-5" aria-label="Auction listings">
      <div
        role="tablist"
        aria-label="Auction status"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0"
      >
        {stateOptions.map((option) => {
          const selected = state === option.value;
          return (
            <button
              key={option.label}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => updateSearch({ page: 1, state: option.value })}
              className={cn(
                'inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                selected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-card hover:border-primary/40 hover:bg-secondary',
              )}
            >
              {option.value === 'active' && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-2 rounded-full',
                    selected ? 'bg-primary-foreground' : 'bg-destructive',
                  )}
                />
              )}
              {option.label}
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          query.data?.items.length === 0
            ? ''
            : 'rounded-xl border bg-card/60 p-3 md:p-5',
        )}
      >
        {query.isPending && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
              <div
                key={index}
                className="aspect-[4/5] animate-pulse rounded-lg bg-secondary motion-reduce:animate-none"
              />
            ))}
          </div>
        )}
        {query.isError && !query.data && (
          <ErrorState
            title={
              query.error instanceof ApiError && query.error.status === 400
                ? 'This auction filter is invalid'
                : 'Auctions could not load'
            }
            description={
              query.error instanceof ApiError && query.error.status === 400
                ? 'Clear the filter and try again.'
                : undefined
            }
            retrying={query.isFetching}
            onRetry={() => void query.refetch()}
          />
        )}
        {query.isError && query.data && (
          <p role="status" className="mb-3 text-sm text-destructive">
            Could not refresh auction listings. Showing the last results.
          </p>
        )}
        {query.data && query.data.items.length === 0 && (
          <EmptyState
            icon={<CalendarClock />}
            title={
              state === 'active'
                ? 'No live auctions right now'
                : state === 'upcoming'
                  ? 'No upcoming auctions'
                  : state === 'finished'
                    ? 'No finished auctions yet'
                    : 'No auctions yet'
            }
            description="Check back when local producers schedule a lot."
          />
        )}
        {query.data && query.data.items.length > 0 && (
          <>
            <ul
              className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4"
              aria-label="Auctions"
            >
              {query.data.items.map((auction) => (
                <li key={auction.id}>
                  <AuctionCard auction={auction} />
                </li>
              ))}
            </ul>
            <nav
              aria-label="Auction pages"
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <p className="mr-auto text-sm text-muted-foreground tabular-nums">
                Showing {first}–{last} of {total}{' '}
                {total === 1 ? 'auction' : 'auctions'}
              </p>
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => updateSearch({ page: page - 1, state })}
              >
                <ArrowLeft aria-hidden="true" /> Previous
              </Button>
              <span className="text-sm tabular-nums">
                {page} / {pages}
              </span>
              <Button
                variant="outline"
                disabled={page >= pages}
                onClick={() => updateSearch({ page: page + 1, state })}
              >
                Next <ArrowRight aria-hidden="true" />
              </Button>
            </nav>
          </>
        )}
      </div>
    </section>
  );
}

export function AuctionsPage() {
  const search = useSearch({ from: '/auctions' });
  return (
    <main className="mx-auto max-w-[1440px] space-y-6 px-4 py-8 md:px-8 md:py-10 xl:px-12">
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
