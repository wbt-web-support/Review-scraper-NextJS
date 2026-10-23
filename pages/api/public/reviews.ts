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
 * the widgets leave out. Pass `limit` and `offset` to page, or `minRating` to filter.
 */

/** One request returns at most this many. The largest business today has ~1,650. */
const MAX_LIMIT = 2000;

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(MAX_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
  // Google: the lowest star rating to include. Facebook has recommendations rather
  // than stars: 2 or more returns only "recommended" reviews.
  minRating: z.coerce.number().int().min(1).max(5).optional(),
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
  const { limit, offset, minRating } = parsed.data;

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
