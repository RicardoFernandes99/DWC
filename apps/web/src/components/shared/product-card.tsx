import { Link } from '@tanstack/react-router';
import { Sprout } from 'lucide-react';
import type { components } from '@/lib/api-schema';
import { formatLabel, formatMoney } from '@/lib/format';

export type CatalogueProduct = components['schemas']['CatalogueProductDto'];

export function ProductCard({ product }: { product: CatalogueProduct }) {
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
            {formatLabel(product.category)} ·{' '}
            {formatLabel(product.productionMethod)}
          </p>
          <p className="pt-1 font-semibold tabular-nums">
            {formatMoney(product.priceCents)}{' '}
            <span className="font-normal text-muted-foreground">
              / {formatLabel(product.unit)}
            </span>
          </p>
        </div>
      </Link>
    </article>
  );
}

export function ProductGrid({ items }: { items: CatalogueProduct[] }) {
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
