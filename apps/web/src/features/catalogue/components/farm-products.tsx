import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Sprout } from 'lucide-react';
import type { components } from '@/lib/api-schema';
import { ProductCard } from '@/components/shared/product-card';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { publicRequest } from '@/lib/session';
import { cn } from '@/lib/utils';

type ProductList = components['schemas']['CatalogueListDto'];

/** Cards shown per row: 2 on phones, 3 from md, 4 from xl. */
const ROW = { base: 2, md: 3, xl: 4 } as const;
const visibility = (index: number) =>
  cn(
    index >= ROW.base && 'hidden',
    index >= ROW.base && index < ROW.md && 'md:block',
    index >= ROW.md && index < ROW.xl && 'xl:block',
  );

/**
 * One row of the farm's newest products, like the farm auctions section.
 * "All farm products" opens /products filtered to this farm when the farm
 * has more than fits in the row.
 */
export function FarmProducts({ producerId }: { producerId: string }) {
  // Same query as the farm hero, so the page makes one request.
  const query = useQuery({
    queryKey: ['catalogue', 'farm-hero', producerId],
    queryFn: () =>
      publicRequest<ProductList>(
        `producers/${encodeURIComponent(producerId)}/products?sort=newest&page=1`,
      ),
    retry: false,
  });
  const items = query.data?.items.slice(0, ROW.xl) ?? [];
  const total = query.data?.total ?? 0;

  return (
    <section className="space-y-5" aria-labelledby="farm-products-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="farm-products-heading" className="text-2xl">
          Products
          {query.data && (
            <span className="ml-2 font-sans text-base font-normal text-muted-foreground tabular-nums">
              {total}
            </span>
          )}
        </h2>
        {total > ROW.base && (
          <Link
            to="/products"
            search={{ producerId }}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline',
              total <= ROW.md && 'md:hidden',
              total > ROW.md && total <= ROW.xl && 'xl:hidden',
            )}
          >
            All farm products{' '}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        )}
      </div>
      {query.isPending && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
          {Array.from({ length: ROW.xl }, (_, index) => (
            <div
              key={index}
              className={cn(
                'aspect-[4/5] animate-pulse rounded-lg bg-secondary motion-reduce:animate-none',
                visibility(index),
              )}
            />
          ))}
        </div>
      )}
      {query.isError && !query.data && (
        <ErrorState
          title="Products could not load"
          retrying={query.isFetching}
          onRetry={() => void query.refetch()}
        />
      )}
      {query.data && total === 0 && (
        <EmptyState
          icon={<Sprout />}
          title="No products yet"
          description="This farm has not listed any products yet. Check back soon."
        />
      )}
      {items.length > 0 && (
        <ul
          className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4"
          aria-label="Farm products"
        >
          {items.map((product, index) => (
            <li key={product.id} className={cn('min-w-0', visibility(index))}>
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
