import { Link } from '@tanstack/react-router';
import { Leaf, Sprout } from 'lucide-react';
import type { components } from '@/lib/api-schema';
import { formatMoney, formatUnit } from '@/lib/format';

export type CatalogueProduct = components['schemas']['CatalogueProductDto'];

export function ProductCard({ product }: { product: CatalogueProduct }) {
  return (
    <article className="group relative flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card shadow-xs transition-shadow hover:shadow-md motion-reduce:transition-none">
      <div className="relative aspect-[16/11] overflow-hidden bg-secondary">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt=""
            width="800"
            height="550"
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
          />
        ) : (
          <div className="grid h-full place-items-center text-primary/70">
            <Sprout aria-hidden="true" className="size-9 stroke-[1.25]" />
          </div>
        )}
        {product.productionMethod === 'organic' && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-card/95 px-2 py-0.5 text-xs font-medium text-primary">
            <Leaf aria-hidden="true" className="size-3" /> Organic
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3 md:p-4">
        <h3 className="font-editorial line-clamp-2 break-words text-base leading-snug md:text-lg">
          <Link
            to="/product/$productId"
            params={{ productId: product.id }}
            className="after:absolute after:inset-0 focus-visible:outline-none"
          >
            {product.name}
          </Link>
        </h3>
        <p className="mt-0.5 truncate text-xs text-muted-foreground md:text-sm">
          {product.producerFarmName}
        </p>
        <p className="mt-auto pt-3 tabular-nums">
          <span className="text-lg font-semibold">
            {formatMoney(product.priceCents)}
          </span>
          <span className="text-sm text-muted-foreground">
            {' '}
            / {formatUnit(product.unit)}
          </span>
        </p>
      </div>
    </article>
  );
}

export function ProductGrid({ items }: { items: CatalogueProduct[] }) {
  return (
    <div
      className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4"
      data-catalogue-grid
    >
      {items.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
