/**
 * Normalizes a search query by removing all whitespace characters.
 */
export const normalizeSearchQuery = (query: string): string => {
  if (!query) return '';
  return query.replace(/\s/g, '');
};
