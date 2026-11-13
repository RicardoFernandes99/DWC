import { ProducerHome } from './features/producer-dashboard/components/producer-home';
import { safeReturn } from './safe-return';
import { queryClient, sessionOptions } from './lib/session-query';
import { routeAccess } from './route-access';
import {
  redirect,
  stripSearchParams,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { Shell, AuthPage, Account } from './pages';
import { UIDesignPage } from './pages/ui-design';
import { CartPage } from './features/cart/components/cart-page';
import { CheckoutPage } from './features/checkout/components/checkout-page';
import { NotificationPage } from './features/notifications/components/notification-page';
import { OrderTrackingPage } from './features/orders/components/order-tracking-page';
import { ProducerAuctions } from './features/producer-auctions/components/producer-auctions';
import { AuctionsPage } from './features/auctions/components/auction-list';
import { AuctionRoomRoute } from './features/auctions/components/auction-room';
import { HomePage } from './features/catalogue/components/home-page';
import {
  ProductsPage,
  ProductDetailRoute,
  ProducerDetailRoute,
  type SearchState,
} from './features/catalogue/catalogue';
import { validateMetricsSearch } from './features/producer-dashboard/metrics';
import {
  PRODUCT_CATEGORIES,
  PRODUCT_SEASONS,
  PRODUCTION_METHODS,
} from './lib/format';

const sorts = ['newest', 'price_asc', 'price_desc', 'name_asc'] as const;
const orderStages = ['open', 'completed', 'cancelled'] as const;
function validateOrdersSearch(search: Record<string, unknown>) {
  const stage = enumValue(search.stage, orderStages);
  return {
    page: numberValue(search.page, 1, 10_000) ?? 1,
    // "open" is the default tab, so it stays out of the URL.
    ...(stage && stage !== 'open' ? { stage } : {}),
  };
}
function enumValue<T extends readonly string[]>(
  value: unknown,
  values: T,
): T[number] | undefined {
  return typeof value === 'string' && values.includes(value)
    ? value
    : undefined;
}
function numberValue(value: unknown, min: number, max: number) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(number) && number >= min && number <= max
    ? number
    : undefined;
}
function validateCatalogueSearch(search: Record<string, unknown>): SearchState {
  const stringValue = (key: string, max: number) =>
    typeof search[key] === 'string' && search[key].trim().length > 0
      ? search[key].trim().slice(0, max)
      : undefined;
  return {
    q: stringValue('q', 100),
    category: enumValue(search.category, PRODUCT_CATEGORIES),
    location: stringValue('location', 100),
    producerId:
      typeof search.producerId === 'string' &&
      /^[a-f\d]{24}$/i.test(search.producerId)
        ? search.producerId
        : undefined,
    season: enumValue(search.season, PRODUCT_SEASONS),
    productionMethod: enumValue(search.productionMethod, PRODUCTION_METHODS),
    minPriceCents:
      search.minPriceCents === undefined
        ? undefined
        : numberValue(search.minPriceCents, 0, 10_000_000),
    maxPriceCents:
      search.maxPriceCents === undefined
        ? undefined
        : numberValue(search.maxPriceCents, 0, 10_000_000),
    sort: enumValue(search.sort, sorts) ?? 'newest',
    page: numberValue(search.page, 1, 1000) ?? 1,
  };
}
const auctionStates = ['upcoming', 'active', 'finished'] as const;
function validateAuctionSearch(search: Record<string, unknown>) {
  const state = enumValue(search.state, auctionStates);
  const producerId =
    typeof search.producerId === 'string' &&
    /^[a-f\d]{24}$/i.test(search.producerId)
      ? search.producerId
      : undefined;
  return {
    page: numberValue(search.page, 1, 1000) ?? 1,
    ...(state ? { state } : {}),
    ...(producerId ? { producerId } : {}),
  };
}
const root = createRootRoute({
  component: Shell,
  errorComponent: ({ reset }) => (
    <main role="alert" className="p-8">
      <p>Something went wrong. Please try again.</p>
      <button
        onClick={() => {
          void router.invalidate();
          reset();
        }}
      >
        Try again
      </button>
    </main>
  ),
  beforeLoad: async ({ location }) => {
    // An unreachable or failing session endpoint means "no session": render
    // as a guest (protected routes go to sign-in) instead of a dead-end page.
    const user = await queryClient.fetchQuery(sessionOptions).catch(() => null);
    const access = routeAccess(location.pathname, user);
    if (access === 'home') throw redirect({ to: '/', replace: true });
    if (access === 'login')
      throw redirect({
        to: '/login',
        search: { returnTo: location.href },
        replace: true,
      });
  },
});
const index = createRoute({
  getParentRoute: () => root,
  path: '/',
  component: HomePage,
});
const productsRoute = createRoute({
  getParentRoute: () => root,
  path: '/products',
  validateSearch: validateCatalogueSearch,
  // Keep the default view's URL clean: drop values that match the defaults.
  search: {
    middlewares: [stripSearchParams({ sort: 'newest', page: 1 })],
  },
  component: ProductsPage,
});
const productRoute = createRoute({
  getParentRoute: () => root,
  path: '/product/$productId',
  component: ProductDetailRoute,
});
const cartRoute = createRoute({
  getParentRoute: () => root,
  path: '/cart',
  component: CartPage,
});
const checkoutRoute = createRoute({
  getParentRoute: () => root,
  path: '/checkout',
  component: CheckoutPage,
});
const notificationRoute = createRoute({
  getParentRoute: () => root,
  path: '/notifications',
  component: NotificationPage,
});
const buyerOrdersRoute = createRoute({
  getParentRoute: () => root,
  path: '/orders',
  validateSearch: validateOrdersSearch,
  component: () => <OrderTrackingPage audience="buyer" />,
});
const buyerOrderDetailRoute = createRoute({
  getParentRoute: () => root,
  path: '/orders/$orderId',
  validateSearch: validateOrdersSearch,
  component: () => <OrderTrackingPage audience="buyer" />,
});
const producerOrdersRoute = createRoute({
  getParentRoute: () => root,
  path: '/producer/orders',
  validateSearch: validateOrdersSearch,
  component: () => <OrderTrackingPage audience="producer" />,
});
const producerOrderDetailRoute = createRoute({
  getParentRoute: () => root,
  path: '/producer/orders/$orderId',
  validateSearch: validateOrdersSearch,
  component: () => <OrderTrackingPage audience="producer" />,
});
const publicProducerRoute = createRoute({
  getParentRoute: () => root,
  path: '/farm/$producerId',
  component: ProducerDetailRoute,
});
const auctionsRoute = createRoute({
  getParentRoute: () => root,
  path: '/auctions',
  validateSearch: validateAuctionSearch,
  component: AuctionsPage,
});
const auctionRoomRoute = createRoute({
  getParentRoute: () => root,
  path: '/auctions/$auctionId',
  component: AuctionRoomRoute,
});
const uiDesign = createRoute({
  getParentRoute: () => root,
  path: '/ui-design',
  component: UIDesignPage,
});
const loginRoute = createRoute({
  getParentRoute: () => root,
  path: '/login',
  validateSearch: (search: Record<string, unknown>): { returnTo?: string } => ({
    returnTo: safeReturn(search.returnTo),
  }),
  component: () => <AuthPage mode="login" />,
});
const registerRoute = createRoute({
  getParentRoute: () => root,
  path: '/register',
  validateSearch: (search: Record<string, unknown>): { returnTo?: string } => ({
    returnTo: safeReturn(search.returnTo),
  }),
  component: () => <AuthPage mode="register" />,
});
const account = createRoute({
  getParentRoute: () => root,
  path: '/account',
  component: Account,
});
const producer = createRoute({
  getParentRoute: () => root,
  path: '/producer',
  validateSearch: validateMetricsSearch,
  component: ProducerHome,
});
const producerSubroute = createRoute({
  getParentRoute: () => root,
  path: '/producer/$',
  validateSearch: validateMetricsSearch,
  component: ProducerHome,
});
const producerProductsRoute = createRoute({
  getParentRoute: () => root,
  path: '/producer/products',
  component: ProducerHome,
});
const producerProductRoute = createRoute({
  getParentRoute: () => root,
  path: '/producer/products/$productId/edit',
  component: ProducerHome,
});
const producerNewProductRoute = createRoute({
  getParentRoute: () => root,
  path: '/producer/products/new',
  component: ProducerHome,
});
const producerAuctionsRoute = createRoute({
  getParentRoute: () => root,
  path: '/producer/auctions',
  component: () => <ProducerAuctions />,
});
const producerNewAuctionRoute = createRoute({
  getParentRoute: () => root,
  path: '/producer/auctions/new',
  component: () => <ProducerAuctions />,
});
const producerAuctionRoute = createRoute({
  getParentRoute: () => root,
  path: '/producer/auctions/$auctionId',
  component: () => <ProducerAuctions />,
});
const producerEditAuctionRoute = createRoute({
  getParentRoute: () => root,
  path: '/producer/auctions/$auctionId/edit',
  component: () => <ProducerAuctions />,
});
export const router = createRouter({
  defaultPendingMs: 0,
  routeTree: root.addChildren([
    index,
    productsRoute,
    productRoute,
    cartRoute,
    checkoutRoute,
    notificationRoute,
    buyerOrdersRoute,
    buyerOrderDetailRoute,
    producerOrdersRoute,
    producerOrderDetailRoute,
    publicProducerRoute,
    auctionsRoute,
    auctionRoomRoute,
    uiDesign,
    loginRoute,
    registerRoute,
    account,
    producer,
    producerSubroute,
    producerProductsRoute,
    producerProductRoute,
    producerNewProductRoute,
    producerAuctionsRoute,
    producerNewAuctionRoute,
    producerAuctionRoute,
    producerEditAuctionRoute,
  ]),
});
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
