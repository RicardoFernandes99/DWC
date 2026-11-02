import { describe, expect, it } from 'vitest';
import { routeAccess, canPurchase } from './route-access';
import { safeReturn } from './safe-return';
import type { User } from './lib/session';

const buyer: User = {
  id: 'buyer',
  name: 'Buyer',
  email: 'buyer@example.com',
  role: 'buyer',
  producerStatus: null,
  producerRejectionReason: null,
};
const producer: User = {
  ...buyer,
  id: 'producer',
  role: 'producer',
  producerStatus: 'approved',
};

describe('route access policy', () => {
  it('keeps browsing and guest cart public, and preserves protected sign-in flow', () => {
    for (const path of ['/', '/product/123', '/farm/123', '/cart'])
      expect(routeAccess(path, null)).toBe('allow');
    for (const path of [
      '/checkout',
      '/orders/123',
      '/producer/orders',
      '/account',
    ])
      expect(routeAccess(path, null)).toBe('login');
  });
  it('redirects wrong roles and signed-in authentication routes home', () => {
    for (const path of ['/cart', '/checkout', '/orders', '/orders/123'])
      expect(routeAccess(path, producer)).toBe('home');
    for (const path of [
      '/producer',
      '/producer/products/new',
      '/producer/orders/123',
    ])
      expect(routeAccess(path, buyer)).toBe('home');
    for (const user of [buyer, producer])
      for (const path of ['/login', '/register/'])
        expect(routeAccess(path, user)).toBe('home');
    expect(canPurchase(producer)).toBe(false);
    expect(canPurchase(null)).toBe(true);
    expect(canPurchase(buyer)).toBe(true);
  });
  it('retains suspended producer order access', () => {
    expect(
      routeAccess('/producer/orders/123', {
        ...producer,
        producerStatus: 'suspended',
      }),
    ).toBe('allow');
  });
  it('rejects unsafe or role-incompatible return destinations', () => {
    for (const path of [
      'https://example.com',
      '//example.com',
      '/\\example.com',
      '/login',
      '/register',
      '/producer/orders',
    ])
      expect(safeReturn(path, buyer)).toBeUndefined();
    expect(safeReturn('/checkout', producer)).toBeUndefined();
    expect(safeReturn('/orders?page=2', buyer)).toBe('/orders?page=2');
  });
});
