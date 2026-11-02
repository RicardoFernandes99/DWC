import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, MapPin, Sprout } from 'lucide-react';
import type { components } from '@/lib/api-schema';
import { ProductGrid } from '@/components/shared/product-card';
import { Button } from '@/components/ui/button';
import { formatLabel, formatMoney } from '@/lib/format';
import { ApiError, publicRequest } from '@/lib/session';
import { CatalogueFilters } from './components/catalogue-filters';
import {
  producerKey,
  useListingSearch,
  type PublicProducer,
  type SearchState,
} from './use-listing-search';

export type { SearchState };

type Product = components['schemas']['CatalogueProductDto'];
type ProductList = components['schemas']['CatalogueListDto'];

const productKey = (id: string) => ['catalogue', 'product', id] as const;
const listingKey = (scope: string, search: SearchState) =>
  ['catalogue', scope, search] as const;

function ListingResults({ scope }: { scope: string }) {
  const { search, update } = useListingSearch(scope);
  const invalidRange =
    search.minPriceCents !== undefined &&
    search.maxPriceCents !== undefined &&
    search.minPriceCents > search.maxPriceCents;
  const query = useQuery({
    queryKey: listingKey(scope, search),
    queryFn: () => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries({
        ...search,
        sort: search.sort ?? 'newest',
        page: search.page ?? 1,
      }))
        if (value !== undefined && value !== '') params.set(key, String(value));
      const path = scope === 'all' ? 'products' : `producers/${scope}/products`;
      return publicRequest<ProductList>(`${path}?${params}`);
    },
    enabled: !invalidRange,
    retry: false,
  });
  if (invalidRange)
    return (
      <p className="rounded-md bg-card p-5 text-sm text-muted-foreground">
        Correct the price range to see matching products.
      </p>
    );
  if (query.isPending)
    return (
      <div
        className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4"
        aria-label="Loading products"
        data-catalogue-grid
      >
        {Array.from({ length: 8 }, (_, index) => (
          <div
            key={index}
            className="aspect-[4/5] animate-pulse rounded-lg bg-secondary motion-reduce:animate-none"
          />
        ))}
      </div>
    );
  if (query.isError && !query.data)
    return (
      <section role="alert" className="rounded-lg border bg-card p-6">
        <h2 className="text-xl">Products could not load</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Check your connection and try again.
        </p>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => void query.refetch()}
        >
          Try again
        </Button>
      </section>
    );
  if (!query.data.items.length)
    return (
      <section className="rounded-lg border bg-card p-8 text-center">
        <h2 className="text-xl">No products match these filters</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Clear a filter or try a different search.
        </p>
      </section>
    );
  const pages = Math.max(1, Math.ceil(query.data.total / query.data.limit));
  return (
    <>
      {query.isError && (
        <p role="status" className="mb-3 text-sm text-destructive">
          Could not refresh products. Showing the last results.
        </p>
      )}
      <div className="mb-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>
          {query.data.total} {query.data.total === 1 ? 'product' : 'products'}
        </p>
        <p>
          Page {query.data.page} of {pages}
        </p>
      </div>
      <ProductGrid items={query.data.items} />
      <nav
        aria-label="Product pages"
        className="mt-8 flex items-center justify-between gap-3"
      >
        <Button
          variant="outline"
          disabled={query.data.page <= 1}
          onClick={() => update({ page: query.data.page - 1 })}
        >
          <ArrowLeft aria-hidden="true" /> Previous
        </Button>
        <span className="text-sm tabular-nums">
          {query.data.page} / {pages}
        </span>
        <Button
          variant="outline"
          disabled={query.data.page >= pages}
          onClick={() => update({ page: query.data.page + 1 })}
        >
          Next <ArrowRight aria-hidden="true" />
        </Button>
      </nav>
    </>
  );
}

export function CataloguePage() {
  return (
    <main className="mx-auto max-w-[1440px] px-4 py-8 md:px-8 md:py-10 xl:px-12">
      <section className="mb-8 grid grid-cols-[minmax(0,1.2fr)_minmax(100px,.8fr)] overflow-hidden rounded-xl bg-primary text-primary-foreground md:grid-cols-[1.1fr_.9fr]">
        <div className="flex flex-col justify-center p-4 md:p-10 xl:p-14">
          <p className="text-sm text-primary-foreground/80">
            Local food, from the people who grow it
          </p>
          <h1 className="mt-3 max-w-xl text-2xl leading-tight md:text-5xl">
            Good things grow close to home.
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-primary-foreground/85">
            Browse seasonal produce and meet the farms behind it.
          </p>
        </div>
        <img
          src="/images/countryside.jpg"
          alt="Green fields and rolling countryside"
          width="1400"
          height="933"
          fetchPriority="high"
          className="h-full min-h-60 w-full object-cover md:min-h-64"
        />
      </section>
      <div className="mb-6">
        <h2 className="text-2xl">The market</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Find something fresh from a nearby producer.
        </p>
      </div>
      <div className="space-y-5">
        <CatalogueFilters scope="all" />
        <ListingResults scope="all" />
      </div>
    </main>
  );
}

export function ProductPage({ productId }: { productId: string }) {
  const query = useQuery({
    queryKey: productKey(productId),
    queryFn: () =>
      publicRequest<Product>(`products/${encodeURIComponent(productId)}`),
    retry: false,
  });
  if (query.isPending)
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="h-[60vh] animate-pulse rounded-lg bg-secondary motion-reduce:animate-none" />
      </main>
    );
  if (
    query.isError &&
    (!query.data ||
      (query.error instanceof ApiError && query.error.status === 404))
  )
    return (
      <Unavailable
        title={
          (query.error as Error & { status?: number }).status === 404
            ? 'Product unavailable'
            : 'Product could not load'
        }
      />
    );
  const product = query.data;
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-12">
      {query.isError && (
        <p role="status" className="mb-4 text-sm text-destructive">
          Could not refresh this product. Showing the last loaded details.
        </p>
      )}
      <Link
        to="/"
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Back to the market
      </Link>
      <article className="mt-6 grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-12">
        <div className="aspect-[4/3] min-w-0 overflow-hidden rounded-lg bg-secondary">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              width="1000"
              height="750"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full place-items-center text-primary">
              <Sprout aria-hidden="true" className="size-12 stroke-[1.2]" />
            </div>
          )}
        </div>
        <div className="min-w-0 py-2">
          <p className="text-sm text-muted-foreground">
            {formatLabel(product.category)} ·{' '}
            {formatLabel(product.seasons.join(', '))}
          </p>
          <h1 className="mt-3 break-words text-4xl leading-tight">
            {product.name}
          </h1>
          <p className="mt-4 text-2xl font-semibold tabular-nums">
            {formatMoney(product.priceCents)}{' '}
            <span className="text-base font-normal text-muted-foreground">
              / {formatLabel(product.unit)}
            </span>
          </p>
          <p className="mt-6 break-words whitespace-pre-line leading-relaxed">
            {product.description}
          </p>
          <p className="mt-5 text-sm text-muted-foreground">
            {formatLabel(product.productionMethod)} production ·{' '}
            {product.availableStock} available
          </p>
          <Link
            to="/farm/$producerId"
            params={{ producerId: product.producerId }}
            className="mt-8 inline-flex min-h-11 min-w-0 max-w-full flex-wrap items-center gap-2 border-t pt-5 text-sm font-medium underline underline-offset-4"
          >
            <span className="min-w-0 break-words">
              Meet {product.producerFarmName}
            </span>
            <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
          </Link>
          <p className="mt-3 text-sm text-muted-foreground">
            From {product.producerCity}
          </p>
        </div>
      </article>
    </main>
  );
}

function MapFrame({ producer }: { producer: PublicProducer }) {
  const { latitude, longitude } = producer;
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  )
    return (
      <p className="rounded-md bg-secondary p-5 text-sm">
        Map location is unavailable for this producer.
      </p>
    );
  const pad = 0.025;
  const bbox = `${Math.max(-180, longitude - pad)},${Math.max(-90, latitude - pad)},${Math.min(180, longitude + pad)},${Math.min(90, latitude + pad)}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${latitude}%2C${longitude}`;
  return (
    <div>
      <iframe
        title={`Map showing ${producer.farmName} in ${producer.city}`}
        src={src}
        loading="lazy"
        className="h-64 w-full rounded-md border bg-secondary md:h-80"
      />
      <p className="mt-2 text-xs text-muted-foreground">
        Map data ©{' '}
        <a
          className="underline underline-offset-2"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          OpenStreetMap contributors
        </a>
      </p>
    </div>
  );
}

export function ProducerPage({ producerId }: { producerId: string }) {
  const producerQuery = useQuery({
    queryKey: producerKey(producerId),
    queryFn: () =>
      publicRequest<PublicProducer>(
        `producers/${encodeURIComponent(producerId)}`,
      ),
    retry: false,
  });
  if (producerQuery.isPending)
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="h-52 animate-pulse rounded-lg bg-secondary motion-reduce:animate-none" />
      </main>
    );
  if (
    producerQuery.isError &&
    (!producerQuery.data ||
      (producerQuery.error instanceof ApiError &&
        producerQuery.error.status === 404))
  )
    return (
      <Unavailable
        title={
          (producerQuery.error as Error & { status?: number }).status === 404
            ? 'Producer unavailable'
            : 'Producer page could not load'
        }
      />
    );
  const producer = producerQuery.data;
  return (
    <main className="mx-auto max-w-[1440px] px-4 py-8 md:px-8 md:py-10 xl:px-12">
      {producerQuery.isError && (
        <p role="status" className="mb-4 text-sm text-destructive">
          Could not refresh this producer page. Showing the last loaded details.
        </p>
      )}
      <Link
        to="/"
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Back to the market
      </Link>
      <header className="mt-6 grid gap-7 border-b pb-8 md:grid-cols-[minmax(0,1fr)_minmax(0,.85fr)] md:items-end md:gap-12">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin aria-hidden="true" className="size-4" />
            {producer.city}
          </p>
          <h1 className="mt-3 break-words text-4xl leading-tight md:text-5xl">
            {producer.farmName}
          </h1>
          <p className="mt-4 max-w-2xl break-words whitespace-pre-line leading-relaxed">
            {producer.description}
          </p>
        </div>
        <MapFrame producer={producer} />
      </header>
      <section className="mt-8 space-y-5">
        <div>
          <h2 className="text-2xl">From this farm</h2>
          <p className="mt-1 break-words text-sm text-muted-foreground">
            Available products from {producer.farmName}.
          </p>
        </div>
        <CatalogueFilters scope={producerId} />
        <ListingResults scope={producerId} />
      </section>
    </main>
  );
}

export function ProductDetailRoute() {
  const params = useParams({ from: '/product/$productId' });
  return <ProductPage productId={params.productId} />;
}

export function ProducerDetailRoute() {
  const params = useParams({ from: '/farm/$producerId' });
  return <ProducerPage producerId={params.producerId} />;
}

function Unavailable({ title }: { title: string }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-3xl">{title}</h1>
      <p className="mt-3 text-muted-foreground">
        This page may have been removed or is no longer public.
      </p>
      <Button asChild className="mt-6">
        <Link to="/">Return to the market</Link>
      </Button>
    </main>
  );
}
