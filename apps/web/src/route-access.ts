import type { User } from './lib/session';

export function routeAccess(pathname: string, user: User | null) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/login' || path === '/register') return user ? 'home' : 'allow';
  const producer = path === '/producer' || path.startsWith('/producer/');
  const buyer =
    path === '/checkout' || path === '/orders' || path.startsWith('/orders/');
  if (path === '/cart')
    return !user || user.role === 'buyer' ? 'allow' : 'home';
  if (producer || buyer || path === '/account') {
    if (!user) return 'login';
    if (producer && user.role !== 'producer') return 'home';
    if (buyer && user.role !== 'buyer') return 'home';
  }
  return 'allow';
}

export function canPurchase(user: User | null | undefined) {
  return user === null || user?.role === 'buyer';
}
