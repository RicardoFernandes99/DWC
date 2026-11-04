import { Link } from '@tanstack/react-router';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatUnit } from '@/lib/format';
import type { ProducerMetrics } from '../metrics';

export function LowStock({
  lowStock,
  canEdit,
}: {
  lowStock: ProducerMetrics['lowStock'];
  canEdit: boolean;
}) {
  const { items, totalCount } = lowStock;
  return (
    <section aria-labelledby="low-stock-title" className="min-w-0">
      <h3 id="low-stock-title" className="text-base font-semibold">
        Low stock
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Products with available stock at or below their threshold. Stock
        reserved for auctions is already excluded. Not limited by period.
      </p>
      {!canEdit && (
        <p className="mt-2 text-sm text-muted-foreground">
          Product editing is paused while your account is suspended.
        </p>
      )}
      {items.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No products are low on stock.
        </p>
      ) : (
        <>
          <ul className="mt-4 divide-y rounded-lg border">
            {items.map((item) => (
              <li
                key={item.productId}
                className="flex items-center justify-between gap-3 p-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium break-words">
                    {item.name}
                    {!item.published && (
                      <span className="ml-2 rounded-md border px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                        Draft
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-muted-foreground tabular-nums">
                    <span className="font-medium text-destructive">
                      {item.availableStock} {formatUnit(item.unit)} available
                    </span>
                    {` · Threshold ${item.lowStockThreshold}`}
                    {item.reservedStock > 0 &&
                      ` · ${item.reservedStock} reserved`}
                  </p>
                </div>
                {canEdit && (
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                  >
                    <Link
                      to="/producer/products/$productId/edit"
                      params={{ productId: item.productId }}
                      aria-label={`Edit stock and threshold for ${item.name}`}
                    >
                      <Pencil aria-hidden="true" />
                      Edit
                    </Link>
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {totalCount > items.length && (
            <p className="mt-2 text-sm text-muted-foreground tabular-nums">
              Showing {items.length} of {totalCount}, lowest stock first.
            </p>
          )}
        </>
      )}
    </section>
  );
}
