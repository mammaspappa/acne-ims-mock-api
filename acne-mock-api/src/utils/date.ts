import type { Season } from '../store/types.js';

let mockNow: Date | null = null;

export function setMockNow(date: Date | null): void {
  mockNow = date;
}

export function now(): Date {
  return mockNow ? new Date(mockNow.getTime()) : new Date();
}

export function daysAgo(days: number): Date {
  const d = now();
  d.setDate(d.getDate() - days);
  return d;
}

export function daysFromNow(days: number): Date {
  const d = now();
  d.setDate(d.getDate() + days);
  return d;
}

export function weeksAgo(weeks: number): Date {
  return daysAgo(weeks * 7);
}

export function getCurrentSeason(): { season: Season; year: number } {
  const d = now();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();

  if (month >= 1 && month <= 2) return { season: 'AW', year: year - 1 };
  if (month >= 3 && month <= 5) return { season: 'SS', year };
  if (month >= 6 && month <= 8) return { season: 'SS', year };
  if (month >= 9 && month <= 10) return { season: 'AW', year };
  return { season: 'AW', year };
}

export function formatDate(date: Date): string {
  return date.toISOString();
}
