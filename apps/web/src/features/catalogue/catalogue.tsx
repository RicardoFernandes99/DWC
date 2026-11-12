import { sessionOptions } from '@/lib/session-query';
import { canPurchase } from '@/route-access';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  CalendarDays,
  Check,
  Leaf,
  MapPin,
  Package,
  ShoppingBasket,
  Sprout,
  Truck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { QuantityStepper } from '@/components/shared/quantity-stepper';
import type { components } from '@/lib/api-schema';
import { ProductGrid } from '@/components/shared/product-card';
import { productGridColumns } from '@/lib/product-grid';
import { Button } from '@/components/ui/button';
import { formatLabel, formatMoney, formatUnit } from '@/lib/format';
import { ApiError, publicRequest } from '@/lib/session';
import { useCart } from '@/features/cart/use-cart';
import { ProducerReviews } from '@/features/reviews/components/producer-reviews';
import { SearchControl } from './components/catalogue-filters';
import { FarmProducts } from './components/farm-products';
import { CatalogueSidebar } from './components/catalogue-sidebar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { activeFilterCount, clearedFilters } from './filters';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FarmHero } from './components/farm-hero';
import { ProducerAuctionsSection } from '@/features/auctions/components/producer-auctions-section';
import {
  producerKey,
  useListingSearch,
  type PublicProducer,
  type SearchState,
} from './use-listing-search';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { Search, SearchX, SlidersHorizontal } from 'lucide-react';

export type { SearchState };

type Product = components['schemas']['CatalogueProductDto'];
type ProductList = components['schemas']['CatalogueListDto'];

const productKey = (id: string) => ['catalogue', 'product', id] as const;
const listingKey = (scope: string, search: SearchState) =>
  ['catalogue', scope, search] as const;

function ListingResults({
  scope,
  columns = 'default',
}: {
  scope: string;
  columns?: keyof typeof productGridColumns;
}) {
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
        className={cn('grid gap-3 md:gap-4', productGridColumns[columns])}
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
      <ErrorState
        title="Products could not load"
        retrying={query.isFetching}
        onRetry={() => void query.refetch()}
      />
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
          <Button variant="outline" onClick={() => update(clearedFilters)}>
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
              <Link to="/products">Browse the market</Link>
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
      <ProductGrid items={query.data.items} columns={columns} />
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

const sortLabels = {
  newest: 'Newest first',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  name_asc: 'Name: A to Z',
} as const;

/** The full market: filter sidebar beside search, sort and results. */
export function ProductsPage() {
  const { search, update } = useListingSearch('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const active = activeFilterCount(search);
  return (
    <main className="mx-auto max-w-[1440px] px-4 pt-6 pb-12 md:px-8 md:pt-8 xl:px-12">
      <h1 className="text-3xl md:text-4xl">All products</h1>
      {/* md+: the filter sidebar spans both rows beside toolbar and results. */}
      <div className="mt-5 grid gap-4 md:grid-cols-[13rem_minmax(0,1fr)] md:grid-rows-[auto_1fr] md:gap-x-8 md:gap-y-5 xl:grid-cols-[16rem_minmax(0,1fr)] xl:gap-x-10">
        <div className="flex min-w-0 flex-wrap items-center gap-2 md:col-start-2 md:row-start-1">
          <label className="relative block min-w-0 flex-1 basis-full sm:basis-64">
            <span className="sr-only">Search products</span>
            <Search
              aria-hidden="true"
              className="absolute top-3 left-3.5 size-4 text-muted-foreground"
            />
            <SearchControl
              initialValue={search.q ?? ''}
              from="/products"
              placeholder="Search produce, farmers, or keywords…"
              className="h-10 rounded-lg bg-card pl-9.5 text-sm"
            />
          </label>
          {/* Phones: filters open as a full-screen sheet; changes apply live. */}
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="h-10 md:hidden">
                <SlidersHorizontal aria-hidden="true" />
                Filters
                {active > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular-nums">
                    {active}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent title="Filters" className="md:hidden">
              <CatalogueSidebar onDone={() => setFiltersOpen(false)} />
            </SheetContent>
          </Sheet>
          <Select
            value={search.sort}
            onValueChange={(value) =>
              update({ sort: value as SearchState['sort'] })
            }
          >
            <SelectTrigger
              aria-label="Sort by"
              className="h-10 w-44 rounded-lg bg-card"
            >
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(sortLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <aside className="hidden md:col-start-1 md:row-span-2 md:row-start-1 md:block md:self-start">
          <CatalogueSidebar />
        </aside>
        <section aria-label="Products" className="min-w-0 md:col-start-2">
          <ListingResults scope="all" columns="sidebar" />
        </section>
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
  const lowStock = product.availableStock > 0 && product.availableStock <= 5;
  const seasons = product.seasons.includes('year_round')
    ? 'All year'
    : product.seasons.map((season) => formatLabel(season)).join(', ');
  return (
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 md:px-8 md:py-8">
      {query.isError && (
        <p role="status" className="text-sm text-destructive">
          Could not refresh this product. Showing the last loaded details.
        </p>
      )}
      <Link
        to="/products"
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Back to the market
      </Link>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-5">
        <section className="relative min-w-0 overflow-hidden rounded-2xl bg-secondary">
          <div className="aspect-[4/3] md:aspect-[16/10] lg:aspect-auto lg:h-full lg:min-h-[30rem]">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                width="1000"
                height="750"
                className="size-full object-cover"
              />
            ) : (
              <div className="grid size-full place-items-center text-primary">
                <Sprout aria-hidden="true" className="size-16 stroke-[1.2]" />
              </div>
            )}
          </div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-black/15" />
          <div className="absolute inset-x-0 top-0 flex flex-wrap gap-2 p-3 md:p-4">
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-foreground">
              {formatLabel(product.productionMethod)}
            </span>
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-foreground">
              {formatLabel(product.category)}
            </span>
            {product.availableStock <= 0 ? (
              <span className="rounded-full bg-foreground/80 px-2.5 py-1 text-xs font-semibold text-white">
                Out of stock
              </span>
            ) : (
              lowStock && (
                <span className="rounded-full bg-warning px-2.5 py-1 text-xs font-semibold text-foreground">
                  Only {product.availableStock} left
                </span>
              )
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0 p-4 text-white md:p-6">
            <Link
              to="/farm/$producerId"
              params={{ producerId: product.producerId }}
              className="text-xs font-medium tracking-wide text-white/85 uppercase hover:underline"
            >
              {product.producerFarmName} · {product.producerCity}
            </Link>
            <h1 className="mt-1 text-3xl leading-tight break-words text-white md:text-5xl">
              {product.name}
            </h1>
          </div>
        </section>

        <aside className="min-w-0">
          <ProductAddToCart product={product} seasons={seasons} />
        </aside>

        <section className="min-w-0 rounded-xl border bg-card p-5 md:p-6 lg:col-span-2">
          <h2 className="font-sans text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            About this product
          </h2>
          <p className="mt-2 max-w-[70ch] leading-relaxed break-words whitespace-pre-line">
            {product.description}
          </p>
        </section>
      </div>
      <MoreFromFarm product={product} />
    </main>
  );
}

function MoreFromFarm({ product }: { product: Product }) {
  const query = useQuery({
    queryKey: ['catalogue', 'farm-hero', product.producerId],
    queryFn: () =>
      publicRequest<ProductList>(
        `producers/${encodeURIComponent(product.producerId)}/products?sort=newest&page=1`,
      ),
    retry: false,
  });
  const others = (query.data?.items ?? [])
    .filter((item) => item.id !== product.id)
    .slice(0, 4);
  if (others.length === 0) return null;
  return (
    <section className="space-y-4 pt-6" aria-labelledby="more-from-farm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="more-from-farm" className="text-2xl">
          More from {product.producerFarmName}
        </h2>
        <Link
          to="/farm/$producerId"
          params={{ producerId: product.producerId }}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          See all <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
      <ProductGrid items={others} />
    </section>
  );
}

function ProductAddToCart({
  product,
  seasons,
}: {
  product: Product;
  seasons: string;
}) {
  const { items, addItem } = useCart();
  const session = useQuery(sessionOptions);
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState(false);

  const cartItem = items.find((item) => item.productId === product.id);
  const inCartQty = cartItem?.quantity ?? 0;
  const isOutOfStock = product.availableStock <= 0;
  const lowStock = !isOutOfStock && product.availableStock <= 5;
  const purchasable = canPurchase(session.data);

  const handleAdd = () => {
    if (isOutOfStock) return;
    addItem(product, quantity);
    setFeedback(true);
    setTimeout(() => setFeedback(false), 3000);
  };

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-2xl border bg-card">
      <Link
        to="/farm/$producerId"
        params={{ producerId: product.producerId }}
        className="group flex items-center gap-3 border-b px-5 py-4 hover:bg-secondary/40"
      >
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-primary"
        >
          {product.producerFarmName
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0])
            .join('')}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {product.producerFarmName}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin aria-hidden="true" className="size-3" />
            {product.producerCity}
          </span>
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
          Visit farm
          <ArrowRight
            aria-hidden="true"
            className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
          />
        </span>
      </Link>

      <div className="px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-4xl font-semibold tracking-tight tabular-nums">
            {formatMoney(product.priceCents)}
            <span className="ml-1 text-base font-normal text-muted-foreground">
              / {formatUnit(product.unit)}
            </span>
          </p>
          <span
            className={cn(
              'mt-1.5 inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
              isOutOfStock
                ? 'bg-destructive/10 text-destructive'
                : lowStock
                  ? 'bg-warning/30 text-foreground'
                  : 'bg-secondary text-primary',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'size-1.5 rounded-full',
                isOutOfStock
                  ? 'bg-destructive'
                  : lowStock
                    ? 'bg-warning'
                    : 'bg-primary',
              )}
            />
            {isOutOfStock
              ? 'Out of stock'
              : lowStock
                ? `Only ${product.availableStock} left`
                : 'In stock'}
          </span>
        </div>

        <dl className="mt-4 divide-y border-y text-sm">
          {[
            {
              icon: <Leaf aria-hidden="true" />,
              label: 'Method',
              value: formatLabel(product.productionMethod),
            },
            {
              icon: <CalendarDays aria-hidden="true" />,
              label: 'Season',
              value: seasons,
            },
            {
              icon: <Package aria-hidden="true" />,
              label: 'Sold by',
              value: formatUnit(product.unit),
            },
            {
              icon: <Boxes aria-hidden="true" />,
              label: 'Available',
              value: isOutOfStock
                ? 'None'
                : `${product.availableStock} ${formatUnit(product.unit)}`,
            },
          ].map((fact) => (
            <div
              key={fact.label}
              className="flex items-center justify-between gap-3 py-2.5"
            >
              <dt className="flex items-center gap-2 text-muted-foreground [&_svg]:size-4 [&_svg]:text-primary">
                {fact.icon}
                {fact.label}
              </dt>
              <dd className="truncate font-medium">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-auto space-y-3 px-5 pt-5 pb-3">
        {!purchasable ? (
          <p className="rounded-lg bg-secondary/50 p-3 text-center text-sm text-muted-foreground">
            To buy, use your personal buyer account.
          </p>
        ) : (
          <>
            <div className="flex items-stretch gap-2">
              <QuantityStepper
                value={quantity}
                max={product.availableStock}
                disabled={isOutOfStock}
                onChange={setQuantity}
              />
              <Button
                type="button"
                size="lg"
                onClick={handleAdd}
                disabled={isOutOfStock}
                className="h-12 flex-1 text-base"
              >
                {isOutOfStock ? (
                  'Out of stock'
                ) : (
                  <>
                    <ShoppingBasket aria-hidden="true" />
                    Add · {formatMoney(product.priceCents * quantity)}
                  </>
                )}
              </Button>
            </div>
            {feedback ? (
              <div
                role="status"
                className="flex items-center justify-between rounded-md bg-secondary px-3 py-2 text-sm font-medium"
              >
                <span className="flex items-center gap-1.5">
                  <Check aria-hidden="true" className="size-4 text-primary" />
                  Added {quantity} to cart
                </span>
                <Link
                  to="/cart"
                  className="font-semibold text-primary underline"
                >
                  View cart
                </Link>
              </div>
            ) : (
              inCartQty > 0 && (
                <p className="text-center text-xs text-muted-foreground">
                  {inCartQty} already in your{' '}
                  <Link to="/cart" className="text-primary underline">
                    cart
                  </Link>
                </p>
              )
            )}
          </>
        )}
      </div>

      <p className="flex items-center justify-center gap-1.5 px-5 pb-5 text-xs text-muted-foreground">
        <Truck aria-hidden="true" className="size-3.5 text-primary" />
        Delivery or farm collection, straight from the producer
      </p>
    </section>
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
        to="/products"
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Back to the market
      </Link>
      <div className="mt-4">
        <FarmHero producerId={producerId} producer={producer} />
      </div>
      <div className="mt-12">
        <FarmProducts producerId={producerId} />
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
        <Link to="/products">Return to the market</Link>
      </Button>
    </main>
  );
}
