import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowRight, MapPin, Navigation, Star, Sprout } from 'lucide-react';
import type { components } from '@/lib/api-schema';
import { publicRequest } from '@/lib/session';
import { producerReviewsOptions } from '@/features/reviews/review-queries';
import {
  auctionListKey,
  fetchPublicAuctions,
} from '@/features/auctions/auction-data';
import type { PublicProducer } from '../use-listing-search';

type ProductList = components['schemas']['CatalogueListDto'];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

function validCoordinates(producer: PublicProducer) {
  const { latitude, longitude } = producer;
  return typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
    ? { latitude, longitude }
    : null;
}

/** Top of the public farm page: photo hero, live auction strip, about and location. */
export function FarmHero({
  producerId,
  producer,
}: {
  producerId: string;
  producer: PublicProducer;
}) {
  const products = useQuery({
    queryKey: ['catalogue', 'farm-hero', producerId],
    queryFn: () =>
      publicRequest<ProductList>(
        `producers/${encodeURIComponent(producerId)}/products?sort=newest&page=1`,
      ),
    retry: false,
  });
  const reviews = useQuery(producerReviewsOptions(producerId, 1));
  const auctions = useQuery({
    queryKey: auctionListKey({ page: 1, producerId }),
    queryFn: () => fetchPublicAuctions({ page: 1, producerId }),
    refetchInterval: 15_000,
    retry: false,
  });

  const photos = (products.data?.items ?? [])
    .map((item) => item.imageUrl)
    .filter((url): url is string => Boolean(url))
    .slice(0, 5);
  const liveAuction = auctions.data?.items.find(
    (auction) => auction.state === 'active',
  );
  const rating = reviews.data?.summary.averageRating ?? null;
  const ratingCount = reviews.data?.summary.ratingCount ?? 0;
  const coordinates = validCoordinates(producer);

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-2xl bg-primary">
        <div className="grid h-72 grid-cols-1 gap-1 md:h-[26rem] md:grid-cols-4 md:grid-rows-2">
          {photos.length === 0 ? (
            <div className="grid place-items-center bg-gradient-to-br from-primary to-primary/70 text-primary-foreground/30 md:col-span-4 md:row-span-2">
              <Sprout aria-hidden="true" className="size-20" />
            </div>
          ) : (
            photos.map((url, index) => (
              <img
                key={url}
                src={url}
                alt=""
                className={
                  index === 0
                    ? `size-full object-cover ${photos.length === 1 ? 'md:col-span-4 md:row-span-2' : 'md:col-span-2 md:row-span-2'}`
                    : 'hidden size-full object-cover md:block'
                }
              />
            ))
          )}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-4 text-white md:gap-5 md:p-8">
          <span
            aria-hidden="true"
            className="grid size-12 shrink-0 place-items-center rounded-full bg-white text-base font-semibold text-primary shadow-lg ring-4 ring-white/30 md:size-20 md:text-2xl self-end mb-1"
          >
            {initials(producer.farmName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium backdrop-blur-sm">
              <MapPin aria-hidden="true" className="size-3.5" />
              {producer.city}
            </p>
            <h1 className="mt-2 text-3xl leading-[1.05] break-words text-white md:text-6xl">
              {producer.farmName}
            </h1>
            {rating !== null && ratingCount > 0 && (
              <a
                href="#reviews"
                className="pointer-events-auto mt-2 inline-flex items-center gap-1.5 text-sm text-white/90 hover:underline"
              >
                <Star aria-hidden="true" className="size-4 fill-current" />
                <strong className="font-semibold tabular-nums">
                  {rating.toFixed(1)}
                </strong>
                <span>
                  · {ratingCount} {ratingCount === 1 ? 'review' : 'reviews'}
                </span>
              </a>
            )}
          </div>
        </div>
      </section>

      {liveAuction && (
        <Link
          to="/auctions/$auctionId"
          params={{ auctionId: liveAuction.id }}
          className="group flex items-center gap-3 rounded-xl bg-primary px-4 py-3 text-primary-foreground shadow-sm transition-opacity hover:opacity-95 md:px-5"
        >
          <span className="relative flex size-2.5 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary-foreground opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2.5 rounded-full bg-primary-foreground" />
          </span>
          <span className="min-w-0 flex-1 text-sm">
            <span className="font-semibold">Live auction</span>
            <span className="opacity-80"> · {liveAuction.product.name}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-semibold">
            Bid now
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
            />
          </span>
        </Link>
      )}

      <section className="grid overflow-hidden rounded-xl border bg-card md:grid-cols-[1fr_2fr]">
        <div className="relative min-h-56 border-b bg-secondary md:border-r md:border-b-0">
          {coordinates ? (
            <iframe
              title={`Map showing ${producer.farmName} in ${producer.city}`}
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
                `${coordinates.longitude - 0.04},${coordinates.latitude - 0.025},${coordinates.longitude + 0.04},${coordinates.latitude + 0.025}`,
              )}&layer=mapnik&marker=${coordinates.latitude}%2C${coordinates.longitude}`}
              loading="lazy"
              className="absolute inset-0 size-full"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
              Map location unavailable
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-4 p-5 md:p-6">
          <div>
            <h2 className="font-sans text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              About the farm
            </h2>
            <p className="mt-2 max-w-[70ch] leading-relaxed break-words whitespace-pre-line">
              {producer.description}
            </p>
          </div>
          <div className="mt-auto flex flex-wrap items-center gap-3 border-t pt-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-primary">
              <MapPin aria-hidden="true" className="size-4" />
            </span>
            <p className="min-w-0 flex-1 text-sm">
              <span className="text-muted-foreground">Collection near </span>
              <span className="font-semibold">{producer.city}</span>
            </p>
            {coordinates && (
              <a
                href={`https://www.openstreetmap.org/?mlat=${coordinates.latitude}&mlon=${coordinates.longitude}#map=14/${coordinates.latitude}/${coordinates.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:border-primary/40 hover:bg-secondary"
              >
                <Navigation aria-hidden="true" className="size-4" />
                Directions
              </a>
            )}
          </div>
          <p className="-mt-2 text-[11px] text-muted-foreground">
            Map data ©{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              OpenStreetMap contributors
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
