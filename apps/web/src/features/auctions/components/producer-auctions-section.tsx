import { useState } from 'react';
import { AuctionCard, type Auction } from './auction-card';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Clock, Gavel } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { auctionListKey, fetchPublicAuctions } from '../auction-data';
import { EmptyState } from '@/components/shared/empty-state';

const STATE_ORDER: Record<Auction['state'], number> = {
  active: 0,
  upcoming: 1,
  finished: 2,
};

export function ProducerAuctionsSection({
  producerId,
}: {
  producerId: string;
  farmName: string;
}) {
  const [showPast, setShowPast] = useState(false);
  const query = useQuery({
    queryKey: auctionListKey({ page: 1, producerId }),
    queryFn: () => fetchPublicAuctions({ page: 1, producerId }),
    refetchInterval: 15_000,
    retry: false,
  });
  const sorted = [...(query.data?.items ?? [])].sort((left, right) => {
    const byState = STATE_ORDER[left.state] - STATE_ORDER[right.state];
    if (byState) return byState;
    return left.state === 'finished'
      ? Date.parse(right.endsAt) - Date.parse(left.endsAt)
      : Date.parse(left.startsAt) - Date.parse(right.startsAt);
  });
  const current = sorted.filter((auction) => auction.state !== 'finished');
  const past = sorted.filter((auction) => auction.state === 'finished');
  const visible = showPast ? sorted : current;

  return (
    <section
      className="mt-12 space-y-5"
      aria-labelledby="farm-auctions-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="farm-auctions-heading" className="text-2xl">
          Auctions
          {query.data && (
            <span className="ml-2 font-sans text-base font-normal text-muted-foreground tabular-nums">
              {query.data.items.length}
            </span>
          )}
        </h2>
        {Boolean(query.data?.items.length) && (
          <Link
            to="/auctions"
            search={{ page: 1, producerId }}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline underline-offset-4"
          >
            All farm auctions{' '}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        )}
      </div>
      {query.isPending && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4">
          {[0, 1].map((key) => (
            <div
              key={key}
              className="aspect-[4/5] animate-pulse rounded-lg bg-secondary motion-reduce:animate-none"
            />
          ))}
        </div>
      )}
      {query.isError && (
        <Card className="p-4 text-sm text-destructive" role="alert">
          Auctions from this farm could not load.
        </Card>
      )}
      {query.data && query.data.items.length === 0 && (
        <EmptyState
          icon={<Gavel />}
          title="No auctions yet"
          description="This farm has not scheduled any auction lots. Check back soon."
        />
      )}
      {query.data && visible.length === 0 && past.length > 0 && (
        <EmptyState
          icon={<Clock />}
          title="No live or upcoming auctions"
          description="Past lots are still available below."
        />
      )}
      {visible.length > 0 && (
        <ul
          className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4"
          aria-label="Farm auctions"
        >
          {visible.map((auction) => (
            <li key={auction.id}>
              <AuctionCard auction={auction} />
            </li>
          ))}
        </ul>
      )}
      {past.length > 0 && (
        <button
          type="button"
          onClick={() => setShowPast((value) => !value)}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:underline underline-offset-4"
          aria-expanded={showPast}
        >
          {showPast
            ? 'Hide past auctions'
            : `Show past auctions (${past.length})`}
        </button>
      )}
    </section>
  );
}
