import type { components } from '@/lib/api-schema';

export type ProductUnit = components['schemas']['CatalogueProductDto']['unit'];

export interface StoredCartItem {
  productId: string;
  quantity: number;
  producerId?: string;
  producerFarmName?: string;
  producerCity?: string;
  name?: string;
  priceCents?: number;
  unit?: ProductUnit;
  imageUrl?: string | null;
}

export interface StoredCart {
  version: 1;
  items: StoredCartItem[];
}

export const CART_STORAGE_KEY = 'dwc_cart_v1';
export const CART_EVENT_NAME = 'dwc:cart-change';

const MAX_ITEMS = 50;
const MAX_ITEM_QUANTITY = 999;
const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

export function parseStoredCart(raw: string | null): StoredCart {
  if (!raw) return { version: 1, items: [] };

  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return { version: 1, items: [] };

    const rawItems = Array.isArray(data.items) ? data.items : [];
    const itemMap = new Map<string, StoredCartItem>();

    for (const item of rawItems) {
      if (!item || typeof item !== 'object') continue;
      const rawId = item.productId;
      if (typeof rawId !== 'string' || !OBJECT_ID_REGEX.test(rawId.trim())) {
        continue;
      }
      const productId = rawId.trim();

      const rawQuantity = Number(item.quantity);
      if (!Number.isInteger(rawQuantity) || rawQuantity < 1) {
        continue;
      }
      const quantity = Math.min(rawQuantity, MAX_ITEM_QUANTITY);

      const existing = itemMap.get(productId);
      if (existing) {
        existing.quantity = Math.min(
          existing.quantity + quantity,
          MAX_ITEM_QUANTITY,
        );
      } else {
        if (itemMap.size >= MAX_ITEMS) break;
        itemMap.set(productId, {
          productId,
          quantity,
          producerId:
            typeof item.producerId === 'string' ? item.producerId : undefined,
          producerFarmName:
            typeof item.producerFarmName === 'string'
              ? item.producerFarmName
              : undefined,
          producerCity:
            typeof item.producerCity === 'string'
              ? item.producerCity
              : undefined,
          name: typeof item.name === 'string' ? item.name : undefined,
          priceCents:
            typeof item.priceCents === 'number' && item.priceCents >= 0
              ? item.priceCents
              : undefined,
          unit:
            typeof item.unit === 'string'
              ? (item.unit as ProductUnit)
              : undefined,
          imageUrl:
            typeof item.imageUrl === 'string' || item.imageUrl === null
              ? item.imageUrl
              : undefined,
        });
      }
    }

    return {
      version: 1,
      items: Array.from(itemMap.values()),
    };
  } catch {
    return { version: 1, items: [] };
  }
}

export function loadCart(): StoredCart {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { version: 1, items: [] };
  }
  try {
    return parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY));
  } catch {
    return { version: 1, items: [] };
  }
}

export function saveCart(cart: StoredCart): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent(CART_EVENT_NAME));
  } catch {
    // Gracefully handle storage quota or privacy mode errors
  }
}
