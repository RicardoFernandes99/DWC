import { safeReturn } from './safe-return';
import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { Shell, AuthPage, Account } from './pages';
import { UIDesignPage } from './pages/ui-design';
import { CartPage } from './features/cart/components/cart-page';
import {
  CataloguePage,
  ProductDetailRoute,
  ProducerDetailRoute,
  type SearchState,
} from './features/catalogue/catalogue';
import {
  PRODUCT_CATEGORIES,
  PRODUCT_SEASONS,
  PRODUCTION_METHODS,
} from './lib/format';

const sorts = ['newest', 'price_asc', 'price_desc', 'name_asc'] as const;
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
const root = createRootRoute({ component: Shell });
const index = createRoute({
  getParentRoute: () => root,
  path: '/',
  validateSearch: validateCatalogueSearch,
  component: CataloguePage,
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
const publicProducerRoute = createRoute({
  getParentRoute: () => root,
  path: '/farm/$producerId',
  validateSearch: validateCatalogueSearch,
  component: ProducerDetailRoute,
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
  component: Account,
});
const producerSubroute = createRoute({
  getParentRoute: () => root,
  path: '/producer/$',
  component: Account,
});
const producerProductRoute = createRoute({
  getParentRoute: () => root,
  path: '/producer/products/$productId/edit',
  component: Account,
});
const producerNewProductRoute = createRoute({
  getParentRoute: () => root,
  path: '/producer/products/new',
  component: Account,
});
export const router = createRouter({
  routeTree: root.addChildren([
    index,
    productRoute,
    cartRoute,
    publicProducerRoute,
    uiDesign,
    loginRoute,
    registerRoute,
    account,
    producer,
    producerSubroute,
    producerProductRoute,
    producerNewProductRoute,
  ]),
});
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
