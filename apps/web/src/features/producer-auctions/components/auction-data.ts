import type { components } from '@/lib/api-schema';
import { ApiError, authenticatedRequest } from '@/lib/session';

export type Auction = components['schemas']['AuctionResponseDto'];
export type Product = components['schemas']['ProducerProductResponseDto'];
export type ProductList =
  components['schemas']['ProducerProductListResponseDto'];

export const auctionListKey = ['producer-auctions'] as const;
export const auctionKey = (id: string) => ['producer-auction', id] as const;
export const producerProductListKey = ['producer-products'] as const;
export const producerProductKey = (id: string) =>
  [...producerProductListKey, id] as const;

export function fetchAuction(id: string) {
  if (!/^[a-f\d]{24}$/i.test(id))
    return Promise.reject(
      new ApiError(400, 'This auction identifier is invalid.'),
    );
  return authenticatedRequest<Auction>(
    `producer/auctions/${encodeURIComponent(id)}`,
  );
}

export function fetchProducerProduct(id: string) {
  return authenticatedRequest<Product>(
    `producer/products/${encodeURIComponent(id)}`,
  );
}

export async function fetchProducerProducts() {
  const first = await authenticatedRequest<ProductList>(
    'producer/products?page=1&limit=50',
  );
  const pageCount = Math.min(Math.ceil(first.total / first.limit), 1000);
  if (pageCount <= 1) return first;
  const remaining: ProductList[] = [];
  for (let start = 2; start <= pageCount; start += 10) {
    const pages = await Promise.all(
      Array.from({ length: Math.min(10, pageCount - start + 1) }, (_, index) =>
        authenticatedRequest<ProductList>(
          `producer/products?page=${start + index}&limit=50`,
        ),
      ),
    );
    remaining.push(...pages);
  }
  return {
    ...first,
    items: [...first.items, ...remaining.flatMap((page) => page.items)],
  };
}
