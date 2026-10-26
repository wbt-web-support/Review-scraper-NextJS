/**
 * The Text layout's rules, for the widget editor: its live sample and the text
 * written into the embed snippet before the numbers load. public/widget-text.js
 * applies the same rules on the client's page (it cannot import this file), so a
 * change here must be made there too.
 */

export type TextSource = 'google' | 'facebook';

export const DEFAULT_TEXT: Record<TextSource, string> = {
  google: 'Over {count}+ {rating}★ Google Reviews',
  facebook: 'Over {count}+ Facebook reviews, {rating} recommend',
};

/** Rounded DOWN, so it is never overstated: under 100 to tens, under 1,000 to fifties, then hundreds. */
export function tidyCount(n: number): number {
  if (n < 10) return n;
  const step = n < 100 ? 10 : n < 1000 ? 50 : 100;
  return Math.floor(n / step) * step;
}

/** The real average to one decimal (a 5.0 reads 5); Facebook's is the share who recommend. */
export function formatRating(value: unknown, source: TextSource): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (source === 'facebook') {
    const text = String(value);
    return text.includes('%') ? text : `${text}%`;
  }
  const n = parseFloat(String(value));
  if (Number.isNaN(n)) return null;
  const fixed = n.toFixed(1);
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
}

/** The line as it reads on the page, or null when there are no reviews to quote yet. */
export function renderText(
  template: string,
  { count, rating, source }: { count: number | null; rating: unknown; source: TextSource },
): string | null {
  if (!count) return null;
  return template
    .replace(/\{count\}/g, tidyCount(count).toLocaleString('en-GB'))
    .replace(/\{rating\}/g, formatRating(rating, source) ?? '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
