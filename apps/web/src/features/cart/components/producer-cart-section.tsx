import { Link } from '@tanstack/react-router';
import { Store } from 'lucide-react';
import { formatMoney } from '@/lib/format';
import type { ProducerCartGroup } from '../use-hydrated-cart';
import { CartLineItem } from './cart-line-item';

interface ProducerCartSectionProps {
  group: ProducerCartGroup;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
}

export function ProducerCartSection({
  group,
  onUpdateQuantity,
  onRemove,
}: ProducerCartSectionProps) {
  const isRealProducer =
    group.producerId && group.producerId !== 'unknown-producer';

  return (
    <section
      className="rounded-lg border bg-card p-4 shadow-2xs sm:p-5"
      aria-labelledby={`producer-heading-${group.producerId}`}
      data-testid={`producer-cart-group-${group.producerId}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Store
            aria-hidden="true"
            className="size-4.5 text-primary shrink-0"
          />
          <h3
            id={`producer-heading-${group.producerId}`}
            className="font-editorial text-lg font-semibold truncate"
          >
            {isRealProducer ? (
              <Link
                to="/farm/$producerId"
                params={{ producerId: group.producerId }}
                className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                {group.producerFarmName}
              </Link>
            ) : (
              group.producerFarmName
            )}
          </h3>
          {group.producerCity && (
            <span className="text-xs text-muted-foreground truncate">
              · {group.producerCity}
            </span>
          )}
        </div>
      </header>

      <div className="divide-y divide-border/50">
        {group.lines.map((line) => (
          <CartLineItem
            key={line.item.productId}
            line={line}
            onUpdateQuantity={onUpdateQuantity}
            onRemove={onRemove}
          />
        ))}
      </div>

      <footer className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
        <span className="text-muted-foreground">Producer subtotal</span>
        <span className="font-semibold tabular-nums">
          {formatMoney(group.subtotalCents)}
        </span>
      </footer>
    </section>
  );
}
