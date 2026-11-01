import { safeReturn } from './safe-return';
import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { App } from '@/app';
import { Shell, AuthPage, Account } from './pages';
const root = createRootRoute({ component: Shell });
const index = createRoute({
  getParentRoute: () => root,
  path: '/',
  component: App,
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
export const router = createRouter({
  routeTree: root.addChildren([
    index,
    loginRoute,
    registerRoute,
    account,
    producer,
  ]),
});
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
