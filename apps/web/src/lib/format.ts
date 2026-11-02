import type { components } from './api-schema';

type Product = components['schemas']['CatalogueProductDto'];

const euroFormatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'EUR',
});

export const PRODUCT_CATEGORIES: readonly Product['category'][] = [
  'vegetables',
  'fruits',
  'dairy',
  'eggs',
  'meat',
  'bakery',
  'pantry',
  'beverages',
  'other',
];

export const PRODUCT_SEASONS: readonly Product['seasons'][number][] = [
  'spring',
  'summer',
  'autumn',
  'winter',
  'year_round',
];

export const PRODUCTION_METHODS: readonly Product['productionMethod'][] = [
  'organic',
  'sustainable',
  'conventional',
  'artisanal',
  'biodynamic',
];

export const PRODUCT_UNITS: readonly Product['unit'][] = [
  'unit',
  'bunch',
  'box',
  'jar',
  'bottle',
  'bag',
  'kg',
  'g_500',
  'g_250',
  'l',
  'ml_500',
];

export function formatMoney(cents: number): string {
  return euroFormatter.format(cents / 100);
}

export function formatLabel(value: string): string {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
