import type { Model } from 'mongoose';
import dbConnect from './mongodb';
import GoogleBusinessUrlModel from '../models/GoogleBusinessUrl.model';
import FacebookBusinessUrlModel from '../models/FacebookBusinessUrl.model';
import { GoogleReviewBatchModel, FacebookReviewBatchModel } from '../models/Review.model';
import WidgetModel from '../models/Widget.model';
import VideoBusinessModel from '../models/VideoBusiness.model';
import { createAdminClient } from '@vrm/lib/supabase/admin';
import { CRAWL_POLICY } from './reviewCrawler';
import { crawlRunMessage, isCrawlableLink } from './apify';

/**
 * Everything the operator dashboard shows, in one call.
 *
 * Counts follow the widgets' rules (lib/storage getReviewStatsAndReviews): every
 * batch a business has, one review per platform id, and an id-less copy dropped
 * when the same review also exists with an id. So the number next to a client
 * here is the number their widget shows.
 *
 * Workspace-wide, not per login: operators share every business (the widget
 * editor already lists them all), and a third of businesses have no owner set.
 */

type Source = 'google' | 'facebook';
const DAY_MS = 24 * 60 * 60_000;
const ISO = '^\\d{4}-\\d{2}-\\d{2}';

export interface DashboardBusiness {
  id: string;
  name: string;
  source: Source;
  reviews: number;
  averageRating: number | null;
  /** Posted in the last 30 days. */
  newReviews: number;
  lastCrawledAt: string | null;
  failing: boolean;
  /** Other entries for the same listing (the client was added more than once). */
  duplicateEntries: number;
}

export interface DashboardReview {
  businessId: string | null;
  businessName: string;
  source: Source;
  author: string;
  rating: number | null;
  recommended: boolean | null;
  content: string;
  postedAt: string;
}

export interface DashboardVideoReview {
  businessId: string | null;
  businessName: string;
  reviewerName: string;
  rating: number;
  type: 'video' | 'text';
  status: 'pending' | 'approved' | 'rejected';
  thumbnailUrl: string | null;
  createdAt: string;
}

export interface DashboardCrawlFailure {
  businessId: string;
  name: string;
  source: Source;
  url: string;
  /** What went wrong and what to do, in plain words. */
  problem: string;
  /** The underlying error, for whoever fixes it. */
  detail: string;
  failures: number;
  lastAttemptAt: string | null;
  retryAt: string | null;
}

export interface DashboardIssues {
  crawlFailures: DashboardCrawlFailure[];
  /** Clients added more than once: each copy is crawled (and paid for) separately. */
  duplicates: { extraEntries: number; examples: { name: string; entries: number; businessId: string; source: Source }[] };
  /** Saved links that aren't a listing, so they are not crawled at all. */
  invalidLinks: { businessId: string; name: string; source: Source; url: string; hasVideo: boolean }[];
  /** More than a day past their crawl, and not already counted as failing. */
  lateCrawls: { count: number; examples: { name: string; businessId: string; source: Source; lastCrawledAt: string | null }[] };
  pendingVideo: number;
}

export interface DashboardOverview {
  briefing: {
    /** Distinct listings; `entries` counts every business record, duplicates included. */
    clients: { total: number; google: number; facebook: number; entries: number; duplicateEntries: number };
    reviews: { total: number; google: number; facebook: number; last30Days: number };
    averageRating: number | null;
    widgets: { total: number; views: number };
    crawl: { upToDate: number; due: number; failing: number; lastCrawlAt: string | null };
  };
  topBusinesses: DashboardBusiness[];
  latestReviews: DashboardReview[];
  issues: DashboardIssues;
  video: {
    businesses: number;
    reviews: number;
    videos: number;
    pending: number;
    approved: number;
    rejected: number;
    latest: DashboardVideoReview[];
    topBusinesses: { businessId: string | null; name: string; reviews: number; pending: number }[];
  };
  generatedAt: string;
}

/** Per business, counted the widgets' way. One pass over a review collection. */
async function reviewStatsByUrlHash(model: Model<any>, cutoffIso: string) {
  const key = {
    $concat: [
      { $toLower: { $trim: { input: { $ifNull: ['$reviews.author', ''] } } } }, '|',
      { $toLower: { $substrCP: [{ $trim: { input: { $ifNull: ['$reviews.content', { $ifNull: ['$reviews.text', ''] }] } } }, 0, 50] } }, '|',
      { $toString: { $ifNull: ['$reviews.rating', ''] } },
    ],
  };
  const rows: { _id: string; reviews: number; rated: number; ratingSum: number; recent: number }[] = await model.aggregate([
    { $unwind: '$reviews' },
    {
      $project: {
        h: '$urlHash',
        id: { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$reviews.reviewId', ''] } }, 0] }, '$reviews.reviewId', null] },
        fk: key,
        rating: '$reviews.rating',
        recent: { $cond: [{ $and: [{ $regexMatch: { input: { $ifNull: ['$reviews.postedAt', ''] }, regex: ISO } }, { $gte: ['$reviews.postedAt', cutoffIso] }] }, 1, 0] },
      },
    },
    // One row per review: by id, or by the fallback key when there is no id.
    { $group: { _id: { h: '$h', k: { $ifNull: ['$id', { $concat: ['nk:', '$fk'] }] } }, hasId: { $first: { $ne: ['$id', null] } }, fk: { $first: '$fk' }, rating: { $first: '$rating' }, recent: { $max: '$recent' } } },
    // An id-less review whose twin exists with an id is the same review.
    { $group: { _id: { h: '$_id.h', fk: '$fk' }, docs: { $push: { hasId: '$hasId', rating: '$rating', recent: '$recent' } } } },
    { $project: { keep: { $let: { vars: { withId: { $filter: { input: '$docs', cond: '$$this.hasId' } } }, in: { $cond: [{ $gt: [{ $size: '$$withId' }, 0] }, '$$withId', [{ $arrayElemAt: ['$docs', 0] }]] } } } } },
    { $unwind: '$keep' },
    {
      $group: {
        _id: '$_id.h',
        reviews: { $sum: 1 },
        rated: { $sum: { $cond: [{ $isNumber: '$keep.rating' }, 1, 0] } },
        ratingSum: { $sum: { $cond: [{ $isNumber: '$keep.rating' }, '$keep.rating', 0] } },
        recent: { $sum: '$keep.recent' },
      },
    },
  ]).allowDiskUse(true).exec();
  return new Map(rows.map((r) => [r._id, r]));
}

/**
 * Distinct reviews in a whole collection. Some clients were added twice (two
 * entries for one Google listing), so summing per-business counts would count
 * their reviews twice; a review id is the same review wherever it is stored.
 */
async function distinctTotals(model: Model<any>, cutoffIso: string) {
  const [row] = await model.aggregate([
    { $unwind: '$reviews' },
    {
      $project: {
        k: {
          $cond: [
            { $gt: [{ $strLenCP: { $ifNull: ['$reviews.reviewId', ''] } }, 0] },
            { $concat: ['id:', '$reviews.reviewId'] },
            { $concat: ['nk:', '$urlHash', '|', { $toLower: { $trim: { input: { $ifNull: ['$reviews.author', ''] } } } }, '|', { $toLower: { $substrCP: [{ $trim: { input: { $ifNull: ['$reviews.content', ''] } } }, 0, 50] } }] },
          ],
        },
        rating: '$reviews.rating',
        recent: { $cond: [{ $and: [{ $regexMatch: { input: { $ifNull: ['$reviews.postedAt', ''] }, regex: ISO } }, { $gte: ['$reviews.postedAt', cutoffIso] }] }, 1, 0] },
      },
    },
    { $group: { _id: '$k', rating: { $first: '$rating' }, recent: { $max: '$recent' } } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        recent: { $sum: '$recent' },
        rated: { $sum: { $cond: [{ $isNumber: '$rating' }, 1, 0] } },
        ratingSum: { $sum: { $cond: [{ $isNumber: '$rating' }, '$rating', 0] } },
      },
    },
  ]).allowDiskUse(true).exec();
  return { total: row?.total ?? 0, recent: row?.recent ?? 0, rated: row?.rated ?? 0, ratingSum: row?.ratingSum ?? 0 };
}

/**
 * Which urlHashes are the same listing. Some clients were added more than once,
 * as separate entries for one Google or Facebook page; a review id shared between
 * entries proves it. Returns a function giving each urlHash its listing's key.
 */
async function listingGroups(model: Model<any>, hashes: string[]) {
  const shared: { h: string[] }[] = await model.aggregate([
    { $unwind: '$reviews' },
    { $match: { 'reviews.reviewId': { $type: 'string', $ne: '' } } },
    { $group: { _id: '$reviews.reviewId', h: { $addToSet: '$urlHash' } } },
    { $match: { 'h.1': { $exists: true } } },
    { $project: { _id: 0, h: 1 } },
  ]).allowDiskUse(true).exec();
  const parent = new Map(hashes.map((h) => [h, h]));
  const root = (h: string): string => {
    let r = h;
    while (parent.has(r) && parent.get(r) !== r) r = parent.get(r)!;
    return r;
  };
  for (const { h } of shared) {
    for (const other of h.slice(1)) {
      if (!parent.has(h[0]) || !parent.has(other)) continue;
      const a = root(h[0]), b = root(other);
      if (a !== b) parent.set(b, a);
    }
  }
  return root;
}

/** The newest reviews that have a real date. A few spare, since some repeat across batches. */
async function newestReviews(model: Model<any>, limit: number) {
  return model.aggregate([
    { $unwind: '$reviews' },
    { $match: { 'reviews.postedAt': { $regex: ISO } } },
    { $project: { _id: 0, urlHash: 1, r: '$reviews' } },
    { $sort: { 'r.postedAt': -1 } },
    { $limit: limit * 3 },
  ]).allowDiskUse(true).exec() as Promise<{ urlHash: string; r: { reviewId?: string; author: string; content?: string; rating?: number; postedAt: string; recommendationStatus?: string } }[]>;
}

/** A crawl error in words an operator can act on. */
function explainCrawlError(source: Source, reason: string): string {
  const page = source === 'google' ? 'Google Maps listing' : 'Facebook page';
  if (/startUrls.*valid URL/i.test(reason)) {
    return `The saved link is not a ${page}, so it can't be crawled. Edit the business and paste the link to its ${page}.`;
  }
  if (/token is not configured/i.test(reason)) return 'The Apify token is missing on the server, so nothing can be crawled.';
  if (/no longer exists|are gone/i.test(reason)) return 'Apify lost the results of this crawl. It will crawl again automatically.';
  if (/ran for over 3 hours/i.test(reason)) return 'The crawl ran too long and was stopped. It will retry automatically.';
  if (/could not save|gave up saving/i.test(reason)) return 'Reviews were fetched but could not be saved. It will retry automatically.';
  return 'The crawl failed. It will retry automatically; if it keeps failing, check the link.';
}

export async function getDashboardOverview(): Promise<DashboardOverview> {
  await dbConnect();
  const now = Date.now();
  const cutoffIso = new Date(now - 30 * DAY_MS).toISOString();

  const projection = { name: 1, url: 1, urlHash: 1, lastScrapedAt: 1, crawl: 1, 'video.tenantId': 1 } as const;
  const [google, facebook, gStats, fStats, gNew, fNew, widgetAgg, videoBiz, scrapedVideoG, scrapedVideoF, gTotals, fTotals] = await Promise.all([
    GoogleBusinessUrlModel.find({}, projection).lean().exec(),
    FacebookBusinessUrlModel.find({}, projection).lean().exec(),
    reviewStatsByUrlHash(GoogleReviewBatchModel, cutoffIso),
    reviewStatsByUrlHash(FacebookReviewBatchModel, cutoffIso),
    newestReviews(GoogleReviewBatchModel, 8),
    newestReviews(FacebookReviewBatchModel, 8),
    WidgetModel.aggregate([{ $match: { type: { $ne: 'video' } } }, { $group: { _id: null, n: { $sum: 1 }, views: { $sum: { $ifNull: ['$views', 0] } } } }]).exec(),
    VideoBusinessModel.find({}, { name: 1, 'video.tenantId': 1 }).lean().exec(),
    GoogleBusinessUrlModel.find({ 'video.tenantId': { $exists: true } }, { name: 1, 'video.tenantId': 1 }).lean().exec(),
    FacebookBusinessUrlModel.find({ 'video.tenantId': { $exists: true } }, { name: 1, 'video.tenantId': 1 }).lean().exec(),
    distinctTotals(GoogleReviewBatchModel, cutoffIso),
    distinctTotals(FacebookReviewBatchModel, cutoffIso),
  ]);
  const [gListing, fListing] = await Promise.all([
    listingGroups(GoogleReviewBatchModel, google.map((b: any) => b.urlHash)),
    listingGroups(FacebookReviewBatchModel, facebook.map((b: any) => b.urlHash)),
  ]);

  // ---- Businesses and their review counts.
  const byHash = new Map<string, { id: string; name: string; source: Source }>();
  const businesses: DashboardBusiness[] = [];
  const listingOf = new Map<string, string>();
  const invalid: DashboardIssues['invalidLinks'] = [];
  let crawlUpToDate = 0, crawlDue = 0, crawlFailing = 0, lastCrawl = 0;
  const addBusinesses = (rows: any[], source: Source, stats: Map<string, any>) => {
    for (const b of rows) {
      byHash.set(b.urlHash, { id: String(b._id), name: b.name, source });
      const s = stats.get(b.urlHash);
      const crawledAt = b.lastScrapedAt ? new Date(b.lastScrapedAt).getTime() : 0;
      const crawlable = isCrawlableLink(source, b.url);
      if (!crawlable) invalid.push({ businessId: String(b._id), name: b.name, source, url: b.url, hasVideo: !!b.video?.tenantId });
      const failing = crawlable && (b.crawl?.failures ?? 0) > 0;
      if (failing) crawlFailing++;
      if (crawlable) {
        if (crawledAt && now - crawledAt < CRAWL_POLICY[source].everyDays * DAY_MS) crawlUpToDate++; else crawlDue++;
      }
      lastCrawl = Math.max(lastCrawl, crawledAt);
      listingOf.set(String(b._id), `${source}:${(source === 'google' ? gListing : fListing)(b.urlHash)}`);
      businesses.push({
        id: String(b._id),
        name: b.name,
        source,
        reviews: s?.reviews ?? 0,
        averageRating: s?.rated ? Math.round((s.ratingSum / s.rated) * 10) / 10 : null,
        newReviews: s?.recent ?? 0,
        lastCrawledAt: crawledAt ? new Date(crawledAt).toISOString() : null,
        failing,
        duplicateEntries: 0,
      });
    }
  };
  addBusinesses(google, 'google', gStats);
  addBusinesses(facebook, 'facebook', fStats);

  // One row per listing: the entry with the most reviews stands for its copies.
  const byListing = new Map<string, DashboardBusiness[]>();
  for (const b of businesses) {
    const k = listingOf.get(b.id)!;
    byListing.set(k, [...(byListing.get(k) ?? []), b]);
  }
  const listings = [...byListing.values()].map((entries) => {
    const best = [...entries].sort((a, b) => b.reviews - a.reviews || (b.lastCrawledAt ?? '').localeCompare(a.lastCrawledAt ?? ''))[0];
    return { ...best, duplicateEntries: entries.length - 1 };
  });
  const listingCount = (src: Source) => listings.filter((l) => l.source === src).length;

  // Google only for the rating: Facebook has recommendations, not stars.
  const { rated, ratingSum } = gTotals;

  // ---- Latest reviews, newest first, one per id.
  const seen = new Set<string>();
  const latestReviews: DashboardReview[] = [...gNew.map((x) => ({ ...x, source: 'google' as Source })), ...fNew.map((x) => ({ ...x, source: 'facebook' as Source }))]
    .sort((a, b) => (a.r.postedAt < b.r.postedAt ? 1 : -1))
    .filter((x) => {
      // By review id across ALL clients: a duplicate client entry would otherwise
      // show the same review twice.
      const k = x.r.reviewId ? `id:${x.r.reviewId}` : `${x.urlHash}|${x.r.author}|${(x.r.content ?? '').slice(0, 50)}`;
      if (seen.has(k) || !byHash.has(x.urlHash)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 7)
    .map((x) => ({
      businessId: byHash.get(x.urlHash)!.id,
      businessName: byHash.get(x.urlHash)!.name,
      source: x.source,
      author: x.r.author,
      rating: typeof x.r.rating === 'number' ? x.r.rating : null,
      recommended: x.r.recommendationStatus ? x.r.recommendationStatus === 'recommended' : null,
      content: (x.r.content ?? '').trim().slice(0, 240),
      postedAt: x.r.postedAt,
    }));

  // ---- Video reviews (Supabase), for every business with video reviews switched on.
  const tenantBusiness = new Map<string, { id: string; name: string }>();
  for (const v of videoBiz as any[]) if (v.video?.tenantId) tenantBusiness.set(v.video.tenantId, { id: String(v._id), name: v.name });
  for (const v of [...scrapedVideoG, ...scrapedVideoF] as any[]) if (v.video?.tenantId && !tenantBusiness.has(v.video.tenantId)) tenantBusiness.set(v.video.tenantId, { id: String(v._id), name: v.name });
  const tenantIds = [...tenantBusiness.keys()];

  const video: DashboardOverview['video'] = { businesses: tenantIds.length, reviews: 0, videos: 0, pending: 0, approved: 0, rejected: 0, latest: [], topBusinesses: [] };
  if (tenantIds.length) {
    const { data, error } = await createAdminClient()
      .from('reviews')
      .select('tenant_id, reviewer_name, rating, type, status, thumbnail_url, created_at')
      .in('tenant_id', tenantIds)
      .order('created_at', { ascending: false })
      .limit(5000);
    if (error) throw new Error(`Video reviews: ${error.message}`);
    const rows = data ?? [];
    const perTenant = new Map<string, { reviews: number; pending: number }>();
    for (const r of rows) {
      video.reviews++;
      if (r.type === 'video') video.videos++;
      if (r.status === 'pending') video.pending++;
      else if (r.status === 'approved') video.approved++;
      else if (r.status === 'rejected') video.rejected++;
      const t = perTenant.get(r.tenant_id) ?? { reviews: 0, pending: 0 };
      t.reviews++;
      if (r.status === 'pending') t.pending++;
      perTenant.set(r.tenant_id, t);
    }
    video.latest = rows.slice(0, 6).map((r) => ({
      businessId: tenantBusiness.get(r.tenant_id)?.id ?? null,
      businessName: tenantBusiness.get(r.tenant_id)?.name ?? 'Unknown business',
      reviewerName: r.reviewer_name,
      rating: r.rating,
      type: r.type,
      status: r.status,
      thumbnailUrl: r.thumbnail_url,
      createdAt: r.created_at,
    }));
    video.topBusinesses = [...perTenant.entries()]
      .map(([tenantId, t]) => ({ businessId: tenantBusiness.get(tenantId)?.id ?? null, name: tenantBusiness.get(tenantId)?.name ?? 'Unknown business', ...t }))
      .sort((a, b) => b.reviews - a.reviews)
      .slice(0, 5);
  }

  // ---- Errors and issues.
  const allEntries = [...google.map((b: any) => ({ b, source: 'google' as Source })), ...facebook.map((b: any) => ({ b, source: 'facebook' as Source }))];
  const crawlFailures: DashboardCrawlFailure[] = await Promise.all(
    allEntries
      .filter(({ b, source }) => (b.crawl?.failures ?? 0) > 0 && isCrawlableLink(source, b.url))
      .sort((x, y) => (y.b.crawl.failures ?? 0) - (x.b.crawl.failures ?? 0))
      .slice(0, 20)
      .map(async ({ b, source }) => {
        let detail: string = b.crawl?.lastError ?? 'Unknown error';
        // Failures logged before the crawler kept Apify's reason: ask Apify for it.
        const runId = /^Apify run (\w{17}) ended (FAILED|TIMED-OUT|ABORTED)[;.]/.exec(detail)?.[1];
        if (runId) {
          const reason = await crawlRunMessage(source, runId).catch(() => null);
          if (reason) detail = `${detail.split(/[;.]/)[0]}: ${reason}`;
        }
        return {
          businessId: String(b._id),
          name: b.name,
          source,
          url: b.url,
          problem: explainCrawlError(source, detail),
          detail,
          failures: b.crawl?.failures ?? 0,
          lastAttemptAt: b.crawl?.lastAttemptAt ? new Date(b.crawl.lastAttemptAt).toISOString() : null,
          retryAt: b.crawl?.retryAt ? new Date(b.crawl.retryAt).toISOString() : null,
        };
      }),
  );

  const duplicateExamples = [...byListing.values()]
    .filter((entries) => entries.length > 1)
    .sort((a, b) => b.length - a.length || b[0].reviews - a[0].reviews)
    .slice(0, 6)
    .map((entries) => {
      const best = [...entries].sort((a, b) => b.reviews - a.reviews)[0];
      return { name: best.name, entries: entries.length, businessId: best.id, source: best.source };
    });

  const invalidIds = new Set(invalid.map((i) => i.businessId));
  const late = businesses.filter((b) => {
    if (b.failing || invalidIds.has(b.id)) return false;
    const due = (CRAWL_POLICY[b.source].everyDays + 1) * DAY_MS;
    return !b.lastCrawledAt || now - new Date(b.lastCrawledAt).getTime() > due;
  });

  const issues: DashboardIssues = {
    crawlFailures,
    invalidLinks: invalid,
    duplicates: { extraEntries: businesses.length - listings.length, examples: duplicateExamples },
    lateCrawls: {
      count: late.length,
      examples: late.slice(0, 5).map((b) => ({ name: b.name, businessId: b.id, source: b.source, lastCrawledAt: b.lastCrawledAt })),
    },
    pendingVideo: video.pending,
  };

  return {
    issues,
    briefing: {
      clients: {
        total: listings.length,
        google: listingCount('google'),
        facebook: listingCount('facebook'),
        entries: businesses.length,
        duplicateEntries: businesses.length - listings.length,
      },
      reviews: {
        total: gTotals.total + fTotals.total,
        google: gTotals.total,
        facebook: fTotals.total,
        last30Days: gTotals.recent + fTotals.recent,
      },
      averageRating: rated ? Math.round((ratingSum / rated) * 100) / 100 : null,
      widgets: { total: widgetAgg[0]?.n ?? 0, views: widgetAgg[0]?.views ?? 0 },
      crawl: { upToDate: crawlUpToDate, due: crawlDue, failing: crawlFailing, lastCrawlAt: lastCrawl ? new Date(lastCrawl).toISOString() : null },
    },
    topBusinesses: [...listings].sort((a, b) => b.reviews - a.reviews).slice(0, 10),
    latestReviews,
    video,
    generatedAt: new Date(now).toISOString(),
  };
}
