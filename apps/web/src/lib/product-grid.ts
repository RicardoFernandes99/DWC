/** `sidebar` drops a column at each range to leave room for the filter panel. */
export const productGridColumns = {
  default: 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4',
  sidebar: 'grid-cols-2 md:grid-cols-2 xl:grid-cols-3',
} as const;
