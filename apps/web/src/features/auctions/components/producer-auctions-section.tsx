import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Clock, Gavel } from 'lucide-react';
import type { components } from '@/lib/api-schema';
import { publicRequest } from '@/lib/session';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { formatMoney, formatUnit, PRODUCT_UNITS } from '@/lib/format';
import {
  auctionListKey,
  fetchPublicAuctions,
  type AuctionList,
} from '../auction-data';
import { EmptyState } from '@/components/shared/empty-state';

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

type ProductList = components['schemas']['CatalogueListDto'];
type Auction = AuctionList['items'][number];

const STATE_ORDER: Record<Auction['state'], number> = {
  active: 0,
  upcoming: 1,
  finished: 2,
};

function relativeTime(target: string) {
  const minutes = Math.round((Date.parse(target) - Date.now()) / 60_000);
  const abs = Math.abs(minutes);
  const text =
    abs < 60
      ? `${abs} min`
      : abs < 48 * 60
        ? `${Math.round(abs / 60)} h`
        : `${Math.round(abs / 1440)} days`;
  return minutes >= 0 ? `in ${text}` : `${text} ago`;
}

function timeLine(auction: Auction) {
  if (auction.state === 'active')
    return `Closes ${relativeTime(auction.endsAt)}`;
  if (auction.state === 'upcoming')
    return `Starts ${relativeTime(auction.startsAt)}`;
  return `Ended ${localDate(auction.endsAt)}`;
}

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
  // Shares the farm hero's product query for photos.
  const products = useQuery({
    queryKey: ['catalogue', 'farm-hero', producerId],
    queryFn: () =>
      publicRequest<ProductList>(
        `producers/${encodeURIComponent(producerId)}/products?sort=newest&page=1`,
      ),
    retry: false,
  });
  const photoById = new Map(
    (products.data?.items ?? []).map((item) => [item.id, item.imageUrl]),
  );
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
              <AuctionCard
                auction={auction}
                photo={photoById.get(auction.productId)}
              />
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

function AuctionCard({
  auction,
  photo,
}: {
  auction: Auction;
  photo: string | null | undefined;
}) {
  const live = auction.state === 'active';
  const finished = auction.state === 'finished';
  return (
    <Link
      to="/auctions/$auctionId"
      params={{ auctionId: auction.id }}
      data-auction-card-link
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-lg border bg-card shadow-xs transition-[border-color,box-shadow] hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none',
        live && 'border-primary ring-1 ring-primary',
        finished && 'opacity-70 hover:opacity-100',
      )}
    >
      <div className="relative aspect-[4/3] bg-secondary">
        {photo ? (
          <img
            src={photo}
            alt=""
            loading="lazy"
            className={cn('size-full object-cover', finished && 'grayscale')}
          />
        ) : (
          <div className="grid size-full place-items-center text-primary/40">
            <Gavel aria-hidden="true" className="size-10" />
          </div>
        )}
        <span
          className={cn(
            'absolute top-2 left-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
            live
              ? 'bg-destructive text-white'
              : finished
                ? 'bg-foreground/70 text-white'
                : 'bg-white/90 text-foreground',
          )}
        >
          {live && (
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex size-1.5 rounded-full bg-white" />
            </span>
          )}
          {live ? 'Live now' : finished ? 'Ended' : 'Upcoming'}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-3 md:p-4">
        <h3 className="font-serif text-lg leading-snug group-hover:text-primary">
          {auction.product.name}
        </h3>
        <p className="text-sm text-muted-foreground">
          Lot of {auction.quantity} {auctionUnit(auction.product.unit)}
        </p>
        <div className="mt-auto pt-3">
          <p className="text-xs text-muted-foreground">
            {auction.currentBidCents === null
              ? finished
                ? 'No bids'
                : 'Starting at'
              : finished
                ? 'Winning bid'
                : 'Current bid'}
          </p>
          <p className="text-lg font-semibold tabular-nums">
            {formatMoney(auction.currentBidCents ?? auction.startingPriceCents)}
          </p>
          <p
            className={cn(
              'mt-1 inline-flex items-center gap-1 text-xs',
              live ? 'font-medium text-primary' : 'text-muted-foreground',
            )}
          >
            <Clock aria-hidden="true" className="size-3.5" />
            {timeLine(auction)}
          </p>
        </div>
      </div>
    </Link>
  );
}
