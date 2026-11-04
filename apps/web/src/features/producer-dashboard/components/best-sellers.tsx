import { formatMoney, formatUnit } from '@/lib/format';
import type { ProducerMetrics } from '../metrics';

export function BestSellers({
  items,
}: {
  items: ProducerMetrics['bestSellers'];
}) {
  return (
    <section aria-labelledby="best-sellers-title" className="min-w-0">
      <h3 id="best-sellers-title" className="text-base font-semibold">
        Best sellers
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Top 5 products by product revenue. Units are counted per product unit.
      </p>
      {items.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No sales in this period.
        </p>
      ) : (
        <ol className="mt-4 divide-y rounded-lg border">
          {items.map((item, index) => (
            <li
              key={item.productId}
              className="flex items-start gap-3 p-3 text-sm"
            >
              <span
                aria-hidden="true"
                className="w-5 shrink-0 text-muted-foreground tabular-nums"
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium break-words">{item.productName}</p>
                <p className="mt-0.5 text-muted-foreground tabular-nums">
                  {item.orderCount} {item.orderCount === 1 ? 'order' : 'orders'}
                  {item.unitsSold.length > 0 && (
                    <>
                      {' · '}
                      {item.unitsSold
                        .map(
                          (units) =>
                            `${units.quantity} ${formatUnit(units.unit)}`,
                        )
                        .join(' · ')}
                    </>
                  )}
                </p>
              </div>
              <p className="shrink-0 font-medium tabular-nums">
                {formatMoney(item.productRevenueCents)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
