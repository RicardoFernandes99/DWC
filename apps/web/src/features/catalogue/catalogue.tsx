import { sessionOptions } from '@/lib/session-query';
import { canPurchase } from '@/route-access';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Minus,
  Plus,
  ShoppingBasket,
  Sprout,
} from 'lucide-react';
import type { components } from '@/lib/api-schema';
import { ProductGrid } from '@/components/shared/product-card';
import { Button } from '@/components/ui/button';
import { formatLabel, formatMoney, formatUnit } from '@/lib/format';
import { ApiError, publicRequest } from '@/lib/session';
import { useCart } from '@/features/cart/use-cart';
import { ProducerReviews } from '@/features/reviews/components/producer-reviews';
import { CatalogueFilters } from './components/catalogue-filters';
import { FarmHero } from './components/farm-hero';
import { ProducerAuctionsSection } from '@/features/auctions/components/producer-auctions-section';
import {
  producerKey,
  useListingSearch,
  type PublicProducer,
  type SearchState,
} from './use-listing-search';
import { EmptyState } from '@/components/shared/empty-state';
import { SearchX } from 'lucide-react';

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
  if (!query.data.items.length) {
    const filtered = Boolean(
      search.q ||
      search.category ||
      search.location ||
      search.season ||
      search.productionMethod ||
      search.minPriceCents !== undefined ||
      search.maxPriceCents !== undefined ||
      (scope === 'all' && search.producerId),
    );
    return filtered ? (
      <EmptyState
        icon={<SearchX />}
        title="No products match these filters"
        description="Try a different search or clear the filters to see everything available."
        action={
          <Button
            variant="outline"
            onClick={() =>
              update({
                q: undefined,
                category: undefined,
                producerId: undefined,
                location: undefined,
                season: undefined,
                productionMethod: undefined,
                minPriceCents: undefined,
                maxPriceCents: undefined,
              })
            }
          >
            Clear filters
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={<Sprout />}
        title="No products yet"
        description={
          scope === 'all'
            ? 'Local producers have not listed anything yet. Check back soon.'
            : 'This farm has not listed any products yet. Check back soon.'
        }
        action={
          scope === 'all' ? undefined : (
            <Button asChild variant="outline">
              <Link to="/">Browse the market</Link>
            </Button>
          )
        }
      />
    );
  }
  const pages = Math.max(1, Math.ceil(query.data.total / query.data.limit));
  const first = (query.data.page - 1) * query.data.limit + 1;
  const last = first + query.data.items.length - 1;
  return (
    <>
      {query.isError && (
        <p role="status" className="mb-3 text-sm text-destructive">
          Could not refresh products. Showing the last results.
        </p>
      )}
      <ProductGrid items={query.data.items} />
      <nav
        aria-label="Product pages"
        className="mt-8 flex flex-wrap items-center gap-3"
      >
        <p className="mr-auto text-sm text-muted-foreground tabular-nums">
          Showing {first}–{last} of {query.data.total}{' '}
          {query.data.total === 1 ? 'product' : 'products'}
        </p>
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

/** Filters plus the results panel; shared by the market and farm pages. */
function ProductListing({
  scope,
  title,
  showFilters = true,
}: {
  scope: string;
  title: string;
  showFilters?: boolean;
}) {
  return (
    <section className="space-y-5" aria-label={title}>
      {showFilters && <CatalogueFilters scope={scope} />}
      <div className="rounded-xl border bg-card/60 p-3 md:p-5">
        <h2 className="mb-4 text-xl md:text-2xl">{title}</h2>
        <ListingResults scope={scope} />
      </div>
    </section>
  );
}

export function CataloguePage() {
  return (
    <main className="pb-12">
      <section className="relative isolate overflow-hidden bg-secondary">
        <img
          src="/design/orchard-landscape.png"
          alt=""
          width="1536"
          height="512"
          fetchPriority="high"
          className="absolute inset-0 -z-10 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background/95 via-background/70 to-background/0 md:via-background/50" />
        <div className="mx-auto flex min-h-40 max-w-[1440px] flex-col justify-center px-4 py-8 md:min-h-56 md:px-8 xl:min-h-64 xl:px-12">
          <h1 className="max-w-[14ch] text-3xl leading-tight md:max-w-none md:text-5xl xl:text-6xl">
            Fresh from your region
          </h1>
          <p className="mt-2 max-w-[28ch] text-sm text-foreground/80 md:max-w-none md:text-lg">
            Local farmers. Real food. Stronger communities.
          </p>
        </div>
      </section>
      <div className="mx-auto max-w-[1440px] px-4 pt-5 md:px-8 md:pt-6 xl:px-12">
        <ProductListing scope="all" title="Fresh produce" />
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
              / {formatUnit(product.unit)}
            </span>
          </p>
          <p className="mt-6 break-words whitespace-pre-line leading-relaxed">
            {product.description}
          </p>
          <p className="mt-5 text-sm text-muted-foreground">
            {formatLabel(product.productionMethod)} production ·{' '}
            {product.availableStock} available
          </p>
          <ProductAddToCart product={product} />
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

function ProductAddToCart({ product }: { product: Product }) {
  const { items, addItem } = useCart();
  const session = useQuery(sessionOptions);
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState(false);

  if (!canPurchase(session.data)) return null;

  const cartItem = items.find((item) => item.productId === product.id);
  const inCartQty = cartItem?.quantity ?? 0;
  const isOutOfStock = product.availableStock <= 0;

  const handleAdd = () => {
    if (isOutOfStock) return;
    addItem(product, quantity);
    setFeedback(true);
    setTimeout(() => setFeedback(false), 3000);
  };

  return (
    <div className="mt-6 rounded-lg border bg-card p-4 shadow-2xs">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 rounded-md"
            disabled={quantity <= 1 || isOutOfStock}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            aria-label="Decrease quantity"
          >
            <Minus aria-hidden="true" className="size-4" />
          </Button>
          <span
            className="min-w-10 text-center font-medium tabular-nums"
            aria-label={`Quantity: ${quantity}`}
          >
            {quantity}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 rounded-md"
            disabled={quantity >= product.availableStock || isOutOfStock}
            onClick={() =>
              setQuantity((q) => Math.min(product.availableStock, q + 1))
            }
            aria-label="Increase quantity"
          >
            <Plus aria-hidden="true" className="size-4" />
          </Button>
        </div>

        <Button
          type="button"
          onClick={handleAdd}
          disabled={isOutOfStock}
          className="rounded-md flex-1 min-w-[140px]"
        >
          {isOutOfStock ? (
            'Out of stock'
          ) : (
            <>
              <ShoppingBasket aria-hidden="true" className="size-4" />
              Add to cart
            </>
          )}
        </Button>
      </div>

      {inCartQty > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {inCartQty} currently in your{' '}
          <Link to="/cart" className="text-primary underline">
            cart
          </Link>
        </p>
      )}

      {feedback && (
        <div
          role="status"
          className="mt-3 flex items-center justify-between rounded-md bg-secondary/80 px-3 py-2 text-xs font-medium text-secondary-foreground"
        >
          <span className="flex items-center gap-1.5">
            <Check aria-hidden="true" className="size-3.5 text-primary" />
            Added {quantity} to cart
          </span>
          <Link to="/cart" className="text-primary underline font-semibold">
            View cart
          </Link>
        </div>
      )}
    </div>
  );
}

export function ProducerPage({ producerId }: { producerId: string }) {
  // Same unfiltered query as the farm hero; hides filters for a farm with no products.
  const farmProducts = useQuery({
    queryKey: ['catalogue', 'farm-hero', producerId],
    queryFn: () =>
      publicRequest<ProductList>(
        `producers/${encodeURIComponent(producerId)}/products?sort=newest&page=1`,
      ),
    retry: false,
  });
  const farmIsEmpty = farmProducts.data?.total === 0;
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
      <div className="mt-4">
        <FarmHero producerId={producerId} producer={producer} />
      </div>
      <div className="mt-12">
        <ProductListing
          scope={producerId}
          title="Products"
          showFilters={!farmIsEmpty}
        />
      </div>
      <ProducerAuctionsSection
        producerId={producerId}
        farmName={producer.farmName}
      />
      <ProducerReviews producerId={producerId} />
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
