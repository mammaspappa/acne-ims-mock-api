export function filterItems<T extends object>(
  items: T[],
  filters: Record<string, unknown>
): T[] {
  return items.filter((item) => {
    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null || value === '') continue;
      const itemValue = (item as Record<string, unknown>)[key];
      if (itemValue === undefined) return false;

      if (Array.isArray(value)) {
        if (!value.includes(itemValue)) return false;
      } else if (typeof value === 'string' && typeof itemValue === 'string') {
        if (!itemValue.toLowerCase().includes(value.toLowerCase())) return false;
      } else if (itemValue !== value) {
        return false;
      }
    }
    return true;
  });
}

export function sortItems<T>(
  items: T[],
  sortBy: string,
  order: 'asc' | 'desc' = 'asc'
): T[] {
  return [...items].sort((a, b) => {
    const aVal = (a as Record<string, unknown>)[sortBy];
    const bVal = (b as Record<string, unknown>)[sortBy];

    if (aVal === bVal) return 0;
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    const comparison = aVal < bVal ? -1 : 1;
    return order === 'desc' ? -comparison : comparison;
  });
}
