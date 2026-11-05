import type { IReviewItem } from '../models/Review.model';

/**
 * Service categories for reviews: "this review is about the boiler job", "this one
 * is about the EV charger". A widget can then show one service's reviews, or offer
 * buttons to switch between them.
 *
 * Classification is RULES, not a model. Each category is a list of words and
 * phrases; a review belongs to every category whose words appear in its text, in
 * the owner's reply, or in the service Google asked the reviewer to pick. A
 * review that names no service has no category: it is GENERAL feedback, and the
 * feed shows it under every category as well as under "All".
 *
 * Each business can have its own list (its 5 or 6 services, with its own words).
 * A business without one uses DEFAULT_SERVICES below.
 */
export interface ServiceCategory {
  /** Stable id, stored on each review and used in the widget's filter. a-z, 0-9, dashes. */
  key: string;
  /** What the button says. */
  label: string;
  /** Words and phrases that put a review in this category. Case does not matter. */
  keywords: string[];
}

export const CATEGORY_KEY = /^[a-z0-9][a-z0-9-]{0,39}$/;

/** The usual trades services. A business's own list replaces this, it never merges. */
export const DEFAULT_SERVICES: ServiceCategory[] = [
  {
    key: 'boiler',
    label: 'Boilers & heating',
    keywords: [
      'boiler', 'combi', 'central heating', 'heating system', 'new heating', 'radiator',
      'gas safe', 'boiler service', 'annual service', 'heating engineer', 'gas engineer',
      'power flush', 'powerflush', 'thermostat', 'landlord certificate', 'gas certificate',
      'cp12', 'worcester', 'vaillant', 'ideal logic', 'baxi', 'viessmann', 'glow worm',
    ],
  },
  {
    key: 'ac',
    label: 'Air conditioning',
    keywords: [
      'air con', 'aircon', 'air conditioning', 'air conditioner', 'a/c', 'ac unit',
      'split unit', 'split system', 'wall mounted unit', 'cooling system', 'cooling unit',
      'daikin', 'mitsubishi electric', 'fujitsu',
    ],
  },
  {
    key: 'ev',
    label: 'EV charging',
    keywords: [
      'ev charger', 'ev charging', 'ev point', 'ev charge', 'car charger', 'car charging',
      'electric vehicle', 'charging point', 'charge point', 'chargepoint', 'zappi', 'ohme',
      'pod point', 'podpoint', 'wallbox', 'hypervolt', 'myenergi', 'easee', 'tesla wall',
      'andersen',
    ],
  },
  {
    key: 'solar',
    label: 'Solar & battery',
    keywords: [
      'solar', 'pv', 'panels', 'battery storage', 'home battery', 'inverter', 'givenergy',
      'solaredge', 'powerwall', 'fox ess', 'sunsynk', 'enphase',
    ],
  },
  {
    key: 'heatpump',
    label: 'Heat pumps',
    keywords: [
      'heat pump', 'heatpump', 'ashp', 'air source', 'ground source', 'ecodan', 'altherma',
      'arotherm', 'boiler upgrade scheme', 'bus grant',
    ],
  },
  {
    key: 'plumbing',
    label: 'Plumbing & bathrooms',
    keywords: [
      'plumber', 'plumbing', 'leak', 'tap', 'toilet', 'bathroom', 'shower', 'pipe',
      'pipework', 'drain', 'blocked', 'cylinder', 'unvented', 'megaflo', 'hot water tank',
      'water tank', 'stopcock', 'immersion', 'burst', 'overflow', 'sink', 'wet room',
    ],
  },
  {
    key: 'electrical',
    label: 'Electrical',
    keywords: [
      'electrician', 'electrical', 'electrics', 'rewire', 'rewiring', 'fuse board',
      'fuseboard', 'consumer unit', 'socket', 'light fitting', 'downlight', 'spotlight',
      'eicr', 'electrical certificate', 'pat test', 'outdoor light', 'security light',
      'extractor fan',
    ],
  },
];

/** The business's own list, or the defaults when it has none. An empty list means none. */
export function servicesFor(business: { services?: ServiceCategory[] | null } | null | undefined): ServiceCategory[] {
  if (!business || business.services === undefined || business.services === null) return DEFAULT_SERVICES;
  return business.services;
}

/**
 * A short fingerprint of a category list. Stored on each review with its
 * categories, so when someone edits the words, only reviews tagged under the old
 * words are redone.
 */
export function rulesVersion(services: ServiceCategory[]): string {
  const canonical = services
    .map((s) => [s.key, [...s.keywords].map((k) => k.trim().toLowerCase()).sort()])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return fnv1a(JSON.stringify(canonical));
}

/** A short, stable hash of a string. Runs in the browser too, unlike node's crypto. */
function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/**
 * One pattern per category. A phrase matches with any spacing or dashes between
 * its words ("air con", "air-con", "aircon"), and the last word may take a plural
 * or verb ending ("leak", "leaks", "leaking"). Whole words only: "pv" must not
 * match inside "pvc".
 */
const patternCache = new WeakMap<ServiceCategory[], Map<string, RegExp>>();
function patternsFor(services: ServiceCategory[]): Map<string, RegExp> {
  let map = patternCache.get(services);
  if (map) return map;
  map = new Map();
  for (const s of services) {
    const alternatives = s.keywords
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean)
      .map((k) => k.split(/\s+/).map(escapeRegex).join('[\\s-]*'));
    if (alternatives.length === 0) continue;
    map.set(s.key, new RegExp(`(?<![a-z0-9])(?:${alternatives.join('|')})(?:s|es|ed|ing)?(?![a-z0-9])`, 'i'));
  }
  patternCache.set(services, map);
  return map;
}

/** Everything about a review that can name a service, as one lowercase string. */
export function classifiableText(review: Partial<IReviewItem> & { text?: string }): string {
  const parts: string[] = [];
  parts.push(review.content ?? review.text ?? '');
  if (review.ownerReply) parts.push(review.ownerReply);
  if (review.reviewContext && typeof review.reviewContext === 'object') {
    for (const v of Object.values(review.reviewContext)) {
      if (typeof v === 'string') parts.push(v);
      else if (Array.isArray(v)) parts.push(v.filter((x) => typeof x === 'string').join(' '));
    }
  }
  if (Array.isArray(review.tags)) parts.push(review.tags.filter((t) => typeof t === 'string').join(' '));
  return parts.join('\n').toLowerCase();
}

/** The keys of every category whose words appear in the review. Empty = general. */
export function classifyReview(review: Partial<IReviewItem> & { text?: string }, services: ServiceCategory[]): string[] {
  const text = classifiableText(review);
  if (!text.trim()) return [];
  const out: string[] = [];
  for (const [key, re] of patternsFor(services)) {
    if (re.test(text)) out.push(key);
  }
  return out;
}

export const sameCategories = (a: string[] | undefined, b: string[]): boolean =>
  (a ?? []).length === b.length && (a ?? []).every((k, i) => k === b[i]);

/**
 * A category list as sent by the Edit Business dialog, checked and tidied. Returns
 * a message instead of a list when something is wrong.
 */
export function parseServices(input: unknown): { services: ServiceCategory[] } | { error: string } {
  if (!Array.isArray(input)) return { error: 'Services must be a list.' };
  if (input.length > 20) return { error: 'At most 20 services.' };
  const seen = new Set<string>();
  const services: ServiceCategory[] = [];
  for (const item of input) {
    const o = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const key = String(o.key ?? '').trim().toLowerCase();
    const label = String(o.label ?? '').trim();
    if (!CATEGORY_KEY.test(key)) return { error: `"${key || label}" needs an id of letters, numbers and dashes.` };
    if (seen.has(key)) return { error: `"${key}" is listed twice.` };
    if (!label || label.length > 40) return { error: `"${key}" needs a label of up to 40 characters.` };
    const rawKeywords = Array.isArray(o.keywords) ? o.keywords : typeof o.keywords === 'string' ? o.keywords.split(/[,\n]/) : [];
    const keywords = [...new Set(rawKeywords.map((k) => String(k).trim().toLowerCase()).filter((k) => k.length > 0 && k.length <= 60))];
    if (keywords.length > 200) return { error: `"${label}" has too many words; keep it under 200.` };
    seen.add(key);
    services.push({ key, label, keywords });
  }
  return { services };
}

/** Category keys from a `?category=boiler,ev` style parameter: tidy, unique, at most ten. */
export function parseCategoryParam(raw: unknown): string[] {
  const value = Array.isArray(raw) ? raw.join(',') : typeof raw === 'string' ? raw : '';
  const keys = value.split(',').map((k) => k.trim().toLowerCase()).filter((k) => CATEGORY_KEY.test(k));
  return [...new Set(keys)].slice(0, 10);
}
