import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Sprout } from 'lucide-react';
import type { components } from '@/lib/api-schema';
import { ProductGrid } from '@/components/shared/product-card';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { publicRequest } from '@/lib/session';

type ProductList = components['schemas']['CatalogueListDto'];

const FEATURED_COUNT = 8;

export function HomePage() {
  return (
    <main>
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
        <div className="mx-auto flex min-h-64 max-w-[1440px] flex-col justify-center px-4 py-10 md:min-h-80 md:px-8 xl:min-h-96 xl:px-12">
          <h1 className="max-w-[14ch] text-3xl leading-tight md:max-w-none md:text-5xl xl:text-6xl">
            Fresh from your region
          </h1>
          <p className="mt-2 max-w-[28ch] text-sm text-foreground/80 md:max-w-none md:text-lg">
            Local farmers. Real food. Stronger communities.
          </p>
          <Button asChild size="lg" className="mt-6 w-fit">
            <Link to="/products">
              Browse products <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] space-y-12 px-4 pt-8 md:space-y-16 md:px-8 md:pt-12 xl:px-12">
        <FeaturedProducts />
      </div>
    </main>
  );
}

function FeaturedProducts() {
  const query = useQuery({
    queryKey: ['catalogue', 'featured', FEATURED_COUNT],
    queryFn: () =>
      publicRequest<ProductList>(
        `products?sort=newest&page=1&limit=${FEATURED_COUNT}`,
      ),
    retry: false,
  });
  return (
    <section aria-labelledby="featured-heading">
      <div className="mb-5 flex items-center gap-4">
        <h2 id="featured-heading" className="text-2xl md:text-3xl">
          Our fresh produce
        </h2>
        <span
          aria-hidden="true"
          className="hidden h-px w-16 bg-border md:block"
        />
        <Link
          to="/products"
          className="ml-auto inline-flex min-h-11 items-center gap-1.5 text-sm font-medium hover:text-primary"
        >
          View all <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
      {query.isPending ? (
        <div
          className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4"
          aria-label="Loading products"
        >
          {Array.from({ length: FEATURED_COUNT }, (_, index) => (
            <div
              key={index}
              className="aspect-[4/5] animate-pulse rounded-lg bg-secondary motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState
          title="Products could not load"
          headingLevel="h3"
          retrying={query.isFetching}
          onRetry={() => void query.refetch()}
        />
      ) : query.data.items.length ? (
        <ProductGrid items={query.data.items} />
      ) : (
        <EmptyState
          icon={<Sprout />}
          title="No products yet"
          description="Local producers have not listed anything yet. Check back soon."
        />
      )}
    </section>
  );
}
