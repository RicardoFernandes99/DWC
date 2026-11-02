import { useNavigate, useSearch } from '@tanstack/react-router';
import type { components } from '@/lib/api-schema';

type Product = components['schemas']['CatalogueProductDto'];

export type PublicProducer = Omit<
  components['schemas']['ProducerPublicDto'],
  'latitude' | 'longitude'
> & {
  latitude?: number;
  longitude?: number;
};

export type SearchState = {
  q?: string;
  category?: Product['category'];
  producerId?: string;
  location?: string;
  season?: Product['seasons'][number];
  productionMethod?: Product['productionMethod'];
  minPriceCents?: number;
  maxPriceCents?: number;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'name_asc';
  page?: number;
};

export const producerKey = (id: string) =>
  ['catalogue', 'producer', id] as const;

export function useListingSearch(scope: string) {
  const rawSearch = useSearch({ strict: false }) as SearchState;
  const search = {
    ...rawSearch,
    sort: rawSearch.sort ?? 'newest',
    page: rawSearch.page ?? 1,
  };
  const navigate = useNavigate({
    from: scope === 'all' ? '/' : '/farm/$producerId',
  });
  function update(values: Partial<SearchState>) {
    void navigate({
      search: (previous) => ({
        ...previous,
        ...values,
        page: values.page ?? 1,
      }),
    });
  }
  return { search, update };
}
