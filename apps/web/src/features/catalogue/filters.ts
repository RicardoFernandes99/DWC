import type { SearchState } from './use-listing-search';

export const clearedFilters: Partial<SearchState> = {
  q: undefined,
  category: undefined,
  producerId: undefined,
  location: undefined,
  season: undefined,
  productionMethod: undefined,
  minPriceCents: undefined,
  maxPriceCents: undefined,
};

export function activeFilterCount(search: SearchState) {
  return [
    search.category,
    search.producerId,
    search.location,
    search.season,
    search.productionMethod,
    search.minPriceCents ?? search.maxPriceCents,
  ].filter((value) => value !== undefined && value !== '').length;
}
