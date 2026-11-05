import { ApifyClient } from 'apify-client';
import { IReviewItem } from '../models/Review.model'; 

const GOOGLE_APIFY_TOKEN = process.env.GOOGLE_APIFY_API_TOKEN;
const FACEBOOK_APIFY_TOKEN = process.env.FACEBOOK_APIFY_API_TOKEN;
const GOOGLE_REVIEWS_ACTOR_NAME = "compass/google-maps-reviews-scraper";
const FACEBOOK_REVIEWS_ACTOR_NAME = "apify/facebook-reviews-scraper";

if (!GOOGLE_APIFY_TOKEN) {
  console.warn("WARNING: GOOGLE_APIFY_API_TOKEN is not set. Google review scraping will likely fail.");
}
const googleClient = new ApifyClient({ token: GOOGLE_APIFY_TOKEN || '' });
if (!FACEBOOK_APIFY_TOKEN) {
  console.warn("WARNING: FACEBOOK_APIFY_API_TOKEN is not set. Facebook review scraping will likely fail.");
}
const facebookClient = new ApifyClient({ token: FACEBOOK_APIFY_TOKEN || '' });
interface ApifyGoogleReviewItem {
    [key: string]: unknown;
    reviewId?: string;
    id?: string | number;
    name?: string;
    authorName?: string;
    text?: string;
    reviewText?: string;
    stars?: number;
    rating?: number;
    publishedAtDate?: string;
    date?: string;
    userUrl?: string;
    reviewerPhotoUrl?: string;
    profilePictureUrl?: string;
  }
  
  interface ApifyFacebookReviewItem {
    [key: string]: unknown;
    review_id?: string | number;
    id?: string | number;
    author_name?: string;
    name?: string;
    review_text?: string;
    text?: string;
    review_time?: string;
    date?: string;
    author_avatar?: string;
    user_avatar?: string;
    recommendation_type?: string;
    scrapedAt?: string | Date;
    user?: {
      id?: string;
      name?: string;
      profileUrl?: string;
      profilePic?: string;
    };
    isRecommended?: boolean;
  }

/**
 * Fields that describe the BUSINESS and come back identical on every review.
 * Kept once per batch (see mergeNewReviews), never repeated on each review.
 */
const GOOGLE_PLACE_FIELDS = new Set([
  'placeId', 'location', 'address', 'neighborhood', 'street', 'city', 'postalCode', 'state',
  'countryCode', 'categoryName', 'categories', 'title', 'totalScore', 'reviewsCount',
  'permanentlyClosed', 'temporarilyClosed', 'price', 'url', 'cid', 'fid', 'imageUrl',
  'searchString', 'language', 'scrapedAt',
]);
const FACEBOOK_PAGE_FIELDS = new Set(['facebookUrl', 'facebookId', 'pageName', 'pageAdLibrary', 'inputUrl']);

/** Fields each parser maps onto a name of its own; whatever is left goes into `raw`. */
const GOOGLE_MAPPED_FIELDS = new Set([
  'reviewId', 'id', 'name', 'authorName', 'text', 'reviewText', 'stars', 'rating', 'publishedAtDate', 'date',
  'userUrl', 'reviewerPhotoUrl', 'profilePictureUrl', 'responseFromOwnerText', 'responseFromOwnerDate',
  'reviewContext', 'reviewDetailedRating', 'reviewImageUrls', 'likesCount', 'reviewUrl', 'textTranslated', 'originalLanguage',
]);
const FACEBOOK_MAPPED_FIELDS = new Set([
  'review_id', 'id', 'author_name', 'name', 'review_text', 'text', 'review_time', 'date', 'author_avatar', 'user_avatar',
  'recommendation_type', 'scrapedAt', 'user', 'isRecommended', 'tags', 'likesCount', 'url',
]);

/** The item minus the fields handled elsewhere, with empty values left out. */
function restOf(item: Record<string, unknown>, mapped: Set<string>, placeLevel: Set<string>): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(item)) {
    if (mapped.has(k) || placeLevel.has(k)) continue;
    if (v === null || v === undefined || v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0) continue;
    out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

const nonEmptyObject = (v: unknown): Record<string, unknown> | undefined =>
  v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length > 0 ? (v as Record<string, unknown>) : undefined;
const stringList = (v: unknown): string[] | undefined =>
  Array.isArray(v) && v.length > 0 ? v.filter((x): x is string => typeof x === 'string') : undefined;
const nonEmptyString = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);
const numberOr = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** Drops undefined values, so a review carries only what the scraper gave. */
function compact<T extends object>(o: T): T {
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === undefined) delete o[k];
  return o;
}

const parseGoogleReviewFromApify = (item: ApifyGoogleReviewItem): IReviewItem => {
    return compact({
        reviewId: item.reviewId || item.id?.toString(),
        author: item.name || item.authorName || "Anonymous Reviewer",
        content: (item.text || item.reviewText || "").toString(), // Always a string
        rating: typeof item.stars === 'number' ? item.stars : (typeof item.rating === 'number' ? item.rating : undefined),
        postedAt: item.publishedAtDate || item.date || "Recently",
        profilePicture: item.userUrl || item.reviewerPhotoUrl || item.profilePictureUrl,
        // Everything else the actor knows about the review. The owner's reply and
        // Google's "Service:" answer feed the category rules; the rest is kept so
        // nothing ever has to be crawled a second time.
        ownerReply: nonEmptyString(item.responseFromOwnerText),
        ownerReplyAt: nonEmptyString(item.responseFromOwnerDate),
        reviewContext: nonEmptyObject(item.reviewContext),
        reviewDetailedRating: nonEmptyObject(item.reviewDetailedRating),
        imageUrls: stringList(item.reviewImageUrls),
        likesCount: numberOr(item.likesCount),
        reviewUrl: nonEmptyString(item.reviewUrl),
        textTranslated: nonEmptyString(item.textTranslated),
        language: nonEmptyString(item.originalLanguage),
        raw: restOf(item, GOOGLE_MAPPED_FIELDS, GOOGLE_PLACE_FIELDS),
    });
};

const parseFacebookReviewFromApify = (item: ApifyFacebookReviewItem): IReviewItem => {
    return compact({
        reviewId: item.review_id?.toString() || item.id?.toString(),
        author: item.user?.name || item.author_name || item.name || "Anonymous Reviewer",
        content: item.review_text || item.text || "",
        postedAt: item.date || item.review_time || "Recently",
        profilePicture: item.user?.profilePic || item.author_avatar || item.user_avatar,
        recommendationStatus: typeof item.isRecommended === 'boolean'
          ? (item.isRecommended ? 'recommended' : 'not_recommended')
          : item.recommendation_type,
        scrapedAt: item.scrapedAt ? new Date(item.scrapedAt) : undefined, 
        tags: stringList(item.tags),
        likesCount: numberOr(item.likesCount),
        reviewUrl: nonEmptyString(item.url),
        raw: restOf(
          { ...item, user: undefined, reviewerId: item.user?.id, reviewerUrl: item.user?.profileUrl },
          FACEBOOK_MAPPED_FIELDS,
          FACEBOOK_PAGE_FIELDS,
        ),
    });
};



export type ReviewSource = 'google' | 'facebook';

/**
 * Links the actors can crawl. Anything else (a Google search page, a placeholder
 * left by a test, a link missing its place) is refused by Apify in seconds, every
 * time -- so the crawler checks first and never starts a run it knows will fail.
 * Checked against every stored link: these accept all 273 that crawl and reject
 * exactly the 3 that don't.
 */
export const CRAWLABLE_LINK: Record<ReviewSource, RegExp> = {
  google: /^https?:\/\/(?:(?:www\.|maps\.)?google\.[a-z.]+\/maps\/(?:place|search|reviews|dir)\/|(?:www\.)?google\.[a-z.]+\/maps\/?\?(?:.*&)?cid=\d+|maps\.app\.goo\.gl\/|goo\.gl\/maps\/|g\.page\/|search\.google\.com\/local\/(?:writereview|reviews))/i,
  facebook: /^https?:\/\/(?:[a-z]+\.)?(?:facebook|fb)\.com\/(?!search\b|login\b)[^/?#]+/i,
};
export const isCrawlableLink = (source: ReviewSource, url: string | null | undefined) => CRAWLABLE_LINK[source].test(url || '');

const clientFor = (source: ReviewSource) => (source === 'google' ? googleClient : facebookClient);
const actorFor = (source: ReviewSource) => (source === 'google' ? GOOGLE_REVIEWS_ACTOR_NAME : FACEBOOK_REVIEWS_ACTOR_NAME);
const tokenFor = (source: ReviewSource) => (source === 'google' ? GOOGLE_APIFY_TOKEN : FACEBOOK_APIFY_TOKEN);

/**
 * The Apify input for one business. `since` is the cost lever: both actors charge
 * per review scraped, so a crawl asks only for reviews posted after it. Null means
 * every review, which is only for a business's first crawl and the periodic full
 * check.
 *
 * No review cap on purpose. The old scheduled crawl capped at 1,000, which on a
 * business with more than that was a guaranteed loss.
 */
export function buildCrawlInput(source: ReviewSource, url: string, since: Date | null): Record<string, unknown> {
  if (source === 'google') {
    return {
      startUrls: [{ url }],
      language: 'en',
      reviewsSort: 'newest',
      ...(since ? { reviewsStartDate: since.toISOString() } : {}),
    };
  }
  return {
    startUrls: [{ url }],
    ...(since ? { onlyReviewsNewerThan: since.toISOString().slice(0, 10) } : {}),
  };
}

/**
 * Starts a crawl and returns at once. The caller records the run id before doing
 * anything else, so the results can be collected later even if this process dies.
 */
export async function startCrawlRun(source: ReviewSource, input: Record<string, unknown>): Promise<{ runId: string; startedAt: Date }> {
  if (!tokenFor(source)) throw new Error(`The ${source} Apify token is not configured.`);
  const run = await clientFor(source).actor(actorFor(source)).start(input);
  return { runId: run.id, startedAt: new Date(run.startedAt) };
}

export interface CrawlRunStatus {
  status: string;
  /** Apify's own explanation, e.g. "INVALID INPUT: startUrls don't contain any valid URLs". */
  statusMessage: string | null;
  finished: boolean;
  succeeded: boolean;
  datasetId: string;
  startedAt: Date;
}

const FINISHED = new Set(['SUCCEEDED', 'FAILED', 'TIMED-OUT', 'ABORTED']);

/** The run's state, waiting up to `waitSecs` for it to finish (0 = just look). */
export async function checkCrawlRun(source: ReviewSource, runId: string, waitSecs = 0): Promise<CrawlRunStatus> {
  const runClient = clientFor(source).run(runId);
  const run = waitSecs > 0 ? await runClient.waitForFinish({ waitSecs }) : await runClient.get();
  if (!run) throw new Error(`Apify run ${runId} was not found.`);
  return {
    status: run.status,
    statusMessage: run.statusMessage ?? null,
    finished: FINISHED.has(run.status),
    succeeded: run.status === 'SUCCEEDED',
    datasetId: run.defaultDatasetId,
    startedAt: new Date(run.startedAt),
  };
}

/** Apify's explanation for a past run, for failures recorded before it was kept. */
export async function crawlRunMessage(source: ReviewSource, runId: string): Promise<string | null> {
  const run = await clientFor(source).run(runId).get();
  return run?.statusMessage ?? null;
}

export async function abortCrawlRun(source: ReviewSource, runId: string): Promise<void> {
  await clientFor(source).run(runId).abort();
}

/**
 * Not a review: the actor sometimes emits a place-level item with no review in it,
 * which used to be stored as an "Anonymous Reviewer" with no text, rating or id.
 */
function isRealReview(r: IReviewItem): boolean {
  return Boolean(r.reviewId || (r.content || '').trim() || typeof r.rating === 'number' || r.recommendationStatus);
}

/** Every review a finished run produced, parsed. Paged, so a big business is not truncated. */
export async function fetchCrawlReviews(source: ReviewSource, datasetId: string): Promise<IReviewItem[]> {
  return (await fetchCrawlResult(source, datasetId)).reviews;
}

/**
 * Facebook's answer when it will not show a page's reviews. The run still
 * "succeeds", with a single item like { error: 'not_available', errorDescription }.
 * Worded for whoever reads the dashboard.
 */
function explainScraperError(source: ReviewSource, code: string, description: string): string {
  if (source === 'facebook' && code === 'not_available') {
    return "Facebook says this page's reviews are not public, so they cannot be read. The client needs to make the page and its reviews public.";
  }
  if (source === 'facebook' && code === 'no_items') {
    return 'Facebook returned no reviews for this page: it is empty, private, or has reviews switched off.';
  }
  return `${source === 'facebook' ? 'Facebook' : 'Google'} said: ${description || code}`;
}

/** A finished run's reviews, the scraper's own error if it returned one instead, and
 *  (Google) how many reviews the listing itself says it has. */
export interface CrawlResult {
  reviews: IReviewItem[];
  problem: string | null;
  listingCount: number | null;
  /** What the actor says about the business itself: address, Google's own count and score, and so on. */
  place: Record<string, unknown> | null;
}

export async function fetchCrawlResult(source: ReviewSource, datasetId: string): Promise<CrawlResult> {
  const dataset = clientFor(source).dataset(datasetId);
  const items: unknown[] = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const page = await dataset.listItems({ offset, limit: PAGE, clean: true });
    items.push(...page.items);
    if (page.items.length < PAGE) break;
  }
  const parse = source === 'google'
    ? (i: unknown) => parseGoogleReviewFromApify(i as ApifyGoogleReviewItem)
    : (i: unknown) => parseFacebookReviewFromApify(i as ApifyFacebookReviewItem);
  const reviews = items.map(parse).filter(isRealReview);
  const failed = reviews.length === 0
    ? (items as { error?: unknown; errorDescription?: unknown }[]).find((i) => i && typeof i.error === 'string')
    : undefined;
  const problem = failed ? explainScraperError(source, String(failed.error), String(failed.errorDescription ?? '')) : null;
  const counted = (items as { reviewsCount?: unknown }[]).find((i) => i && typeof i.reviewsCount === 'number');

  // The business-level block, from the first item that carries one.
  const placeFields = source === 'google' ? GOOGLE_PLACE_FIELDS : FACEBOOK_PAGE_FIELDS;
  const placeItem = (items as Record<string, unknown>[]).find((i) => i && (typeof i.placeId === 'string' || typeof i.facebookId === 'string' || typeof i.pageName === 'string'));
  let place: Record<string, unknown> | null = null;
  if (placeItem) {
    place = {};
    for (const k of placeFields) if (placeItem[k] !== undefined && placeItem[k] !== null) place[k] = placeItem[k];
    if (Object.keys(place).length === 0) place = null;
  }
  return { reviews, problem, listingCount: counted ? (counted.reviewsCount as number) : null, place };
}
