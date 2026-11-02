import { beforeEach, describe, expect, it } from 'vitest';
import {
  CART_STORAGE_KEY,
  loadCart,
  parseStoredCart,
  saveCart,
  type StoredCart,
} from './cart-storage';

describe('cart storage and validation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('safely handles empty or null storage', () => {
    expect(parseStoredCart(null)).toEqual({ version: 1, items: [] });
    expect(parseStoredCart('')).toEqual({ version: 1, items: [] });
    expect(parseStoredCart('   ')).toEqual({ version: 1, items: [] });
  });

  it('never crashes on invalid or malformed JSON', () => {
    expect(parseStoredCart('{not-valid-json')).toEqual({
      version: 1,
      items: [],
    });
    expect(parseStoredCart('12345')).toEqual({ version: 1, items: [] });
    expect(parseStoredCart('"string"')).toEqual({ version: 1, items: [] });
    expect(parseStoredCart('[]')).toEqual({ version: 1, items: [] });
    expect(parseStoredCart('{"version": 1, "items": null}')).toEqual({
      version: 1,
      items: [],
    });
  });

  it('rejects invalid product IDs and non-integer or negative quantities', () => {
    const raw = JSON.stringify({
      version: 1,
      items: [
        { productId: '', quantity: 1 },
        { productId: 'not-an-id', quantity: 2 },
        { productId: '64b1f2e4c9e77a1b2c3d4e5f', quantity: -3 },
        { productId: '64b1f2e4c9e77a1b2c3d4e5f', quantity: 0 },
        { productId: '64b1f2e4c9e77a1b2c3d4e5f', quantity: 2.5 },
        { productId: '64b1f2e4c9e77a1b2c3d4e5f', quantity: 'many' },
        { productId: '64b1f2e4c9e77a1b2c3d4e50', quantity: 3 },
      ],
    });

    const parsed = parseStoredCart(raw);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].productId).toBe('64b1f2e4c9e77a1b2c3d4e50');
    expect(parsed.items[0].quantity).toBe(3);
  });

  it('deduplicates items with identical product IDs by summing quantities', () => {
    const validId = '64b1f2e4c9e77a1b2c3d4e5f';
    const raw = JSON.stringify({
      version: 1,
      items: [
        { productId: validId, quantity: 2, name: 'Fresh Apples' },
        { productId: validId, quantity: 3, name: 'Fresh Apples' },
      ],
    });

    const parsed = parseStoredCart(raw);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].productId).toBe(validId);
    expect(parsed.items[0].quantity).toBe(5);
  });

  it('bounds item quantities to 999 and bounds cart length to 50 items', () => {
    const validId = '64b1f2e4c9e77a1b2c3d4e5f';
    const raw = JSON.stringify({
      version: 1,
      items: [{ productId: validId, quantity: 999999 }],
    });

    const parsed = parseStoredCart(raw);
    expect(parsed.items[0].quantity).toBe(999);

    // 60 distinct items
    const manyItems = Array.from({ length: 60 }, (_, i) => ({
      productId: `64b1f2e4c9e77a1b2c3d4e${i.toString(16).padStart(2, '0')}`,
      quantity: 1,
    }));
    const capped = parseStoredCart(
      JSON.stringify({ version: 1, items: manyItems }),
    );
    expect(capped.items).toHaveLength(50);
  });

  it('persists and restores cart correctly via loadCart and saveCart', () => {
    const validId1 = '64b1f2e4c9e77a1b2c3d4e01';
    const validId2 = '64b1f2e4c9e77a1b2c3d4e02';

    const cart: StoredCart = {
      version: 1,
      items: [
        {
          productId: validId1,
          quantity: 2,
          producerId: '64b1f2e4c9e77a1b2c3d4aaa',
          producerFarmName: 'Green Valley',
          name: 'Carrots',
          priceCents: 250,
          unit: 'kg',
        },
        {
          productId: validId2,
          quantity: 1,
          producerId: '64b1f2e4c9e77a1b2c3d4bbb',
          producerFarmName: 'Sunny Orchard',
          name: 'Pears',
          priceCents: 400,
          unit: 'box',
        },
      ],
    };

    saveCart(cart);
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBeTruthy();

    const loaded = loadCart();
    expect(loaded.items).toHaveLength(2);
    expect(loaded.items[0].name).toBe('Carrots');
    expect(loaded.items[0].quantity).toBe(2);
    expect(loaded.items[1].name).toBe('Pears');
    expect(loaded.items[1].quantity).toBe(1);
  });
});
