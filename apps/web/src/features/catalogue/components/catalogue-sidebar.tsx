import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Apple,
  Beef,
  Carrot,
  CookingPot,
  Croissant,
  CupSoda,
  Egg,
  LayoutGrid,
  Milk,
  Shapes,
  type LucideIcon,
} from 'lucide-react';
import type { components } from '@/lib/api-schema';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
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
import { PriceSlider, SearchControl } from './catalogue-filters';
import { activeFilterCount, clearedFilters } from '../filters';

type ProducerList = Omit<components['schemas']['ProducerListDto'], 'items'> & {
  items: PublicProducer[];
};
type Category = NonNullable<SearchState['category']>;

const categoryIcons: Record<Category, LucideIcon> = {
  vegetables: Carrot,
  fruits: Apple,
  dairy: Milk,
  eggs: Egg,
  meat: Beef,
  bakery: Croissant,
  pantry: CookingPot,
  beverages: CupSoda,
  other: Shapes,
};

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="border-t pt-5 first:border-t-0 first:pt-4">
      <legend className="float-left mb-3 w-full text-sm font-semibold">
        {title}
      </legend>
      <div className="clear-both">{children}</div>
    </fieldset>
  );
}

/** Market filters as a vertical panel; every change applies immediately. */
export function CatalogueSidebar({ onDone }: { onDone?: () => void }) {
  const { search, update } = useListingSearch('all');
  const producers = useQuery({
    queryKey: ['catalogue', 'producers'],
    queryFn: () => publicRequest<ProducerList>('producers?limit=50'),
    retry: false,
  });
  const listed = producers.data?.items ?? [];
  const selectedProducer = useQuery({
    queryKey: producerKey(search.producerId ?? ''),
    queryFn: () =>
      publicRequest<PublicProducer>(`producers/${search.producerId}`),
    enabled:
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
  const active = activeFilterCount(search);

  return (
    <section
      aria-label="Product filters"
      className={cn(onDone && 'flex min-h-0 flex-1 flex-col')}
    >
      <div
        className={cn(
          'space-y-5',
          onDone && 'flex-1 overflow-y-auto overscroll-contain px-4 pb-5',
        )}
      >
        {!onDone && (
          <div className="flex items-center gap-3">
            <h2 className="text-2xl">Shop by</h2>
            <span aria-hidden="true" className="h-px flex-1 bg-border" />
          </div>
        )}

        <Group title="Categories">
          <ul className="space-y-0.5">
            {[undefined, ...PRODUCT_CATEGORIES].map((value) => {
              const Icon = value ? categoryIcons[value] : LayoutGrid;
              const selected = search.category === value;
              return (
                <li key={value ?? 'all'}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => update({ category: value })}
                    className={cn(
                      'flex min-h-10 w-full items-center gap-3 rounded-md px-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring',
                      selected && 'bg-secondary font-semibold text-primary',
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      strokeWidth={1.5}
                      className="size-5 shrink-0"
                    />
                    {value ? formatLabel(value) : 'All products'}
                  </button>
                </li>
              );
            })}
          </ul>
        </Group>

        <Group title="Producer">
          <Select
            value={search.producerId ?? 'all'}
            onValueChange={(value) =>
              update({ producerId: value === 'all' ? undefined : value })
            }
          >
            <SelectTrigger aria-label="Producer" className="h-10 w-full">
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
        </Group>

        <Group title="Region">
          <label className="block">
            <span className="sr-only">City or region</span>
            <SearchControl
              initialValue={search.location ?? ''}
              from="/products"
              field="location"
              placeholder="City or region"
              className="h-10 w-full rounded-md bg-card px-3 text-sm"
            />
          </label>
        </Group>

        <Group title="Price range">
          <PriceSlider
            key={`${search.minPriceCents}-${search.maxPriceCents}`}
            minCents={search.minPriceCents}
            maxCents={search.maxPriceCents}
            onCommit={(minPriceCents, maxPriceCents) =>
              update({ minPriceCents, maxPriceCents })
            }
          />
          {invalidRange && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              Minimum price must be less than or equal to maximum price.
            </p>
          )}
        </Group>

        <Group title="Season">
          <div className="space-y-1">
            {[undefined, ...PRODUCT_SEASONS].map((value) => (
              <label
                key={value ?? 'all'}
                className="flex min-h-9 cursor-pointer items-center gap-3 text-sm"
              >
                <input
                  type="radio"
                  name="season"
                  checked={search.season === value}
                  onChange={() => update({ season: value })}
                  className="size-4 accent-primary"
                />
                {value ? formatLabel(value) : 'Any season'}
              </label>
            ))}
          </div>
        </Group>

        <Group title="Production method">
          <Select
            value={search.productionMethod ?? 'all'}
            onValueChange={(value) =>
              update({
                productionMethod: (value === 'all'
                  ? undefined
                  : value) as SearchState['productionMethod'],
              })
            }
          >
            <SelectTrigger
              aria-label="Production method"
              className="h-10 w-full"
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
        </Group>
      </div>

      {/* In the sheet the actions stay pinned; in the sidebar they follow the groups. */}
      <div
        className={cn(
          'flex gap-2 border-t',
          onDone ? 'shrink-0 bg-background p-4' : 'mt-5 flex-col pt-5',
        )}
      >
        {active > 0 && (
          <Button
            variant="outline"
            size="lg"
            className={cn(onDone && 'flex-1')}
            onClick={() => update({ ...clearedFilters, q: search.q })}
          >
            Clear filters
          </Button>
        )}
        {onDone && (
          <Button size="lg" className="flex-1" onClick={onDone}>
            Show results
          </Button>
        )}
      </div>
    </section>
  );
}
