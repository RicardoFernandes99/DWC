import { Link } from '@tanstack/react-router';
import { Sprout, Trash2 } from 'lucide-react';
import { QuantityStepper } from '@/components/shared/quantity-stepper';
import type { components } from '@/lib/api-schema';
import { Button } from '@/components/ui/button';
import { formatMoney, formatUnit } from '@/lib/format';
import type { StoredCartItem } from '../cart-storage';

type CatalogueProduct = components['schemas']['CatalogueProductDto'];

interface CartLineItemProps {
  item: StoredCartItem;
  liveProduct?: CatalogueProduct;
  isError?: boolean;
  isPending?: boolean;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
}

export function CartLineItem({
  item,
  liveProduct,
  isError,
  isPending,
  onUpdateQuantity,
  onRemove,
}: CartLineItemProps) {
  const name = liveProduct?.name ?? item.name ?? 'Produce item';
  const unit = liveProduct?.unit ?? item.unit ?? 'unit';
  const imageUrl = liveProduct?.imageUrl ?? item.imageUrl;
  const unitPriceCents = liveProduct?.priceCents ?? item.priceCents ?? 0;
  const lineTotalCents = unitPriceCents * item.quantity;
  const availableStock = liveProduct?.availableStock ?? 0;

  const isUnavailable = isError || (!isPending && !liveProduct);
  const isSoldOut =
    !isUnavailable && !isPending && liveProduct && availableStock <= 0;
  const isInsufficient =
    !isUnavailable &&
    !isPending &&
    liveProduct &&
    item.quantity > availableStock &&
    availableStock > 0;

  return (
    <div
      className={`flex flex-col gap-4 border-b py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between ${
        isUnavailable || isSoldOut ? 'opacity-75' : ''
      }`}
      data-testid={`cart-line-${item.productId}`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-secondary sm:size-20">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              width="80"
              height="80"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full place-items-center text-primary/70">
              <Sprout aria-hidden="true" className="size-6 stroke-[1.25]" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h4 className="font-editorial text-base leading-snug line-clamp-1">
            <Link
              to="/product/$productId"
              params={{ productId: item.productId }}
              className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              {name}
            </Link>
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
            {formatMoney(unitPriceCents)} / {formatUnit(unit)}
          </p>

          {/* Status feedback */}
          {isUnavailable && (
            <p
              className="mt-1 text-xs font-medium text-destructive"
              role="alert"
            >
              Product no longer available or producer is inactive.
            </p>
          )}
          {isSoldOut && (
            <p
              className="mt-1 text-xs font-medium text-destructive"
              role="alert"
            >
              Out of stock
            </p>
          )}
          {isInsufficient && (
            <div className="mt-1 flex items-center gap-2">
              <span
                className="text-xs font-medium text-destructive"
                role="alert"
              >
                Only {availableStock} available
              </span>
              <button
                type="button"
                onClick={() => onUpdateQuantity(item.productId, availableStock)}
                className="text-xs text-primary underline underline-offset-2 hover:opacity-80"
              >
                Adjust to {availableStock}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 sm:justify-end">
        {/* Quantity Controls */}
        <QuantityStepper
          variant="outline"
          label={`Quantity of ${name}`}
          value={item.quantity}
          max={availableStock > 0 ? availableStock : undefined}
          disabled={isUnavailable || isSoldOut}
          onChange={(quantity) => onUpdateQuantity(item.productId, quantity)}
        />

        {/* Line Price Total */}
        <div className="min-w-20 text-right tabular-nums">
          <span className="text-sm font-semibold">
            {formatMoney(lineTotalCents)}
          </span>
        </div>

        {/* Remove Line Button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-destructive rounded-md"
          aria-label={`Remove ${name} from cart`}
          onClick={() => onRemove(item.productId)}
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </div>
  );
}
