import type { Model, Types } from 'mongoose';
import dbConnect from './mongodb';
import * as apify from './apify';
import type { ReviewSource, CrawlRunStatus } from './apify';
import { mergeNewReviews, getLatestStoredReviewDate } from './storage';
import GoogleBusinessUrlModel from '../models/GoogleBusinessUrl.model';
import FacebookBusinessUrlModel from '../models/FacebookBusinessUrl.model';
import type { IBusinessCrawlState } from '../models/BusinessCrawlState';

/**
 * The scheduled review crawler.
 *
 * Three promises, and the design follows from them:
 *
 * 1. EVERY CLIENT IS CRAWLED ON TIME. A cron calls runCrawlBatch every 15 minutes.
 *    Each call starts crawls for the businesses that are most overdue (never
 *    crawled first), a few at a time. Progress lives on each business, so a run
 *    that stops early just leaves the rest for the next one -- nobody is starved.
 *    The old crawl walked every business in one five-minute request and started
 *    from the top each time, so most clients were never reached.
 *
 * 2. NO REVIEW IS LOST. Saving is add-only (see mergeNewReviews). Each crawl looks
 *    back an overlap window before the newest review we hold, so a review Google
 *    publishes late is still caught. A full crawl every FULL_EVERY_DAYS is the
 *    safety net for anything older. The Apify run id is stored the moment a run
 *    starts, so a slow crawl is collected later instead of being lost.
 *
 * 3. NO WASTED APIFY CREDITS. Both actors charge per review scraped. A business is
 *    crawled only when it is due, only for reviews since its last crawl, and a
 *    lock stops two processes crawling it at once. A run that is already paid for
 *    is never thrown away and re-run.
 */

export const CRAWL_POLICY: Record<ReviewSource, { everyDays: number; overlapDays: number; fullEveryDays: number }> = {
  // How often a business is crawled, how far before the newest stored review each
  // crawl looks, and how often a crawl fetches everything as a check.
  google: { everyDays: 4, overlapDays: 14, fullEveryDays: 90 },
  facebook: { everyDays: 15, overlapDays: 30, fullEveryDays: 90 },
};

/** Apify runs allowed at once, across both platforms. */
const MAX_IN_FLIGHT = 4;
/** How long a claim holds a business while one process starts or collects its crawl. */
const LOCK_MS = 10 * 60_000;
/** A run still going after this long is aborted and retried. */
const STALE_RUN_MS = 3 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

interface CrawlBusiness {
  _id: Types.ObjectId;
  name: string;
  url: string;
  urlHash: string;
  lastScrapedAt?: Date | null;
  crawl?: IBusinessCrawlState;
}

const SOURCES: ReviewSource[] = ['google', 'facebook'];
const modelFor = (source: ReviewSource) =>
  (source === 'google' ? GoogleBusinessUrlModel : FacebookBusinessUrlModel) as unknown as Model<CrawlBusiness>;

const noRun = { $or: [{ 'crawl.runId': { $exists: false } }, { 'crawl.runId': null }] };
const unlocked = (now: Date) => ({
  $or: [{ 'crawl.lockedUntil': { $exists: false } }, { 'crawl.lockedUntil': null }, { 'crawl.lockedUntil': { $lte: now } }],
});
const retryAllowed = (now: Date) => ({
  $or: [{ 'crawl.retryAt': { $exists: false } }, { 'crawl.retryAt': null }, { 'crawl.retryAt': { $lte: now } }],
});
const lastCrawledBefore = (cutoff: Date) => ({
  $or: [{ lastScrapedAt: { $exists: false } }, { lastScrapedAt: null }, { lastScrapedAt: { $lte: cutoff } }],
});
const RUN_FIELDS = {
  'crawl.runId': 1, 'crawl.runMode': 1, 'crawl.runSince': 1, 'crawl.runStartedAt': 1,
  'crawl.lockedUntil': 1, 'crawl.runFinished': 1, 'crawl.saveAttempts': 1,
};
/** Tries at saving one finished run before giving up on it and crawling again. */
const MAX_SAVE_ATTEMPTS = 3;
const isGone = (err: unknown) =>
  (err as { statusCode?: number })?.statusCode === 404 || /not found|does not exist/i.test(err instanceof Error ? err.message : String(err));

export interface CrawlOutcome {
  businessId: string;
  name: string;
  source: ReviewSource;
  status: 'saved' | 'running' | 'failed' | 'skipped';
  mode?: 'incremental' | 'full';
  added?: number;
  checked?: number;
  error?: string;
}

/** Takes the lock on a business, or returns null if someone else holds it. */
async function claim(source: ReviewSource, id: Types.ObjectId | string, condition: Record<string, unknown>): Promise<CrawlBusiness | null> {
  const now = new Date();
  return modelFor(source)
    .findOneAndUpdate(
      { _id: id, $and: [condition, unlocked(now)] },
      { $set: { 'crawl.lockedUntil': new Date(now.getTime() + LOCK_MS) } },
      { new: true },
    )
    .lean<CrawlBusiness>()
    .exec();
}

async function recordFailure(source: ReviewSource, business: CrawlBusiness, error: string): Promise<CrawlOutcome> {
  const failures = (business.crawl?.failures ?? 0) + 1;
  // 1h, 2h, 4h ... capped at a day: a broken business is retried, never forgotten,
  // and never retried so often that it burns credits.
  const delayHours = Math.min(24, 2 ** (failures - 1));
  await modelFor(source).updateOne(
    { _id: business._id },
    {
      $set: {
        'crawl.failures': failures,
        'crawl.lastError': error.slice(0, 500),
        'crawl.retryAt': new Date(Date.now() + delayHours * 60 * 60_000),
      },
      $unset: RUN_FIELDS,
    },
  );
  console.error(`[crawler] ${source} "${business.name}" failed (${failures} in a row): ${error}`);
  return { businessId: String(business._id), name: business.name, source, status: 'failed', error };
}

/**
 * Where a crawl should start. Null means fetch everything: the business's first
 * crawl, a manual full recrawl, or its periodic full check.
 *
 * Otherwise, the earlier of the newest stored review and the last good crawl,
 * minus the overlap window. Reviews in the overlap are fetched twice and skipped
 * as duplicates; that small, bounded cost is what buys "never miss a late review".
 */
async function crawlStart(source: ReviewSource, business: CrawlBusiness, forceFull: boolean): Promise<Date | null> {
  const policy = CRAWL_POLICY[source];
  const lastOk = business.lastScrapedAt ? new Date(business.lastScrapedAt) : null;
  const lastFull = business.crawl?.lastFullAt ? new Date(business.crawl.lastFullAt) : null;
  if (forceFull || !lastOk || !lastFull || Date.now() - lastFull.getTime() >= policy.fullEveryDays * DAY_MS) return null;

  const newest = await getLatestStoredReviewDate(business.urlHash, source);
  const anchor = Math.min(lastOk.getTime(), newest ? newest.getTime() : Infinity);
  return new Date(anchor - policy.overlapDays * DAY_MS);
}

/** Starts a crawl for a business this process has claimed, and records the run id. */
async function start(source: ReviewSource, business: CrawlBusiness, forceFull = false): Promise<{ runId: string } | CrawlOutcome> {
  try {
    const since = await crawlStart(source, business, forceFull);
    const { runId, startedAt } = await apify.startCrawlRun(source, apify.buildCrawlInput(source, business.url, since));
    await modelFor(source).updateOne(
      { _id: business._id },
      {
        $set: {
          'crawl.runId': runId,
          'crawl.runMode': since ? 'incremental' : 'full',
          'crawl.runSince': since,
          'crawl.runStartedAt': startedAt,
          'crawl.lastAttemptAt': startedAt,
        },
        $unset: { 'crawl.lockedUntil': 1 },
      },
    );
    console.log(`[crawler] ${source} "${business.name}": started ${since ? `incremental since ${since.toISOString().slice(0, 10)}` : 'full'} crawl ${runId}`);
    return { runId };
  } catch (err) {
    return recordFailure(source, business, err instanceof Error ? err.message : String(err));
  }
}

/**
 * Saves a finished run's reviews. Whatever a run produced is saved even if it
 * failed part way -- it is already paid for, and saving only ever adds. But only a
 * run that SUCCEEDED counts as a complete crawl and moves the business on.
 */
async function collect(source: ReviewSource, business: CrawlBusiness, run: CrawlRunStatus): Promise<CrawlOutcome> {
  const base = { businessId: String(business._id), name: business.name, source, mode: business.crawl?.runMode ?? undefined };
  const runId = business.crawl?.runId as string;

  if (!run.finished) {
    if (Date.now() - run.startedAt.getTime() > STALE_RUN_MS) {
      await apify.abortCrawlRun(source, runId).catch(() => undefined);
      // Keep whatever it scraped before the abort: it is paid for, and saving only adds.
      let kept = 0;
      try {
        const partial = await apify.fetchCrawlReviews(source, run.datasetId);
        if (partial.length) kept = (await mergeNewReviews({ businessUrlId: String(business._id), url: business.url, urlHash: business.urlHash, source, reviews: partial })).added;
      } catch { /* nothing to keep */ }
      return recordFailure(source, business, `Apify run ${runId} ran for over 3 hours and was aborted; kept ${kept} new reviews it had found.`);
    }
    await modelFor(source).updateOne({ _id: business._id }, { $unset: { 'crawl.lockedUntil': 1 } });
    return { ...base, status: 'running' };
  }

  try {
    const reviews = await apify.fetchCrawlReviews(source, run.datasetId);
    const { added, checked } = reviews.length
      ? await mergeNewReviews({ businessUrlId: String(business._id), url: business.url, urlHash: business.urlHash, source, reviews })
      : { added: 0, checked: 0 };

    if (!run.succeeded) {
      return recordFailure(source, business, `Apify run ${runId} ended ${run.status}; saved the ${added} new reviews it found, will retry.`);
    }

    await modelFor(source).updateOne(
      { _id: business._id },
      {
        $set: {
          // The run's START: anything posted while it ran is covered by the overlap.
          lastScrapedAt: run.startedAt,
          'crawl.lastAdded': added,
          'crawl.failures': 0,
          ...(business.crawl?.runMode === 'full' ? { 'crawl.lastFullAt': run.startedAt } : {}),
        },
        $unset: { ...RUN_FIELDS, 'crawl.lastError': 1, 'crawl.retryAt': 1 },
      },
    );
    console.log(`[crawler] ${source} "${business.name}": saved, ${added} new of ${checked} fetched`);
    return { ...base, status: 'saved', added, checked };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Apify no longer has the results (datasets expire): crawl again.
    if (isGone(err)) return recordFailure(source, business, `Results of Apify run ${runId} are gone; will crawl again.`);
    // Give up on a run that will not save, so one bad business never stalls the queue.
    const attempts = (business.crawl?.saveAttempts ?? 0) + 1;
    if (attempts >= MAX_SAVE_ATTEMPTS) {
      return recordFailure(source, business, `Gave up saving Apify run ${runId} after ${attempts} tries: ${message}`);
    }
    // Otherwise keep the run (it is paid for) and retry the save later. It is
    // finished on Apify, so it no longer counts against the in-flight limit.
    const failures = (business.crawl?.failures ?? 0) + 1;
    await modelFor(source).updateOne(
      { _id: business._id },
      {
        $set: {
          'crawl.runFinished': true,
          'crawl.saveAttempts': attempts,
          'crawl.failures': failures,
          'crawl.lastError': `Could not save results yet: ${message}`.slice(0, 500),
          'crawl.retryAt': new Date(Date.now() + Math.min(24, 2 ** (failures - 1)) * 60 * 60_000),
        },
        $unset: { 'crawl.lockedUntil': 1 },
      },
    );
    console.error(`[crawler] ${source} "${business.name}": save failed (try ${attempts}): ${message}`);
    return { ...base, status: 'failed', error: `Could not save results yet: ${message}` };
  }
}

/** Claims a business with a run in flight, checks the run, and saves it if finished. */
async function collectPending(source: ReviewSource, id: Types.ObjectId | string, runId: string, waitSecs: number): Promise<CrawlOutcome | null> {
  const business = await claim(source, id, { 'crawl.runId': runId });
  if (!business) return null;
  try {
    const run = await apify.checkCrawlRun(source, runId, waitSecs);
    return await collect(source, business, run);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // A run Apify has no record of can never be collected: drop it and retry the
    // business. Anything else (a network blip) keeps the run for the next pass.
    if (isGone(err)) return recordFailure(source, business, `Apify run ${runId} no longer exists; will crawl again.`);
    await modelFor(source).updateOne({ _id: business._id }, { $unset: { 'crawl.lockedUntil': 1 } });
    return { businessId: String(id), name: business.name, source, status: 'failed', error: message };
  }
}

export interface CrawlBatchSummary {
  outcomes: CrawlOutcome[];
  saved: number;
  newReviews: number;
  started: number;
  running: number;
  failed: number;
  /** Due now and waiting for a slot. */
  waiting: number;
  /** Past due by more than a day. Should trend to zero; if it doesn't, look at failures. */
  overdue: number;
  /** Businesses whose last attempt failed and are waiting to retry. */
  failing: number;
  tookMs: number;
}

/**
 * One cron pass: save finished runs, then start crawls for the most overdue
 * businesses until MAX_IN_FLIGHT runs are going, then give the new ones a short
 * wait in case they finish quickly. Stays inside `budgetMs`.
 */
export async function runCrawlBatch(
  { budgetMs = 240_000, dryRun = false }: { budgetMs?: number; dryRun?: boolean } = {},
): Promise<CrawlBatchSummary & { wouldStart?: { name: string; source: ReviewSource; since: string | null }[] }> {
  await dbConnect();
  const t0 = Date.now();
  const left = () => budgetMs - (Date.now() - t0);
  const outcomes: CrawlOutcome[] = [];

  // 1. Collect runs started by earlier passes.
  for (const source of SOURCES) {
    if (dryRun) break;
    const pending = await modelFor(source)
      .find({ $and: [{ 'crawl.runId': { $type: 'string' } }, retryAllowed(new Date())] }, { 'crawl.runId': 1 })
      .lean<CrawlBusiness[]>()
      .exec();
    for (const p of pending) {
      if (left() < 30_000) break;
      const outcome = await collectPending(source, p._id, p.crawl!.runId as string, 0);
      if (outcome) outcomes.push(outcome);
    }
  }

  // 2. Start crawls for whoever is most overdue, never-crawled first.
  const now = new Date();
  let inFlight = 0;
  for (const source of SOURCES) {
    inFlight += await modelFor(source).countDocuments({ 'crawl.runId': { $type: 'string' }, 'crawl.runFinished': { $ne: true } });
  }
  const slots = Math.max(0, MAX_IN_FLIGHT - inFlight);

  const dueQuery = (source: ReviewSource) => ({
    $and: [noRun, unlocked(now), retryAllowed(now), lastCrawledBefore(new Date(now.getTime() - CRAWL_POLICY[source].everyDays * DAY_MS))],
  });
  const candidates: { source: ReviewSource; business: CrawlBusiness }[] = [];
  let waiting = 0;
  for (const source of SOURCES) {
    waiting += await modelFor(source).countDocuments(dueQuery(source));
    if (slots === 0) continue;
    const rows = await modelFor(source).find(dueQuery(source)).sort({ lastScrapedAt: 1 }).limit(slots).lean<CrawlBusiness[]>().exec();
    candidates.push(...rows.map((business) => ({ source, business })));
  }
  candidates.sort((a, b) => (a.business.lastScrapedAt ? new Date(a.business.lastScrapedAt).getTime() : 0) - (b.business.lastScrapedAt ? new Date(b.business.lastScrapedAt).getTime() : 0));

  if (dryRun) {
    const wouldStart = [];
    for (const { source, business } of candidates.slice(0, slots)) {
      const since = await crawlStart(source, business, false);
      wouldStart.push({ name: business.name, source, since: since ? since.toISOString().slice(0, 10) : null });
    }
    return { outcomes, saved: 0, newReviews: 0, started: 0, running: 0, failed: 0, waiting, overdue: 0, failing: 0, tookMs: Date.now() - t0, wouldStart };
  }

  const startedNow: { source: ReviewSource; id: Types.ObjectId; runId: string }[] = [];
  for (const { source, business } of candidates.slice(0, slots)) {
    if (left() < 60_000) break;
    const claimed = await claim(source, business._id, noRun);
    if (!claimed) continue;
    const result = await start(source, claimed);
    if ('runId' in result) startedNow.push({ source, id: claimed._id, runId: result.runId });
    else outcomes.push(result);
  }

  // 3. A short, shared wait: quick incremental crawls finish here; slow ones are
  //    collected by the next pass.
  const waitSecs = Math.max(0, Math.min(60, Math.floor((left() - 45_000) / 1000)));
  const collected = await Promise.all(startedNow.map((s) => collectPending(s.source, s.id, s.runId, waitSecs)));
  collected.forEach((o, i) => outcomes.push(o ?? { businessId: String(startedNow[i].id), name: '', source: startedNow[i].source, status: 'running' }));

  // 4. Health: how far behind are we?
  let overdue = 0;
  let failing = 0;
  for (const source of SOURCES) {
    const cutoff = new Date(Date.now() - (CRAWL_POLICY[source].everyDays + 1) * DAY_MS);
    overdue += await modelFor(source).countDocuments(lastCrawledBefore(cutoff));
    failing += await modelFor(source).countDocuments({ 'crawl.failures': { $gt: 0 } });
  }

  const summary: CrawlBatchSummary = {
    outcomes,
    saved: outcomes.filter((o) => o.status === 'saved').length,
    newReviews: outcomes.reduce((n, o) => n + (o.added ?? 0), 0),
    started: startedNow.length,
    running: outcomes.filter((o) => o.status === 'running').length,
    failed: outcomes.filter((o) => o.status === 'failed').length,
    waiting: Math.max(0, waiting - startedNow.length),
    overdue,
    failing,
    tookMs: Date.now() - t0,
  };
  console.log(`[crawler] pass done: ${JSON.stringify({ ...summary, outcomes: undefined })}`);
  return summary;
}

/**
 * A crawl someone asked for (the Recrawl button). Uses the same lock, start and
 * save as the schedule, so it is just as safe: add-only, and if it outlasts the
 * request the next cron pass saves it.
 */
export async function crawlBusinessNow(
  businessId: string,
  { full, waitSecs }: { full: boolean; waitSecs: number },
): Promise<CrawlOutcome> {
  await dbConnect();
  let source: ReviewSource | null = null;
  let business: CrawlBusiness | null = null;
  for (const s of SOURCES) {
    business = await modelFor(s).findById(businessId).lean<CrawlBusiness>().exec();
    if (business) { source = s; break; }
  }
  if (!business || !source) throw new Error('Business not found.');

  // A crawl already in flight: wait on that one rather than paying for a second.
  // If it was a full crawl, or none was asked for, that is the answer. If a full
  // Recrawl was asked for and the one in flight was incremental, save it first and
  // then do the full crawl.
  if (business.crawl?.runId) {
    const inFlightMode = business.crawl.runMode;
    const outcome = await collectPending(source, business._id, business.crawl.runId, waitSecs);
    if (!full || inFlightMode === 'full' || outcome?.status !== 'saved') {
      return outcome ?? { businessId, name: business.name, source, status: 'running' };
    }
  }

  const claimed = await claim(source, business._id, noRun);
  if (!claimed) return { businessId, name: business.name, source, status: 'skipped', error: 'A crawl for this business is already starting.' };
  const started = await start(source, claimed, full);
  if (!('runId' in started)) return started;
  const outcome = await collectPending(source, claimed._id, started.runId, waitSecs);
  return outcome ?? { businessId, name: business.name, source, status: 'running' };
}
