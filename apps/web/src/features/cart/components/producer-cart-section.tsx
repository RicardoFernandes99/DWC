import { Link } from '@tanstack/react-router';
import { Store } from 'lucide-react';
import type { components } from '@/lib/api-schema';
import { formatMoney } from '@/lib/format';
import type { StoredCartItem } from '../cart-storage';
import { CartLineItem } from './cart-line-item';

type CatalogueProduct = components['schemas']['CatalogueProductDto'];

interface ProducerCartSectionProps {
  producerId: string;
  producerFarmName: string;
  producerCity: string;
  items: StoredCartItem[];
  productMap: Map<string, CatalogueProduct>;
  errorMap: Map<string, boolean>;
  pendingMap: Map<string, boolean>;
  subtotalCents: number;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
}

export function ProducerCartSection({
  producerId,
  producerFarmName,
  producerCity,
  items,
  productMap,
  errorMap,
  pendingMap,
  subtotalCents,
  onUpdateQuantity,
  onRemove,
}: ProducerCartSectionProps) {
  const isRealProducer = producerId && producerId !== 'unknown-producer';

  return (
    <section
      className="rounded-lg border bg-card p-4 shadow-2xs sm:p-5"
      aria-labelledby={`producer-heading-${producerId}`}
      data-testid={`producer-cart-group-${producerId}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Store
            aria-hidden="true"
            className="size-4.5 text-primary shrink-0"
          />
          <h3
            id={`producer-heading-${producerId}`}
            className="font-editorial text-lg font-semibold truncate"
          >
            {isRealProducer ? (
              <Link
                to="/farm/$producerId"
                params={{ producerId }}
                className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                {producerFarmName}
              </Link>
            ) : (
              producerFarmName
            )}
          </h3>
          {producerCity && (
            <span className="text-xs text-muted-foreground truncate">
              · {producerCity}
            </span>
          )}
        </div>
      </header>

      <div className="divide-y divide-border/50">
        {items.map((item) => (
          <CartLineItem
            key={item.productId}
            item={item}
            liveProduct={productMap.get(item.productId)}
            isError={errorMap.get(item.productId)}
            isPending={pendingMap.get(item.productId)}
            onUpdateQuantity={onUpdateQuantity}
            onRemove={onRemove}
          />
        ))}
      </div>

      <footer className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
        <span className="text-muted-foreground">Producer subtotal</span>
        <span className="font-semibold tabular-nums">
          {formatMoney(subtotalCents)}
        </span>
      </footer>
    </section>
  );
}
