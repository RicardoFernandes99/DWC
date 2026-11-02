import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ShoppingBasket,
} from 'lucide-react';
import { ProductGrid } from '@/components/shared/product-card';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/format';
import { currentUser, publicRequest } from '@/lib/session';
import type { components } from '@/lib/api-schema';
import { useHydratedCart } from '../use-hydrated-cart';
import { ProducerCartSection } from './producer-cart-section';

type ProductList = components['schemas']['CatalogueListDto'];

export function CartPage() {
  const {
    isEmpty,
    producerGroups,
    subtotalCents,
    totalItemCount,
    hasAnyIssues,
    updateQuantity,
    removeItem,
    clearCart,
  } = useHydratedCart();

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

  const user = userQuery.data;
  const isProducer = user?.role === 'producer';
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

      {isProducer && (
        <div
          role="status"
          className="mb-6 flex items-start gap-3 rounded-lg border border-warning/50 bg-warning/10 p-4 text-sm text-warning-foreground"
        >
          <AlertCircle
            aria-hidden="true"
            className="size-5 shrink-0 text-warning"
          />
          <div>
            <p className="font-semibold">
              Producer accounts cannot purchase products
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Your cart is preserved. To place an order, please sign in with a
              buyer account.
            </p>
          </div>
        </div>
      )}

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
                group={group}
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
                    <Link to="/login" search={{ returnTo: '/cart' }}>
                      Sign in as buyer to check out
                    </Link>
                  </Button>
                ) : isProducer ? (
                  <Button disabled className="w-full rounded-md" size="lg">
                    Producer account (Checkout disabled)
                  </Button>
                ) : isBuyer ? (
                  <>
                    <Button
                      disabled
                      aria-disabled="true"
                      className="w-full rounded-md"
                      size="lg"
                      title="Checkout is gated until Ticket 018"
                    >
                      Proceed to checkout
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      Checkout will be available in the next release (Ticket
                      018). Your cart is saved.
                    </p>
                  </>
                ) : null}

                {hasAnyIssues && (
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
