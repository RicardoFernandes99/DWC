import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ChevronDown, Search } from 'lucide-react';
import type { components } from '@/lib/api-schema';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  formatLabel,
  PRODUCT_CATEGORIES,
  PRODUCT_SEASONS,
  PRODUCTION_METHODS,
} from '@/lib/format';
import { publicRequest } from '@/lib/session';
import {
  producerKey,
  useListingSearch,
  type PublicProducer,
  type SearchState,
} from '../use-listing-search';

type ProducerList = Omit<components['schemas']['ProducerListDto'], 'items'> & {
  items: PublicProducer[];
};

const chip =
  'h-9 shrink-0 rounded-lg border border-input bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring';

export function CatalogueFilters({ scope }: { scope: string }) {
  const { search, update } = useListingSearch(scope);
  const isMarket = scope === 'all';
  const producers = useQuery({
    queryKey: ['catalogue', 'producers'],
    queryFn: () => publicRequest<ProducerList>('producers?limit=50'),
    enabled: isMarket,
    retry: false,
  });
  const listed = producers.data?.items ?? [];
  const selectedProducer = useQuery({
    queryKey: producerKey(search.producerId ?? ''),
    queryFn: () =>
      publicRequest<PublicProducer>(`producers/${search.producerId}`),
    enabled:
      isMarket &&
      Boolean(search.producerId) &&
      producers.isSuccess &&
      !listed.some((producer) => producer.id === search.producerId),
    retry: false,
  });
  const producerOptions = [
    ...(selectedProducer.data ? [selectedProducer.data] : []),
    ...listed,
  ];
  const invalidRange =
    search.minPriceCents !== undefined &&
    search.maxPriceCents !== undefined &&
    search.minPriceCents > search.maxPriceCents;
  const hasFilters = [
    search.q,
    search.category,
    search.producerId,
    search.location,
    search.season,
    search.productionMethod,
    search.minPriceCents,
    search.maxPriceCents,
  ].some((value) => value !== undefined && value !== '');
  const from = isMarket ? '/' : '/farm/$producerId';

  return (
    <section aria-label="Catalogue filters" className="space-y-3">
      <div className="flex flex-col gap-2.5 md:flex-row md:flex-wrap md:items-center md:gap-2">
        <label className="relative block md:w-72">
          <span className="sr-only">Search products</span>
          <Search
            aria-hidden="true"
            className="absolute left-3.5 top-3 size-4 text-muted-foreground"
          />
          <SearchControl
            initialValue={search.q ?? ''}
            from={from}
            placeholder="Search produce, farmers, or keywords…"
            className="h-10 rounded-lg bg-card pl-9.5 text-sm"
          />
        </label>

        {/* Mobile horizontal category chip scroller */}
        <div
          role="group"
          aria-label="Categories"
          className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:hidden"
        >
          {[undefined, ...PRODUCT_CATEGORIES].map((value) => (
            <button
              key={value ?? 'all'}
              type="button"
              aria-pressed={search.category === value}
              onClick={() => update({ category: value })}
              className={cn(
                chip,
                search.category === value &&
                  'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
              )}
            >
              {value ? formatLabel(value) : 'All categories'}
            </button>
          ))}
        </div>

        {/* Filter controls toolbar */}
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 md:contents">
          {/* Desktop Category Dropdown */}
          <div className="hidden shrink-0 md:block">
            <Select
              value={search.category ?? 'all'}
              onValueChange={(val) =>
                update({
                  category: (val === 'all'
                    ? undefined
                    : val) as SearchState['category'],
                })
              }
            >
              <SelectTrigger
                aria-label="Category"
                className="h-10 w-[140px] rounded-lg"
              >
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {PRODUCT_CATEGORIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {formatLabel(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Producer Dropdown */}
          {isMarket && (
            <div className="shrink-0">
              <Select
                value={search.producerId ?? 'all'}
                onValueChange={(val) =>
                  update({ producerId: val === 'all' ? undefined : val })
                }
              >
                <SelectTrigger
                  aria-label="Producer"
                  className="h-10 w-44 rounded-lg"
                >
                  <SelectValue placeholder="Producer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All producers</SelectItem>
                  {producerOptions.map((producer) => (
                    <SelectItem key={producer.id} value={producer.id}>
                      {producer.farmName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Location Search Input */}
          {isMarket && (
            <label className="shrink-0">
              <span className="sr-only">Location</span>
              <SearchControl
                initialValue={search.location ?? ''}
                from="/"
                field="location"
                placeholder="City or region"
                className="h-10 w-36 rounded-lg bg-card px-3 text-sm"
              />
            </label>
          )}

          {/* Season Dropdown */}
          <div className="shrink-0">
            <Select
              value={search.season ?? 'all'}
              onValueChange={(val) =>
                update({
                  season: (val === 'all'
                    ? undefined
                    : val) as SearchState['season'],
                })
              }
            >
              <SelectTrigger
                aria-label="Season"
                className="h-10 w-32 rounded-lg"
              >
                <SelectValue placeholder="Season" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All seasons</SelectItem>
                {PRODUCT_SEASONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {formatLabel(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Production Method Dropdown */}
          <div className="shrink-0">
            <Select
              value={search.productionMethod ?? 'all'}
              onValueChange={(val) =>
                update({
                  productionMethod: (val === 'all'
                    ? undefined
                    : val) as SearchState['productionMethod'],
                })
              }
            >
              <SelectTrigger
                aria-label="Production method"
                className="h-10 w-36 rounded-lg"
              >
                <SelectValue placeholder="Method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All methods</SelectItem>
                {PRODUCTION_METHODS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {formatLabel(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Price Range */}
          <PriceRange
            key={`${search.minPriceCents}-${search.maxPriceCents}`}
            minCents={search.minPriceCents}
            maxCents={search.maxPriceCents}
            onCommit={(minPriceCents, maxPriceCents) =>
              update({ minPriceCents, maxPriceCents })
            }
          />

          {/* Sort Dropdown */}
          <div className="shrink-0">
            <Select
              value={search.sort}
              onValueChange={(val) =>
                update({ sort: val as SearchState['sort'] })
              }
            >
              <SelectTrigger
                aria-label="Sort by"
                className="h-10 w-44 rounded-lg"
              >
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="price_asc">Price: low to high</SelectItem>
                <SelectItem value="price_desc">Price: high to low</SelectItem>
                <SelectItem value="name_asc">Name: A to Z</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {hasFilters && (
            <button
              type="button"
              className="h-10 shrink-0 px-2 text-sm font-medium text-primary hover:underline underline-offset-4"
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
              Clear all
            </button>
          )}
        </div>
      </div>
      {invalidRange && (
        <p role="alert" className="text-sm text-destructive">
          Minimum price must be less than or equal to maximum price.
        </p>
      )}
    </section>
  );
}

/** Upper slider bound; the top position means "no maximum". */
const PRICE_CEILING_CENTS = 3000;
const PRICE_STEP_CENTS = 50;

function PriceRange({
  minCents,
  maxCents,
  onCommit,
}: {
  minCents: number | undefined;
  maxCents: number | undefined;
  onCommit: (min: number | undefined, max: number | undefined) => void;
}) {
  const [range, setRange] = useState([
    Math.min(minCents ?? 0, PRICE_CEILING_CENTS),
    Math.min(maxCents ?? PRICE_CEILING_CENTS, PRICE_CEILING_CENTS),
  ]);
  const [low, high] = range as [number, number];
  const euros = (cents: number) =>
    `€${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
  const describe = (from: number, to: number) =>
    from === 0 && to === PRICE_CEILING_CENTS
      ? 'Any price'
      : to === PRICE_CEILING_CENTS
        ? `${euros(from)}+`
        : `${euros(from)} – ${euros(to)}`;
  const active = minCents !== undefined || maxCents !== undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Price: ${describe(minCents ?? 0, maxCents ?? PRICE_CEILING_CENTS)}`}
          className={cn(
            'flex h-10 w-36 shrink-0 items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
            !active && 'text-foreground',
          )}
        >
          <span className="truncate tabular-nums">
            {active
              ? describe(minCents ?? 0, maxCents ?? PRICE_CEILING_CENTS)
              : 'Any price'}
          </span>
          <ChevronDown aria-hidden="true" className="size-4 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <div className="mb-4 flex items-baseline justify-between">
          <p className="text-sm font-medium">Price</p>
          <p className="text-sm tabular-nums text-muted-foreground">
            {describe(low, high)}
          </p>
        </div>
        <Slider
          min={0}
          max={PRICE_CEILING_CENTS}
          step={PRICE_STEP_CENTS}
          minStepsBetweenThumbs={1}
          value={range}
          thumbLabels={['Minimum price', 'Maximum price']}
          onValueChange={setRange}
          onValueCommit={([from, to]) =>
            onCommit(
              from ? from : undefined,
              to === undefined || to >= PRICE_CEILING_CENTS ? undefined : to,
            )
          }
        />
        <div className="mt-2 flex justify-between text-xs tabular-nums text-muted-foreground">
          <span>€0</span>
          <span>{euros(PRICE_CEILING_CENTS)}+</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SearchControl({
  initialValue,
  from,
  field = 'q',
  placeholder,
  className,
}: {
  initialValue: string;
  from: '/' | '/farm/$producerId';
  field?: 'q' | 'location';
  placeholder: string;
  className: string;
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
      const value = draft.trim().slice(0, 100);
      if (value !== initialValue)
        void navigate({
          search: (previous) => ({
            ...previous,
            [field]: value || undefined,
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
