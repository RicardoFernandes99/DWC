import { useQueries, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, ShoppingBasket } from 'lucide-react';
import { ProductGrid } from '@/components/shared/product-card';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/format';
import { currentUser, publicRequest } from '@/lib/session';
import type { components } from '@/lib/api-schema';
import { useCart } from '../use-cart';
import type { StoredCartItem } from '../cart-storage';
import { ProducerCartSection } from './producer-cart-section';

type CatalogueProduct = components['schemas']['CatalogueProductDto'];
type ProductList = components['schemas']['CatalogueListDto'];

interface ProducerGroup {
  producerId: string;
  producerFarmName: string;
  producerCity: string;
  items: StoredCartItem[];
  subtotalCents: number;
}

export function CartPage() {
  const { items, updateQuantity, removeItem, clearCart, totalItemCount } =
    useCart();

  const userQuery = useQuery({
    queryKey: ['session'],
    queryFn: currentUser,
    staleTime: 0,
  });

  const featuredQuery = useQuery({
    queryKey: ['catalogue', 'featured-cart'],
    queryFn: () => publicRequest<ProductList>('products?limit=4&sort=newest'),
    staleTime: 60_000,
  });

  const productQueries = useQueries({
    queries: items.map((item) => ({
      queryKey: ['cart', 'product', item.productId],
      queryFn: () =>
        publicRequest<CatalogueProduct>(`products/${item.productId}`),
      staleTime: 30_000,
      retry: false,
    })),
  });

  const productMap = new Map<string, CatalogueProduct>();
  const errorMap = new Map<string, boolean>();
  const pendingMap = new Map<string, boolean>();

  for (let i = 0; i < items.length; i++) {
    const q = productQueries[i];
    if (q?.data) productMap.set(items[i].productId, q.data);
    if (q?.isError) errorMap.set(items[i].productId, true);
    if (q?.isPending && !q.data) pendingMap.set(items[i].productId, true);
  }

  const groupMap = new Map<string, ProducerGroup>();
  let subtotalCents = 0;
  let hasStockIssues = false;

  for (const item of items) {
    const live = productMap.get(item.productId);
    const isError = errorMap.get(item.productId);
    const isPending = pendingMap.get(item.productId);

    const producerId =
      live?.producerId ?? item.producerId ?? 'unknown-producer';
    const producerFarmName =
      live?.producerFarmName ?? item.producerFarmName ?? 'Local Farm';
    const producerCity = live?.producerCity ?? item.producerCity ?? '';

    const unitPrice = live?.priceCents ?? item.priceCents ?? 0;
    const lineTotal = unitPrice * item.quantity;

    const isUnavailable = isError || (!isPending && !live);
    const isSoldOut =
      !isUnavailable && !isPending && live && live.availableStock <= 0;
    const isInsufficient =
      !isUnavailable &&
      !isPending &&
      live &&
      item.quantity > live.availableStock &&
      live.availableStock > 0;

    if (isUnavailable || isSoldOut || isInsufficient) {
      hasStockIssues = true;
    }

    let group = groupMap.get(producerId);
    if (!group) {
      group = {
        producerId,
        producerFarmName,
        producerCity,
        items: [],
        subtotalCents: 0,
      };
      groupMap.set(producerId, group);
    }
    group.items.push(item);
    if (!isUnavailable && !isSoldOut) {
      group.subtotalCents += lineTotal;
      subtotalCents += lineTotal;
    }
  }

  const producerGroups = Array.from(groupMap.values());
  const isEmpty = items.length === 0;

  const user = userQuery.data;
  const isBuyer = user?.role === 'buyer';

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-8 md:px-8 md:py-10 xl:px-12">
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          <ArrowLeft aria-hidden="true" className="size-4" /> Continue shopping
        </Link>
        <h1 className="mt-2 font-editorial text-3xl font-bold tracking-tight md:text-4xl">
          Your Shopping Cart
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {totalItemCount === 1 ? '1 item' : `${totalItemCount} items`} from{' '}
          {producerGroups.length}{' '}
          {producerGroups.length === 1 ? 'producer' : 'producers'}
        </p>
      </div>

      {isEmpty ? (
        <div className="space-y-12">
          <section
            aria-labelledby="empty-cart-title"
            className="flex flex-col items-center justify-center rounded-lg border bg-card p-10 text-center shadow-2xs md:p-14"
          >
            <div className="grid size-16 place-items-center rounded-full bg-secondary text-primary">
              <ShoppingBasket
                aria-hidden="true"
                className="size-8 stroke-[1.5]"
              />
            </div>
            <h2
              id="empty-cart-title"
              className="mt-4 font-editorial text-2xl font-semibold"
            >
              Your cart is empty
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
              Explore freshly harvested fruits, vegetables, dairy, and artisanal
              goods directly from regional producers.
            </p>
            <Button asChild className="mt-6 rounded-md">
              <Link to="/">
                Explore the Market{' '}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          </section>

          {featuredQuery.data?.items && featuredQuery.data.items.length > 0 && (
            <section aria-labelledby="suggested-title" className="space-y-4">
              <h2
                id="suggested-title"
                className="font-editorial text-2xl font-semibold"
              >
                Fresh from local farms
              </h2>
              <ProductGrid items={featuredQuery.data.items} />
            </section>
          )}
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
          {/* Cart items list by producer */}
          <div className="space-y-6">
            {producerGroups.map((group) => (
              <ProducerCartSection
                key={group.producerId}
                producerId={group.producerId}
                producerFarmName={group.producerFarmName}
                producerCity={group.producerCity}
                items={group.items}
                productMap={productMap}
                errorMap={errorMap}
                pendingMap={pendingMap}
                subtotalCents={group.subtotalCents}
                onUpdateQuantity={updateQuantity}
                onRemove={removeItem}
              />
            ))}

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearCart}
                className="text-xs text-muted-foreground hover:text-destructive rounded-md"
              >
                Clear cart
              </Button>
            </div>
          </div>

          {/* Order Summary */}
          <aside aria-labelledby="order-summary-title">
            <div className="sticky top-6 rounded-lg border bg-card p-5 shadow-2xs sm:p-6">
              <h2
                id="order-summary-title"
                className="font-editorial text-xl font-semibold"
              >
                Order Summary
              </h2>

              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Total items</dt>
                  <dd className="font-medium tabular-nums">{totalItemCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Producers</dt>
                  <dd className="font-medium">{producerGroups.length}</dd>
                </div>
                <div className="border-t pt-3 flex justify-between text-base font-semibold">
                  <dt>Subtotal</dt>
                  <dd className="tabular-nums">{formatMoney(subtotalCents)}</dd>
                </div>
              </dl>

              <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
                Collection and delivery options are selected across all
                producers at checkout.
              </p>

              <div className="mt-6 space-y-2">
                {!user ? (
                  <Button asChild className="w-full rounded-md" size="lg">
                    <Link to="/login" search={{ returnTo: '/checkout' }}>
                      Sign in as buyer to check out
                    </Link>
                  </Button>
                ) : isBuyer ? (
                  <Button
                    asChild={!hasStockIssues}
                    disabled={hasStockIssues}
                    className="w-full rounded-md"
                    size="lg"
                  >
                    {hasStockIssues ? (
                      <span>Resolve issues to checkout</span>
                    ) : (
                      <Link to="/checkout">Proceed to checkout</Link>
                    )}
                  </Button>
                ) : null}

                {hasStockIssues && (
                  <p className="text-center text-xs text-destructive font-medium">
                    Adjust or remove unavailable items before placing your
                    order.
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
