import { useDeferredValue, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import type { components } from '@/lib/api-schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

const producerListKey = ['catalogue', 'producers'] as const;

export function CatalogueFilters({ scope }: { scope: string }) {
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
      return publicRequest<ProducerList>(`producers?${params}`);
    },
    enabled: scope === 'all',
    retry: false,
  });
  const selectedProducerQuery = useQuery({
    queryKey: producerKey(search.producerId ?? ''),
    queryFn: () =>
      publicRequest<PublicProducer>(`producers/${search.producerId}`),
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
              {PRODUCT_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {formatLabel(value)}
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
              {PRODUCT_SEASONS.map((value) => (
                <option key={value} value={value}>
                  {formatLabel(value)}
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
              {PRODUCTION_METHODS.map((value) => (
                <option key={value} value={value}>
                  {formatLabel(value)}
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
