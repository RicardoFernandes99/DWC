import { useQueries } from '@tanstack/react-query';
import type { components } from '@/lib/api-schema';
import { publicRequest } from '@/lib/session';
import { useCart } from './use-cart';
import type { StoredCartItem } from './cart-storage';

export type CatalogueProduct = components['schemas']['CatalogueProductDto'];

export type CartLineStatus =
  'loading' | 'available' | 'insufficient_stock' | 'sold_out' | 'unavailable';

export interface HydratedCartLine {
  item: StoredCartItem;
  product: CatalogueProduct | null;
  status: CartLineStatus;
  statusMessage?: string;
  unitPriceCents: number;
  lineTotalCents: number;
  availableStock: number;
}

export interface ProducerCartGroup {
  producerId: string;
  producerFarmName: string;
  producerCity: string;
  lines: HydratedCartLine[];
  subtotalCents: number;
  hasIssues: boolean;
}

export interface HydratedCart {
  items: StoredCartItem[];
  lines: HydratedCartLine[];
  producerGroups: ProducerCartGroup[];
  subtotalCents: number;
  totalItemCount: number;
  isLoading: boolean;
  hasAnyIssues: boolean;
  isEmpty: boolean;
  addItem: ReturnType<typeof useCart>['addItem'];
  updateQuantity: ReturnType<typeof useCart>['updateQuantity'];
  removeItem: ReturnType<typeof useCart>['removeItem'];
  clearCart: ReturnType<typeof useCart>['clearCart'];
}

export function useHydratedCart(): HydratedCart {
  const {
    items,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    totalItemCount,
  } = useCart();

  const queries = useQueries({
    queries: items.map((item) => ({
      queryKey: ['cart', 'product', item.productId],
      queryFn: () =>
        publicRequest<CatalogueProduct>(`products/${item.productId}`),
      staleTime: 30_000,
      retry: false,
    })),
  });

  const lines: HydratedCartLine[] = items.map((item, index) => {
    const query = queries[index];
    const product = query?.data ?? null;
    const isPending = query?.isPending && !product;
    const isError = query?.isError;

    let status: CartLineStatus = 'available';
    let statusMessage: string | undefined;

    if (isPending) {
      status = 'loading';
    } else if (isError || !product) {
      status = 'unavailable';
      statusMessage = 'Product no longer available or producer is inactive.';
    } else if (product.availableStock <= 0) {
      status = 'sold_out';
      statusMessage = 'Sold out';
    } else if (item.quantity > product.availableStock) {
      status = 'insufficient_stock';
      statusMessage = `Only ${product.availableStock} available`;
    }

    const availableStock = product?.availableStock ?? 0;
    const unitPriceCents = product?.priceCents ?? item.priceCents ?? 0;
    const lineTotalCents = unitPriceCents * item.quantity;

    return {
      item,
      product,
      status,
      statusMessage,
      unitPriceCents,
      lineTotalCents,
      availableStock,
    };
  });

  // Group lines by producer
  const groupMap = new Map<string, ProducerCartGroup>();

  for (const line of lines) {
    const producerId =
      line.product?.producerId ?? line.item.producerId ?? 'unknown-producer';
    const producerFarmName =
      line.product?.producerFarmName ??
      line.item.producerFarmName ??
      'Local Farm';
    const producerCity =
      line.product?.producerCity ?? line.item.producerCity ?? '';

    let group = groupMap.get(producerId);
    if (!group) {
      group = {
        producerId,
        producerFarmName,
        producerCity,
        lines: [],
        subtotalCents: 0,
        hasIssues: false,
      };
      groupMap.set(producerId, group);
    }

    group.lines.push(line);
    if (line.status === 'available') {
      group.subtotalCents += line.lineTotalCents;
    }
    if (line.status !== 'available' && line.status !== 'loading') {
      group.hasIssues = true;
    }
  }

  const producerGroups = Array.from(groupMap.values());
  const subtotalCents = producerGroups.reduce(
    (sum, group) => sum + group.subtotalCents,
    0,
  );
  const isLoading = queries.some((q) => q.isPending);
  const hasAnyIssues = lines.some(
    (line) => line.status !== 'available' && line.status !== 'loading',
  );

  return {
    items,
    lines,
    producerGroups,
    subtotalCents,
    totalItemCount,
    isLoading,
    hasAnyIssues,
    isEmpty: items.length === 0,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
  };
}
