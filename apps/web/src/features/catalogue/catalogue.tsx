import { useDeferredValue, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Link,
  useNavigate,
  useParams,
  useSearch,
} from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, MapPin, Search, Sprout } from 'lucide-react';
import type { components } from '@/lib/api-schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError, publicRequest } from '@/lib/session';

type Product = components['schemas']['CatalogueProductDto'];
type ProductList = components['schemas']['CatalogueListDto'];
type Producer = Omit<
  components['schemas']['ProducerPublicDto'],
  'latitude' | 'longitude'
> & {
  latitude?: number;
  longitude?: number;
};
type ProducerList = Omit<components['schemas']['ProducerListDto'], 'items'> & {
  items: Producer[];
};
export type SearchState = {
  q?: string;
  category?: Product['category'];
  producerId?: string;
  location?: string;
  season?: Product['seasons'][number];
  productionMethod?: Product['productionMethod'];
  minPriceCents?: number;
  maxPriceCents?: number;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'name_asc';
  page?: number;
};

const categories: Product['category'][] = [
  'vegetables',
  'fruits',
  'dairy',
  'eggs',
  'meat',
  'bakery',
  'pantry',
  'beverages',
  'other',
];
const seasons: Product['seasons'][number][] = [
  'spring',
  'summer',
  'autumn',
  'winter',
  'year_round',
];
const methods: Product['productionMethod'][] = [
  'organic',
  'sustainable',
  'conventional',
  'artisanal',
  'biodynamic',
];
const productKey = (id: string) => ['catalogue', 'product', id] as const;
const producerKey = (id: string) => ['catalogue', 'producer', id] as const;
const producerListKey = ['catalogue', 'producers'] as const;
const listingKey = (scope: string, search: SearchState) =>
  ['catalogue', scope, search] as const;

function pretty(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function money(cents: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

async function getJson<T>(
  path: string,
  validate: (value: unknown) => value is T,
): Promise<T> {
  const value = await publicRequest(path);
  if (!validate(value))
    throw new ApiError(0, 'The server returned an invalid response.');
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function isProduct(value: unknown): value is Product {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.producerId === 'string' &&
    typeof value.producerFarmName === 'string' &&
    typeof value.producerCity === 'string' &&
    typeof value.name === 'string' &&
    typeof value.description === 'string' &&
    categories.includes(value.category as Product['category']) &&
    methods.includes(value.productionMethod as Product['productionMethod']) &&
    Array.isArray(value.seasons) &&
    value.seasons.every((item) =>
      seasons.includes(item as Product['seasons'][number]),
    ) &&
    typeof value.priceCents === 'number' &&
    Number.isInteger(value.priceCents) &&
    typeof value.unit === 'string' &&
    [
      'unit',
      'bunch',
      'box',
      'jar',
      'bottle',
      'bag',
      'kg',
      'g_500',
      'g_250',
      'l',
      'ml_500',
    ].includes(value.unit) &&
    typeof value.availableStock === 'number' &&
    Number.isInteger(value.availableStock) &&
    (value.imageUrl === null || typeof value.imageUrl === 'string')
  );
}
function isProductList(value: unknown): value is ProductList {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isProduct) &&
    typeof value.total === 'number' &&
    typeof value.page === 'number' &&
    typeof value.limit === 'number'
  );
}
function isProducer(value: unknown): value is Producer {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.farmName === 'string' &&
    typeof value.description === 'string' &&
    typeof value.city === 'string' &&
    (value.latitude === undefined ||
      (typeof value.latitude === 'number' &&
        Number.isFinite(value.latitude) &&
        value.latitude >= -90 &&
        value.latitude <= 90)) &&
    (value.longitude === undefined ||
      (typeof value.longitude === 'number' &&
        Number.isFinite(value.longitude) &&
        value.longitude >= -180 &&
        value.longitude <= 180))
  );
}
function isProducerList(value: unknown): value is ProducerList {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isProducer) &&
    typeof value.total === 'number' &&
    typeof value.page === 'number' &&
    typeof value.limit === 'number'
  );
}
function useListingSearch(scope: string) {
  const rawSearch = useSearch({ strict: false }) as SearchState;
  const search = {
    ...rawSearch,
    sort: rawSearch.sort ?? 'newest',
    page: rawSearch.page ?? 1,
  };
  const navigate = useNavigate({
    from: scope === 'all' ? '/' : '/farm/$producerId',
  });
  function update(values: Partial<SearchState>) {
    void navigate({
      search: (previous) => ({
        ...previous,
        ...values,
        page: values.page ?? 1,
      }),
    });
  }
  return { search, update };
}

function ProductCard({ product }: { product: Product }) {
  return (
    <article className="min-w-0 overflow-hidden rounded-lg border bg-card">
      <Link
        to="/product/$productId"
        params={{ productId: product.id }}
        className="group block"
      >
        <div className="aspect-[4/3] overflow-hidden bg-secondary">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              width="800"
              height="600"
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02] motion-reduce:transition-none"
            />
          ) : (
            <div
              className="flex h-full items-center justify-center bg-secondary text-primary"
              role="img"
              aria-label="No product image available"
            >
              <Sprout aria-hidden="true" className="size-9 stroke-[1.25]" />
            </div>
          )}
        </div>
        <div className="space-y-2 p-4">
          <p className="break-words text-xs text-muted-foreground">
            {product.producerFarmName} · {product.producerCity}
          </p>
          <h2 className="line-clamp-2 break-words text-lg leading-snug group-hover:underline group-hover:underline-offset-4">
            {product.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {pretty(product.category)} · {pretty(product.productionMethod)}
          </p>
          <p className="pt-1 font-semibold tabular-nums">
            {money(product.priceCents)}{' '}
            <span className="font-normal text-muted-foreground">
              / {pretty(product.unit)}
            </span>
          </p>
        </div>
      </Link>
    </article>
  );
}

function ProductGrid({ items }: { items: Product[] }) {
  return (
    <div
      className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4"
      data-catalogue-grid
    >
      {items.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

function Filters({ scope }: { scope: string }) {
  const { search, update } = useListingSearch(scope);
  const [producerTerm, setProducerTerm] = useState('');
  const [minPriceDraft, setMinPriceDraft] = useState(() =>
    moneyInputValue(search.minPriceCents),
  );
  const [maxPriceDraft, setMaxPriceDraft] = useState(() =>
    moneyInputValue(search.maxPriceCents),
  );
  const [minPriceInvalid, setMinPriceInvalid] = useState(false);
  const [maxPriceInvalid, setMaxPriceInvalid] = useState(false);
  const [minPriceUrl, setMinPriceUrl] = useState(search.minPriceCents);
  const [maxPriceUrl, setMaxPriceUrl] = useState(search.maxPriceCents);
  if (minPriceUrl !== search.minPriceCents) {
    setMinPriceUrl(search.minPriceCents);
    setMinPriceDraft(moneyInputValue(search.minPriceCents));
    setMinPriceInvalid(false);
  }
  if (maxPriceUrl !== search.maxPriceCents) {
    setMaxPriceUrl(search.maxPriceCents);
    setMaxPriceDraft(moneyInputValue(search.maxPriceCents));
    setMaxPriceInvalid(false);
  }
  const deferredProducerTerm = useDeferredValue(producerTerm);
  const producersQuery = useQuery({
    queryKey: [...producerListKey, deferredProducerTerm],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '50' });
      if (deferredProducerTerm.trim())
        params.set('q', deferredProducerTerm.trim().slice(0, 100));
      return getJson<ProducerList>(`producers?${params}`, isProducerList);
    },
    enabled: scope === 'all',
    retry: false,
  });
  const selectedProducerQuery = useQuery({
    queryKey: producerKey(search.producerId ?? ''),
    queryFn: () =>
      getJson<Producer>(`producers/${search.producerId}`, isProducer),
    enabled:
      scope === 'all' &&
      Boolean(search.producerId) &&
      !(producersQuery.data?.items ?? []).some(
        (producer) => producer.id === search.producerId,
      ),
    retry: false,
  });
  const invalidRange =
    search.minPriceCents !== undefined &&
    search.maxPriceCents !== undefined &&
    search.minPriceCents > search.maxPriceCents;
  const activeFilterCount = [
    search.category,
    search.producerId,
    search.location,
    search.season,
    search.productionMethod,
    search.minPriceCents,
    search.maxPriceCents,
  ].filter((value) => value !== undefined && value !== '').length;
  const labelClass = 'grid gap-1.5 text-xs font-medium text-foreground';
  const selectClass =
    'h-11 min-w-0 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring';
  return (
    <section
      aria-label="Catalogue filters"
      className="rounded-lg border bg-card p-4 md:p-5"
    >
      <label className={labelClass}>
        Search products
        <span className="relative">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-3 size-4 text-muted-foreground"
          />
          <SearchControl
            initialValue={search.q ?? ''}
            from={scope === 'all' ? '/' : '/farm/$producerId'}
          />
        </span>
      </label>
      <details className="mt-3 border-t pt-3">
        <summary className="min-h-11 cursor-pointer rounded-sm text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">
          Filters
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {activeFilterCount
              ? `${activeFilterCount} applied`
              : 'Category, producer, location, season and price'}
          </span>
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {scope === 'all' && (
            <>
              <label className={labelClass}>
                Find a producer
                <Input
                  value={producerTerm}
                  maxLength={100}
                  onChange={(event) => setProducerTerm(event.target.value)}
                  placeholder="Farm or town"
                  className="h-11 text-base"
                />
              </label>
              <label className={labelClass}>
                Producer
                <select
                  className={selectClass}
                  value={search.producerId ?? ''}
                  onChange={(event) =>
                    update({ producerId: event.target.value || undefined })
                  }
                >
                  <option value="">All producers</option>
                  {search.producerId &&
                    selectedProducerQuery.data &&
                    !(producersQuery.data?.items ?? []).some(
                      (producer) => producer.id === search.producerId,
                    ) && (
                      <option
                        value={selectedProducerQuery.data.id}
                        key={selectedProducerQuery.data.id}
                      >
                        {selectedProducerQuery.data.farmName} ·{' '}
                        {selectedProducerQuery.data.city}
                      </option>
                    )}
                  {(producersQuery.data?.items ?? []).map((producer) => (
                    <option key={producer.id} value={producer.id}>
                      {producer.farmName} · {producer.city}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label className={labelClass}>
            Category
            <select
              className={selectClass}
              value={search.category ?? ''}
              onChange={(event) =>
                update({
                  category: (event.target.value ||
                    undefined) as SearchState['category'],
                })
              }
            >
              <option value="">All categories</option>
              {categories.map((value) => (
                <option key={value} value={value}>
                  {pretty(value)}
                </option>
              ))}
            </select>
          </label>
          {scope === 'all' && (
            <label className={labelClass}>
              Location
              <SearchControl
                initialValue={search.location ?? ''}
                from="/"
                field="location"
                placeholder="Town or area"
                className="h-11 text-base"
              />
            </label>
          )}
          <label className={labelClass}>
            Season
            <select
              className={selectClass}
              value={search.season ?? ''}
              onChange={(event) =>
                update({
                  season: (event.target.value ||
                    undefined) as SearchState['season'],
                })
              }
            >
              <option value="">Any season</option>
              {seasons.map((value) => (
                <option key={value} value={value}>
                  {pretty(value)}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Production
            <select
              className={selectClass}
              value={search.productionMethod ?? ''}
              onChange={(event) =>
                update({
                  productionMethod: (event.target.value ||
                    undefined) as SearchState['productionMethod'],
                })
              }
            >
              <option value="">Any method</option>
              {methods.map((value) => (
                <option key={value} value={value}>
                  {pretty(value)}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="col-span-2 grid grid-cols-2 gap-2 md:col-span-2">
            <legend className="mb-1.5 text-xs font-medium">
              Price range (EUR)
            </legend>
            <MoneyInput
              id="price-min"
              label="Minimum price in EUR"
              draft={minPriceDraft}
              invalid={minPriceInvalid}
              onDraftChange={setMinPriceDraft}
              onInvalidChange={setMinPriceInvalid}
              onCommit={(value) => update({ minPriceCents: value })}
            />
            <MoneyInput
              id="price-max"
              label="Maximum price in EUR"
              draft={maxPriceDraft}
              invalid={maxPriceInvalid}
              onDraftChange={setMaxPriceDraft}
              onInvalidChange={setMaxPriceInvalid}
              onCommit={(value) => update({ maxPriceCents: value })}
            />
          </fieldset>
          <label className={labelClass}>
            Sort by
            <select
              className={selectClass}
              value={search.sort}
              onChange={(event) =>
                update({ sort: event.target.value as SearchState['sort'] })
              }
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="name_asc">Name</option>
            </select>
          </label>
        </div>
      </details>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        {invalidRange ? (
          <p role="alert" className="text-sm text-destructive">
            Minimum price must be less than or equal to maximum price.
          </p>
        ) : (
          <span className="text-xs text-muted-foreground">
            Prices are shown in EUR.
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setProducerTerm('');
            setMinPriceDraft('');
            setMaxPriceDraft('');
            setMinPriceInvalid(false);
            setMaxPriceInvalid(false);
            resetSearch(update);
          }}
        >
          Clear filters
        </Button>
      </div>
    </section>
  );
}

function moneyInputValue(value: number | undefined) {
  return value === undefined ? '' : (value / 100).toFixed(2);
}

function MoneyInput({
  id,
  label,
  draft,
  invalid,
  onDraftChange,
  onInvalidChange,
  onCommit,
}: {
  id: string;
  label: string;
  draft: string;
  invalid: boolean;
  onDraftChange: (value: string) => void;
  onInvalidChange: (value: boolean) => void;
  onCommit: (value: number | undefined) => void;
}) {
  function commit() {
    if (!draft.trim()) {
      onInvalidChange(false);
      onCommit(undefined);
      return;
    }
    const match = /^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(draft.trim());
    if (!match) {
      onInvalidChange(true);
      return;
    }
    const cents =
      Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
    if (cents > 10_000_000) {
      onInvalidChange(true);
      return;
    }
    onInvalidChange(false);
    onCommit(cents);
  }
  return (
    <div>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={draft}
        aria-label={label}
        aria-invalid={invalid}
        onChange={(event) => onDraftChange(event.target.value)}
        onBlur={commit}
        placeholder={id === 'price-min' ? 'Minimum' : 'Maximum'}
        className="h-11 text-base"
      />
      {invalid && (
        <p role="alert" className="col-span-2 mt-1 text-xs text-destructive">
          Enter an amount up to €100,000 with no more than two decimal places.
        </p>
      )}
    </div>
  );
}

function SearchControl({
  initialValue,
  from,
  field = 'q',
  placeholder = 'Try tomatoes or honey',
  className = 'h-11 pl-9 text-base',
}: {
  initialValue: string;
  from: '/' | '/farm/$producerId';
  field?: 'q' | 'location';
  placeholder?: string;
  className?: string;
}) {
  const navigate = useNavigate({ from });
  const [urlValue, setUrlValue] = useState(initialValue);
  const [draft, setDraft] = useState(initialValue);
  if (urlValue !== initialValue) {
    setUrlValue(initialValue);
    setDraft(initialValue);
  }
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const q = draft.trim().slice(0, 100);
      if (q !== initialValue)
        void navigate({
          search: (previous) => ({
            ...previous,
            [field]: q || undefined,
            page: 1,
          }),
        });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draft, field, initialValue, navigate]);
  return (
    <Input
      value={draft}
      maxLength={100}
      onChange={(event) => setDraft(event.target.value)}
      placeholder={placeholder}
      className={className}
    />
  );
}

function resetSearch(update: (values: Partial<SearchState>) => void) {
  update({
    q: undefined,
    category: undefined,
    producerId: undefined,
    location: undefined,
    season: undefined,
    productionMethod: undefined,
    minPriceCents: undefined,
    maxPriceCents: undefined,
    sort: 'newest',
    page: 1,
  });
}

function ListingResults({ scope }: { scope: string }) {
  const { search, update } = useListingSearch(scope);
  const invalidRange =
    search.minPriceCents !== undefined &&
    search.maxPriceCents !== undefined &&
    search.minPriceCents > search.maxPriceCents;
  const query = useQuery({
    queryKey: listingKey(scope, search as SearchState),
    queryFn: () => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries({
        ...search,
        sort: search.sort ?? 'newest',
        page: search.page ?? 1,
      }))
        if (value !== undefined && value !== '') params.set(key, String(value));
      const path = scope === 'all' ? 'products' : `producers/${scope}/products`;
      return getJson<ProductList>(`${path}?${params}`, isProductList);
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
        <Filters scope="all" />
        <ListingResults scope="all" />
      </div>
    </main>
  );
}

export function ProductPage({ productId }: { productId: string }) {
  const query = useQuery({
    queryKey: productKey(productId),
    queryFn: () =>
      getJson<Product>(`products/${encodeURIComponent(productId)}`, isProduct),
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
            {pretty(product.category)} · {pretty(product.seasons.join(', '))}
          </p>
          <h1 className="mt-3 break-words text-4xl leading-tight">
            {product.name}
          </h1>
          <p className="mt-4 text-2xl font-semibold tabular-nums">
            {money(product.priceCents)}{' '}
            <span className="text-base font-normal text-muted-foreground">
              / {pretty(product.unit)}
            </span>
          </p>
          <p className="mt-6 break-words whitespace-pre-line leading-relaxed">
            {product.description}
          </p>
          <p className="mt-5 text-sm text-muted-foreground">
            {pretty(product.productionMethod)} production ·{' '}
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

function MapFrame({ producer }: { producer: Producer }) {
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
      getJson<Producer>(
        `producers/${encodeURIComponent(producerId)}`,
        isProducer,
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
        <Filters scope={producerId} />
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
