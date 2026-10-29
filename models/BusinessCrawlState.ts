import { Schema } from 'mongoose';

// Shared by the three business-URL models. Its own module, with no model
// registration, so importing it never changes which schema owns a model name.

/**
 * Where the scheduled crawler is with this business. lastScrapedAt (on the business
 * itself) stays the time of the last COMPLETE crawl; this holds everything else.
 *
 * runId is the important one: it is written the moment an Apify run starts, so if
 * the function that started it dies, the next cron run collects the results
 * instead of paying for the same crawl again.
 */
export interface IBusinessCrawlState {
  /** An Apify run that has started but whose reviews are not saved yet. */
  runId?: string | null;
  runMode?: 'incremental' | 'full' | null;
  /** The date filter the run was started with. Null on a full crawl. */
  runSince?: Date | null;
  runStartedAt?: Date | null;
  /** Held while one process claims or collects, so two never crawl the same business. */
  lockedUntil?: Date | null;
  lastAttemptAt?: Date | null;
  /** Last successful crawl that fetched every review, not just new ones. */
  lastFullAt?: Date | null;
  lastError?: string | null;
  /** Failures in a row; drives the retry delay. */
  failures?: number;
  /** Do not retry before this, after a failure. */
  retryAt?: Date | null;
  /** New reviews the last successful crawl added. */
  lastAdded?: number;
  /** The run finished on Apify but saving its reviews failed; it no longer holds a slot. */
  runFinished?: boolean | null;
  /** Failed attempts to save the current run; after a few, the run is given up and re-crawled. */
  saveAttempts?: number;
  /** The crawl "succeeded" but the link gave us nothing to read: Facebook said the
   *  page is private, or a full Google crawl came back empty while we hold reviews.
   *  Shown on the dashboard; cleared the next time the link returns reviews. */
  notice?: string | null;
  noticeAt?: Date | null;
}

export const BusinessCrawlStateSchema = new Schema<IBusinessCrawlState>({
  runId: { type: String, default: undefined },
  runMode: { type: String, enum: ['incremental', 'full', null], default: undefined },
  runSince: { type: Date, default: undefined },
  runStartedAt: { type: Date, default: undefined },
  lockedUntil: { type: Date, default: undefined },
  lastAttemptAt: { type: Date, default: undefined },
  lastFullAt: { type: Date, default: undefined },
  lastError: { type: String, default: undefined },
  failures: { type: Number, default: undefined },
  retryAt: { type: Date, default: undefined },
  lastAdded: { type: Number, default: undefined },
  runFinished: { type: Boolean, default: undefined },
  saveAttempts: { type: Number, default: undefined },
  notice: { type: String, default: undefined },
  noticeAt: { type: Date, default: undefined },
}, { _id: false });
