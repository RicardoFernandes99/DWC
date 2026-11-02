import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import type { components } from '@/lib/api-schema';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { SelectPill } from '@/components/ui/select-pill';
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

const pill =
  'h-10 shrink-0 rounded-full border border-input bg-card px-4 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring';

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
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-2">
        <label className="relative block md:w-72">
          <span className="sr-only">Search products</span>
          <Search
            aria-hidden="true"
            className="absolute left-4 top-3 size-4 text-muted-foreground"
          />
          <SearchControl
            initialValue={search.q ?? ''}
            from={from}
            placeholder="Search for produce, farmers, or keywords…"
            className="h-10 rounded-full bg-card pl-10 text-sm"
          />
        </label>

        <div
          role="group"
          aria-label="Categories"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:hidden"
        >
          {[undefined, ...PRODUCT_CATEGORIES].map((value) => (
            <button
              key={value ?? 'all'}
              type="button"
              aria-pressed={search.category === value}
              onClick={() => update({ category: value })}
              className={cn(
                pill,
                'h-9',
                search.category === value &&
                  'border-primary bg-primary text-primary-foreground',
              )}
            >
              {value ? formatLabel(value) : 'All'}
            </button>
          ))}
        </div>

        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 md:contents">
          <SelectPill
            aria-label="Category"
            containerClassName="hidden md:inline-flex"
            value={search.category ?? ''}
            onChange={(event) =>
              update({
                category: (event.target.value ||
                  undefined) as SearchState['category'],
              })
            }
          >
            <option value="">Category</option>
            {PRODUCT_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {formatLabel(value)}
              </option>
            ))}
          </SelectPill>
          {isMarket && (
            <SelectPill
              aria-label="Producer"
              className="max-w-52"
              value={search.producerId ?? ''}
              onChange={(event) =>
                update({ producerId: event.target.value || undefined })
              }
            >
              <option value="">Producer</option>
              {producerOptions.map((producer) => (
                <option key={producer.id} value={producer.id}>
                  {producer.farmName}
                </option>
              ))}
            </SelectPill>
          )}
          {isMarket && (
            <label className="shrink-0">
              <span className="sr-only">Location</span>
              <SearchControl
                initialValue={search.location ?? ''}
                from="/"
                field="location"
                placeholder="Location"
                className="h-10 w-36 rounded-full bg-card px-4 text-sm"
              />
            </label>
          )}
          <SelectPill
            aria-label="Season"
            value={search.season ?? ''}
            onChange={(event) =>
              update({
                season: (event.target.value ||
                  undefined) as SearchState['season'],
              })
            }
          >
            <option value="">Season</option>
            {PRODUCT_SEASONS.map((value) => (
              <option key={value} value={value}>
                {formatLabel(value)}
              </option>
            ))}
          </SelectPill>
          <SelectPill
            aria-label="Production method"
            value={search.productionMethod ?? ''}
            onChange={(event) =>
              update({
                productionMethod: (event.target.value ||
                  undefined) as SearchState['productionMethod'],
              })
            }
          >
            <option value="">Production</option>
            {PRODUCTION_METHODS.map((value) => (
              <option key={value} value={value}>
                {formatLabel(value)}
              </option>
            ))}
          </SelectPill>
          <PriceInput
            key={`min-${search.minPriceCents}`}
            label="Minimum price in EUR"
            placeholder="Min €"
            cents={search.minPriceCents}
            onCommit={(value) => update({ minPriceCents: value })}
          />
          <PriceInput
            key={`max-${search.maxPriceCents}`}
            label="Maximum price in EUR"
            placeholder="Max €"
            cents={search.maxPriceCents}
            onCommit={(value) => update({ maxPriceCents: value })}
          />
          <SelectPill
            aria-label="Sort by"
            value={search.sort}
            onChange={(event) =>
              update({ sort: event.target.value as SearchState['sort'] })
            }
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="name_asc">Name</option>
          </SelectPill>
          {hasFilters && (
            <button
              type="button"
              className="h-10 shrink-0 px-2 text-sm text-primary underline underline-offset-4"
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

function PriceInput({
  label,
  placeholder,
  cents,
  onCommit,
}: {
  label: string;
  placeholder: string;
  cents: number | undefined;
  onCommit: (value: number | undefined) => void;
}) {
  const [draft, setDraft] = useState(
    cents === undefined ? '' : (cents / 100).toFixed(2),
  );
  const [invalid, setInvalid] = useState(false);
  function commit() {
    const text = draft.trim();
    if (!text) return onCommit(undefined);
    const match = /^(\d{1,6})(?:[.,](\d{1,2}))?$/.exec(text);
    setInvalid(!match);
    if (match)
      onCommit(
        Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0')),
      );
  }
  return (
    <Input
      type="text"
      inputMode="decimal"
      aria-label={label}
      aria-invalid={invalid}
      title={invalid ? 'Enter an amount like 4.50' : undefined}
      placeholder={placeholder}
      value={draft}
      onChange={(event) => {
        setInvalid(false);
        setDraft(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit();
      }}
      className="h-10 w-24 shrink-0 rounded-full bg-card px-4 text-sm"
    />
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
