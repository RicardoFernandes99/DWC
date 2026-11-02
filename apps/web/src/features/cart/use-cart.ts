import { useSyncExternalStore } from 'react';
import type { components } from '@/lib/api-schema';
import {
  CART_EVENT_NAME,
  CART_STORAGE_KEY,
  loadCart,
  parseStoredCart,
  saveCart,
  type StoredCart,
  type StoredCartItem,
} from './cart-storage';

type CatalogueProduct = components['schemas']['CatalogueProductDto'];

let lastRaw: string | null = null;
let lastParsed: StoredCart = { version: 1, items: [] };

function subscribe(callback: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === CART_STORAGE_KEY) {
      callback();
    }
  };
  const onCartChange = () => {
    callback();
  };

  window.addEventListener('storage', onStorage);
  window.addEventListener(CART_EVENT_NAME, onCartChange);

  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(CART_EVENT_NAME, onCartChange);
  };
}

function getSnapshot(): StoredCart {
  if (typeof window === 'undefined' || !window.localStorage) {
    return SERVER_SNAPSHOT;
  }
  const raw = window.localStorage.getItem(CART_STORAGE_KEY);
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastParsed = parseStoredCart(raw);
  }
  return lastParsed;
}

const SERVER_SNAPSHOT: StoredCart = { version: 1, items: [] };
function getServerSnapshot(): StoredCart {
  return SERVER_SNAPSHOT;
}

export function useCart() {
  const cart = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const addItem = (product: CatalogueProduct, quantity = 1) => {
    if (quantity < 1) return;
    const current = loadCart();
    const existingIndex = current.items.findIndex(
      (item) => item.productId === product.id,
    );

    if (existingIndex >= 0) {
      const nextQuantity = Math.min(
        current.items[existingIndex].quantity + quantity,
        product.availableStock > 0 ? product.availableStock : 999,
      );
      current.items[existingIndex] = {
        ...current.items[existingIndex],
        quantity: nextQuantity,
        name: product.name,
        priceCents: product.priceCents,
        unit: product.unit,
        producerId: product.producerId,
        producerFarmName: product.producerFarmName,
        producerCity: product.producerCity,
        imageUrl: product.imageUrl,
      };
    } else {
      const newItem: StoredCartItem = {
        productId: product.id,
        quantity: Math.min(
          quantity,
          product.availableStock > 0 ? product.availableStock : 999,
        ),
        producerId: product.producerId,
        producerFarmName: product.producerFarmName,
        producerCity: product.producerCity,
        name: product.name,
        priceCents: product.priceCents,
        unit: product.unit,
        imageUrl: product.imageUrl,
      };
      current.items.push(newItem);
    }

    saveCart(current);
  };

  const updateQuantity = (productId: string, quantity: number) => {
    const current = loadCart();
    if (quantity <= 0) {
      current.items = current.items.filter(
        (item) => item.productId !== productId,
      );
    } else {
      const index = current.items.findIndex(
        (item) => item.productId === productId,
      );
      if (index >= 0) {
        current.items[index].quantity = Math.min(Math.floor(quantity), 999);
      }
    }
    saveCart(current);
  };

  const removeItem = (productId: string) => {
    const current = loadCart();
    current.items = current.items.filter(
      (item) => item.productId !== productId,
    );
    saveCart(current);
  };

  const removeItems = (productIds: string[]) => {
    const idSet = new Set(productIds);
    const current = loadCart();
    current.items = current.items.filter((item) => !idSet.has(item.productId));
    saveCart(current);
  };

  const clearCart = () => {
    saveCart({ version: 1, items: [] });
  };

  const totalItemCount = cart.items.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

  return {
    items: cart.items,
    addItem,
    updateQuantity,
    removeItem,
    removeItems,
    clearCart,
    totalItemCount,
  };
}
