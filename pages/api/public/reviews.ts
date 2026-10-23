import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import dbConnect from '../../../lib/mongodb';
import * as storage from '../../../lib/storage';
import type { IReviewItem } from '../../../models/Review.model';

/** Older batches stored the review body as `text` rather than `content`. */
type StoredReview = IReviewItem & { text?: string };

/**
 * GET /api/public/reviews
 *
 *   curl -H "Authorization: Bearer rh_..." https://host/api/public/reviews
 *
 * Every review of ONE business, as JSON, for a client's own systems: their site's
 * backend, a CMS, a spreadsheet sync. The key is created per business from the
 * widget's Embed Code tab, so each client has their own and can have it rotated or
 * revoked without touching anyone else's.
 *
 * Security, in the order a request meets it:
 *
 *  - The key is the ONLY input that picks the business. There is no business id in
 *    the URL, so there is nothing a caller can edit to read another client's reviews.
 *  - Header only (`Authorization: Bearer` or `X-API-Key`), never the query string.
 *    URLs end up in server logs, proxy logs and browser history; headers do not.
 *  - Keys are 24 random bytes. Malformed ones are refused before any database work,
 *    and every bad key gets the same 401, so a caller learns nothing about why.
 *  - NO CORS HEADERS, deliberately. A browser calling this would have to ship the
 *    secret key to every visitor of the page. Without Access-Control-Allow-Origin
 *    the browser refuses to hand over the response, so that mistake fails loudly in
 *    development instead of quietly publishing the key. Call it server-to-server.
 *    The browser-safe feed is the widget itself.
 *  - `Cache-Control: private, no-store`, so no shared cache keeps one client's
 *    response for another caller.
 *
 * By default it returns everything: star-only reviews with no text included, which
 * the widgets leave out. Pass `limit` and `offset` to page, `minRating` to filter,
 * and `from` / `to` for a date range:
 *
 *   ?from=2026-01-01&to=2026-03-31     posted in Q1, both days included
 *   ?from=2026-10-01                    posted since 1 October
 *
 * A date range is read from what we already store, so it never triggers a crawl
 * and costs no Apify credits -- it just keeps the response to what the caller needs.
 * Reviews still stored with a "2 weeks ago" style date cannot be placed in a range
 * and are left out of ranged requests; the crawler replaces those with real dates
 * as it revisits each business.
 */

/**
 * Turns a `from` / `to` value into a bound in the stored format (ISO strings,
 * which compare as dates). Never throws: a bad value comes back as a message for
 * a 400.
 *
 * Accepted: a calendar day (2026-01-31), or a time WITH a zone
 * (2026-01-31T09:00:00Z, 2026-01-31T09:00+05:30). A time without a zone is refused
 * rather than guessed, since the answer would depend on the server's timezone.
 *
 * A day `from` starts at that day's first moment; a day `to` includes the whole
 * day, so its bound is the start of the next day.
 */
function parseDateParam(raw: string | undefined, name: 'from' | 'to'): { bound?: string; error?: string } {
  if (raw === undefined) return {};
  // An unencoded "+05:30" arrives as " 05:30".
  const v = raw.trim().replace(/ (\d{2}:?\d{2})$/, '+$1');
  const help = `Use a date like 2026-01-31, or a time with a zone like 2026-01-31T09:00:00Z, for ${name}.`;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2}))?$/.exec(v);
  if (!m) return { error: help };

  const [, y, mo, d, hh, mm, ss] = m;
  const day = new Date(Date.UTC(+y, +mo - 1, +d));
  const realDay = day.getUTCFullYear() === +y && day.getUTCMonth() === +mo - 1 && day.getUTCDate() === +d;
  if (!realDay) return { error: `${name} is not a real date.` };

  if (hh === undefined) {
    if (name === 'from') return { bound: v };
    day.setUTCDate(day.getUTCDate() + 1);
    return { bound: day.toISOString().slice(0, 10) };
  }
  if (+hh > 23 || +mm > 59 || (ss !== undefined && +ss > 59)) return { error: `${name} is not a real time.` };
  const ms = Date.parse(v);
  if (isNaN(ms)) return { error: help };
  return { bound: new Date(name === 'to' ? ms + 1 : ms).toISOString() };
}

/** One request returns at most this many. The largest business today has ~1,650. */
const MAX_LIMIT = 2000;

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(MAX_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
  // Google: the lowest star rating to include. Facebook has recommendations rather
  // than stars: 2 or more returns only "recommended" reviews.
  minRating: z.coerce.number().int().min(1).max(5).optional(),
  // Validated by parseDateParam, which reports bad dates as a 400 instead of throwing.
  from: z.string().optional(),
  to: z.string().optional(),
});

export interface PublicReview {
  /** The platform's own review id, when it has one. */
  id: string | null;
  author: string;
  /** 1 to 5 stars. Null on Facebook, which uses recommendationStatus instead. */
  rating: number | null;
  /** Empty for a star rating left without a comment. */
  content: string;
  /** As the platform shows it, e.g. "2 weeks ago". */
  postedAt: string;
  profilePicture: string | null;
  profileUrl: string | null;
  /** Facebook only: "recommended" or "not_recommended". */
  recommendationStatus: string | null;
  source: 'google' | 'facebook';
}

export interface PublicReviewsResponse {
  business: { id: string; name: string; url: string; source: 'google' | 'facebook'; lastScrapedAt: string | null };
  /** Every review on record for the business, after removing duplicates. */
  totalReviews: number;
  /** Google: average stars across all rated reviews. Null for Facebook. */
  averageRating: number | null;
  /** Facebook: share of reviews that recommend the business. Null for Google. */
  recommendedPercentage: number | null;
  /** The date range applied, echoed back. Null when none was asked for. */
  range: { from: string | null; to: string | null } | null;
  /** Reviews matching this request's filters. Use with limit and offset to page. */
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  reviews: PublicReview[];
}

type ErrorBody = { error: string };

/** `Authorization: Bearer rh_...`, else `X-API-Key: rh_...`. Never the URL. */
function apiKeyFrom(req: NextApiRequest): string | null {
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  const header = req.headers['x-api-key'];
  if (typeof header === 'string') return header.trim();
  return null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PublicReviewsResponse | ErrorBody>,
) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} not allowed.` });
  }

  // Refuse a key in the URL outright rather than ignoring it: someone who put it
  // there needs to know it is now sitting in logs, and should rotate it.
  if (typeof req.query.key === 'string' || typeof req.query.api_key === 'string' || typeof req.query.apiKey === 'string') {
    return res.status(400).json({
      error: 'Do not put the API key in the URL. Send it as a header: Authorization: Bearer rh_... If this key was shared in a URL, regenerate it.',
    });
  }

  const key = apiKeyFrom(req);
  const unauthorized = () => {
    res.setHeader('WWW-Authenticate', 'Bearer');
    return res.status(401).json({ error: 'Invalid or missing API key. Send it as: Authorization: Bearer rh_...' });
  };
  if (!key || !storage.REVIEWS_API_KEY_PATTERN.test(key)) return unauthorized();

  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid query.' });
  }
  const { limit, offset, minRating, from, to } = parsed.data;
  const start = parseDateParam(from, 'from');
  const end = parseDateParam(to, 'to');
  const dateError = start.error ?? end.error;
  if (dateError) return res.status(400).json({ error: dateError });
  if (start.bound && end.bound && start.bound >= end.bound) {
    return res.status(400).json({ error: 'from must be on or before to.' });
  }

  try {
    await dbConnect();
    const business = await storage.getBusinessUrlByApiKey(key);
    if (!business) return unauthorized();

    const source: 'google' | 'facebook' = business.source === 'facebook' ? 'facebook' : 'google';
    const result = business.urlHash
      ? await storage.getReviewStatsAndReviews(business.urlHash, source, {
          limit,
          offset,
          minRating,
          requireText: false,
          postedFrom: start.bound,
          postedBefore: end.bound,
        })
      : null;

    const rows = (result?.reviews ?? []) as StoredReview[];
    const reviews: PublicReview[] = rows.map((r) => ({
      id: r.reviewId || null,
      author: r.author,
      rating: typeof r.rating === 'number' ? r.rating : null,
      content: (r.content ?? r.text ?? '').trim(),
      postedAt: r.postedAt,
      profilePicture: r.profilePicture || null,
      profileUrl: r.userProfile || null,
      recommendationStatus: r.recommendationStatus || null,
      source,
    }));

    const total = result ? (result.filteredCount ?? result.totalCount) : 0;
    const rating = result?.averageRating;

    return res.status(200).json({
      business: {
        id: business._id.toString(),
        name: business.name,
        url: business.url,
        source,
        lastScrapedAt: business.lastScrapedAt ? new Date(business.lastScrapedAt).toISOString() : null,
      },
      totalReviews: result?.totalCount ?? 0,
      averageRating: source === 'google' && typeof rating === 'number' && rating > 0 ? rating : null,
      recommendedPercentage: source === 'facebook' && typeof rating === 'string' ? parseInt(rating, 10) : null,
      range: from || to ? { from: from ?? null, to: to ?? null } : null,
      total,
      limit,
      offset,
      hasMore: offset + reviews.length < total,
      reviews,
    });
  } catch (error) {
    // Never echo the key, and never the internal error, to the caller.
    console.error('[Public reviews API] failed:', error instanceof Error ? error.message : error);
    return res.status(500).json({ error: 'Could not load reviews.' });
  }
}
