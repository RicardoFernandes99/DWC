import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Clock, Gavel } from 'lucide-react';
import type { components } from '@/lib/api-schema';
import { formatMoney, formatUnit, PRODUCT_UNITS } from '@/lib/format';
import { publicRequest } from '@/lib/session';
import { cn } from '@/lib/utils';
import type { AuctionList } from '../auction-data';

type CatalogueProduct = components['schemas']['CatalogueProductDto'];
export type Auction = AuctionList['items'][number];

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

function lotLabel(auction: Auction) {
  const unit = auctionUnit(auction.product.unit);
  // Sized units like "500 g" read better as "5 × 500 g".
  return /^\d/.test(unit)
    ? `${auction.quantity} × ${unit}`
    : `${auction.quantity} ${unit}`;
}

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

/** Auction card with the product photo, status chip, bid and time. */
export function AuctionCard({ auction }: { auction: Auction }) {
  // Shares the product page cache; archived products simply show no photo.
  const product = useQuery({
    queryKey: ['catalogue', 'product', auction.productId],
    queryFn: () =>
      publicRequest<CatalogueProduct>(
        `products/${encodeURIComponent(auction.productId)}`,
      ),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const photo = product.data?.imageUrl;
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
          Lot of {lotLabel(auction)}
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
