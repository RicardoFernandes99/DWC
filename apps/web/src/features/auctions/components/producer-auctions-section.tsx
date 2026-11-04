import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Gavel } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { formatMoney, formatUnit, PRODUCT_UNITS } from '@/lib/format';
import { auctionListKey, fetchPublicAuctions } from '../auction-data';

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

export function ProducerAuctionsSection({
  producerId,
  farmName,
}: {
  producerId: string;
  farmName: string;
}) {
  const query = useQuery({
    queryKey: auctionListKey({ page: 1, producerId }),
    queryFn: () => fetchPublicAuctions({ page: 1, producerId }),
    refetchInterval: 15_000,
    retry: false,
  });
  return (
    <section
      className="mt-10 space-y-4 border-t pt-8"
      aria-labelledby="farm-auctions-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="farm-auctions-heading" className="text-2xl">
            Auctions from this farm
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Scheduled and past lots from {farmName}.
          </p>
        </div>
        <Link
          to="/auctions"
          search={{ page: 1, producerId }}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline underline-offset-4"
        >
          All farm auctions <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
      {query.isPending && (
        <Card className="p-4 text-sm text-muted-foreground" role="status">
          Loading farm auctions…
        </Card>
      )}
      {query.isError && (
        <Card className="p-4 text-sm text-destructive" role="alert">
          Auctions from this farm could not load.
        </Card>
      )}
      {query.data && query.data.items.length === 0 && (
        <Card className="p-4 text-sm text-muted-foreground">
          This farm has no public auctions yet.
        </Card>
      )}
      {query.data && query.data.items.length > 0 && (
        <ul
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
          aria-label="Farm auctions"
        >
          {query.data.items.slice(0, 3).map((auction) => (
            <li key={auction.id}>
              <Card className="h-full p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-md border px-2 py-1 text-xs font-medium">
                    {auction.state === 'upcoming'
                      ? 'Upcoming'
                      : auction.state === 'active'
                        ? 'Live now'
                        : 'Finished'}
                  </span>
                  {auction.state === 'active' && (
                    <span
                      className="size-2 rounded-full bg-primary"
                      aria-label="Live"
                    />
                  )}
                </div>
                <h3 className="mt-3 font-semibold">{auction.product.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Lot of {auction.quantity} {auctionUnit(auction.product.unit)}{' '}
                  ·{' '}
                  {formatMoney(
                    auction.currentBidCents ?? auction.startingPriceCents,
                  )}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {auction.state === 'upcoming' ? 'Starts' : 'Ends'}{' '}
                  {localDate(
                    auction.state === 'upcoming'
                      ? auction.startsAt
                      : auction.endsAt,
                  )}
                </p>
                <Link
                  to="/auctions/$auctionId"
                  params={{ auctionId: auction.id }}
                  className="mt-3 inline-flex min-h-11 items-center gap-2 font-medium text-primary underline underline-offset-4"
                  data-auction-card-link
                >
                  <Gavel aria-hidden="true" className="size-4" /> View auction
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
