import dbConnect from './mongodb';
import UserModel, { IUser } from '../models/User.model';
import { IBusinessUrl } from '../models/BusinessUrl.model';
import type { IBusinessUrlVideo, IBusinessUrlDetails } from '../models/GoogleBusinessUrl.model';
import { GoogleReviewBatchModel, FacebookReviewBatchModel, type IReviewBatch, IReviewItem } from '../models/Review.model';
import GoogleBusinessUrlModel from '../models/GoogleBusinessUrl.model';
import FacebookBusinessUrlModel from '../models/FacebookBusinessUrl.model';
import WidgetModel, { IWidget, IWidgetVideoTenant } from '../models/Widget.model';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Types, UpdateQuery  } from 'mongoose';
interface IBusinessStats {
  totalBusinessUrls: number;
  totalWidgets: number;
  totalReviews: number;
  averageRating: number;
  totalViews: number;
  reviewsBySource: {
    google: number;
    facebook: number;
  };
}
interface ReviewStatItem {
  _id: 'google' | 'facebook' | null;
  totalReviewsInSource: number;
  sumOfRatings: number;
  countOfRatedReviews: number;
};
export interface IBusinessUrlDisplay {
    _id: string;
    name: string;
    url: string;
    urlHash: string;
    source: 'google' | 'facebook';
    userId?: string;
    /** Set once video reviews have been enabled for this business. */
    video?: IBusinessUrlVideo;
    /** Editable contact and branding details. */
    details?: IBusinessUrlDetails;
}
// Add cache for getLatestReviews at the top of the file after imports
const latestReviewsCache = new Map<string, { data: any[], timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Function to clear cache for a specific user or all users
export const clearLatestReviewsCache = (userId?: string) => {
  if (userId) {
    // Clear cache for specific user
    const keysToDelete = Array.from(latestReviewsCache.keys()).filter(key => key.startsWith(`${userId}:`));
    keysToDelete.forEach(key => latestReviewsCache.delete(key));
  } else {
    // Clear all cache
    latestReviewsCache.clear();
  }
};

// Function to get cache statistics
export const getLatestReviewsCacheStats = () => {
  const now = Date.now();
  const totalEntries = latestReviewsCache.size;
  const expiredEntries = Array.from(latestReviewsCache.entries()).filter(([_, value]) => 
    (now - value.timestamp) >= CACHE_TTL
  ).length;
  
  return {
    totalEntries,
    expiredEntries,
    validEntries: totalEntries - expiredEntries,
    cacheSize: latestReviewsCache.size
  };
};

async function ensureDbConnected() {
  await dbConnect();
};
export const getUserById = async (id: string): Promise<IUser | null> => {
  await ensureDbConnected();
  if (!Types.ObjectId.isValid(id)) return null;
  return UserModel.findById(id).exec();
};
export const getUserByEmail = async (email: string): Promise<IUser | null> => {
  await ensureDbConnected();
  const processedEmail = email.toLowerCase().trim();
  try {
    const user = await UserModel.findOne({ email: processedEmail })
      .select('+password')
      .lean()
      .exec();
    if (user) {
      return user as IUser; 
    } else {
      return null;
    }
  } catch (error) {
    const typedError = error as Error; 
    console.error(`[Storage/getUserByEmail] Error for ${processedEmail}:`, typedError.message);
    throw typedError; 
  }
};
export const getUserByUsername = async (username: string): Promise<IUser | null> => {
  await ensureDbConnected();
  return UserModel.findOne({ username }).select('+password').lean().exec() as Promise<IUser | null>;
};
interface CreateUserArgs {
  email: string;
  password?: string; 
  fullName?: string;
  username?: string;
  isVerified?: boolean;
}
export const createUser = async (userData: CreateUserArgs): Promise<IUser> => {
  await ensureDbConnected();
  if (!userData.password) throw new Error("Password is required to create user.");
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(userData.password, salt);
  const userToSave = new UserModel({
    ...userData,
    email: userData.email.toLowerCase(),
    password: hashedPassword,
    isVerified: userData.isVerified === undefined ? true : userData.isVerified,
  });
  const savedUser = await userToSave.save();
  const userObject = savedUser.toObject();
  delete userObject.password;
  return userObject as IUser;
};
export const comparePassword = async (password: string, hashedPassword?: string): Promise<boolean> => {
  if (!hashedPassword) return false;
  return bcrypt.compare(password, hashedPassword);
};
export const getBusinessUrlById = async (id: string): Promise<IBusinessUrl | null> => {
  await ensureDbConnected();
  if (!Types.ObjectId.isValid(id)) {
    console.warn(`[Storage/getBusinessUrlById] Invalid ID format: ${id}`);
    return null;
  }
  
  // Try Google first - use correct collection name
  const googleBusinessUrl = await GoogleBusinessUrlModel.findById(id).lean().exec();
  if (googleBusinessUrl) {
    return {
      ...googleBusinessUrl,
      source: 'google' as const
    };
  }

  // Try Facebook if not found in Google - use correct collection name
  const facebookBusinessUrl = await FacebookBusinessUrlModel.findById(id).lean().exec();
  if (facebookBusinessUrl) {
    return {
      ...facebookBusinessUrl,
      source: 'facebook' as const
    };
  }

  return null;
};
export const getBusinessUrlByUrlHash = async (urlHash: string): Promise<IBusinessUrl | null> => {
  await ensureDbConnected();
  
  // Try Google first
  const googleBusinessUrl = await GoogleBusinessUrlModel.findOne({ urlHash }).lean().exec();
  if (googleBusinessUrl) {
    return {
      ...googleBusinessUrl,
      source: 'google' as const
    };
  }

  // Try Facebook if not found in Google
  const facebookBusinessUrl = await FacebookBusinessUrlModel.findOne({ urlHash }).lean().exec();
  if (facebookBusinessUrl) {
    return {
      ...facebookBusinessUrl,
      source: 'facebook' as const
    };
  }

  return null;
};
export const getBusinessUrlsByUserId = async (userId: string): Promise<IBusinessUrlDisplay[]> => {
  await ensureDbConnected();
  if (!Types.ObjectId.isValid(userId)) {
    console.warn("[Storage/getBusinessUrlsByUserId] Invalid userId provided:", userId);
    return [];
  }
  const userIdObj = new Types.ObjectId(userId);

  try {
    const googleUrlsRaw = await GoogleBusinessUrlModel.find({ userId: userIdObj })
      .sort({ addedAt: -1 })
      .lean()
      .exec();

    const facebookUrlsRaw = await FacebookBusinessUrlModel.find({ userId: userIdObj })
      .sort({ addedAt: -1 })
      .lean()
      .exec();

    const googleUrls: IBusinessUrlDisplay[] = googleUrlsRaw.map(doc => ({
      _id: doc._id.toString(),
      name: doc.name,
      url: doc.url,
      urlHash: doc.urlHash,
      source: 'google' as const,
      userId: doc.userId?.toString(),
      video: doc.video,
      details: doc.details,
    }));

    const facebookUrls: IBusinessUrlDisplay[] = facebookUrlsRaw.map(doc => ({
      _id: doc._id.toString(),
      name: doc.name,
      url: doc.url,
      urlHash: doc.urlHash,
      source: 'facebook' as const,
      userId: doc.userId?.toString(),
      video: doc.video,
      details: doc.details,
    }));

    const combinedUrls = [...googleUrls, ...facebookUrls];
    return combinedUrls;

  } catch (error) {
    const err = error as Error;
    console.error(`[Storage/getBusinessUrlsByUserId] Error fetching business URLs for userId ${userId}:`, err.message, err.stack);
    throw new Error(`Database error while fetching business URLs: ${err.message}`);
  }
};
interface CreateBusinessUrlArgs {
  userId: string;
  name: string;
  url: string;
  source: 'google' | 'facebook';
  /** Set when video reviews are enabled at creation time. */
  video?: IBusinessUrlVideo;
  /** Contact/branding details captured at creation. */
  details?: IBusinessUrlDetails;
}
export const getAllBusinessUrlsForDisplay = async (): Promise<IBusinessUrlDisplay[]> => {
  await ensureDbConnected();

  try {
    const googleUrlsRaw = await GoogleBusinessUrlModel.find()
      .sort({ addedAt: -1 })
      .lean()
      .exec();

    const facebookUrlsRaw = await FacebookBusinessUrlModel.find()
      .sort({ addedAt: -1 })
      .lean()
      .exec();

    const googleUrls: IBusinessUrlDisplay[] = googleUrlsRaw.map(doc => ({
      _id: doc._id.toString(),
      name: doc.name,
      url: doc.url,
      urlHash: doc.urlHash,
      source: 'google' as const,
      userId: doc.userId?.toString(),
      video: doc.video,
      details: doc.details,
    }));

    const facebookUrls: IBusinessUrlDisplay[] = facebookUrlsRaw.map(doc => ({
      _id: doc._id.toString(),
      name: doc.name,
      url: doc.url,
      urlHash: doc.urlHash,
      source: 'facebook' as const,
      userId: doc.userId?.toString(),
      video: doc.video,
      details: doc.details,
    }));

    const combinedUrls = [...googleUrls, ...facebookUrls];
    return combinedUrls;

  } catch (error) {
    const err = error as Error;
    console.error("[Storage/getAllBusinessUrlsForDisplay] Error fetching business URLs:", err.message, err.stack);
    throw new Error(`Database error while fetching business URLs: ${err.message}`);
  }
};
export const createBusinessUrl = async (data: CreateBusinessUrlArgs): Promise<IBusinessUrlDisplay> => {
  await ensureDbConnected();
  const urlHash = crypto.createHash('md5').update(data.url).digest('hex');
  const userIdObj = new Types.ObjectId(data.userId);

  const modelData = {
    name: data.name,
    url: data.url,
    urlHash: urlHash,
    userId: userIdObj,
    source: data.source,
    addedAt: new Date(),
    ...(data.video ? { video: data.video } : {}),
    ...(data.details ? { details: data.details } : {}),
  };
  let newBusinessUrlDoc;
  if (data.source === 'google') {
    const existing = await GoogleBusinessUrlModel.findOne({ urlHash: urlHash  });
    if (existing) throw new Error(`This Google URL has already been added.`);
    newBusinessUrlDoc = await GoogleBusinessUrlModel.create(modelData);
  } else {
    const existing = await FacebookBusinessUrlModel.findOne({ urlHash: urlHash });
    if (existing) throw new Error(`This Facebook URL has already been added.`);
    newBusinessUrlDoc = await FacebookBusinessUrlModel.create(modelData);
  }
  const result = newBusinessUrlDoc.toObject();
  return {
    _id: result._id.toString(),
    name: result.name,
    url: result.url,
    urlHash: result.urlHash,
    source: result.source,
    userId: result.userId?.toString(),
    video: result.video,
  };
};

/**
 * Links a business to a Video Review Manager tenant, after the fact.
 *
 * Used both when video reviews are enabled on an EXISTING business and to attach the
 * link right after a business is created with video. The business lives in one of two
 * collections, so try both -- the id is unique across them.
 */
export const setBusinessUrlVideo = async (
  businessUrlId: string,
  video: IBusinessUrlVideo,
): Promise<void> => {
  await ensureDbConnected();
  const g = await GoogleBusinessUrlModel.updateOne({ _id: businessUrlId }, { $set: { video } }).exec();
  if (g.matchedCount === 0) {
    const f = await FacebookBusinessUrlModel.updateOne({ _id: businessUrlId }, { $set: { video } }).exec();
    if (f.matchedCount === 0) throw new Error('Business not found.');
  }
};

/**
 * Edits a business's name and/or contact-and-branding details.
 *
 * Only the keys given are written -- a `$set` on `details` fields, so first/last name
 * and the rest can be edited independently. The business lives in one of two
 * collections; the id is unique across them, so try both.
 */
export const updateBusinessUrlDetails = async (
  businessUrlId: string,
  patch: { name?: string; details?: IBusinessUrlDetails },
): Promise<void> => {
  await ensureDbConnected();

  const set: Record<string, unknown> = {};
  if (typeof patch.name === 'string') set.name = patch.name;
  if (patch.details) {
    for (const [k, v] of Object.entries(patch.details)) {
      if (v !== undefined) set[`details.${k}`] = v;
    }
  }
  if (Object.keys(set).length === 0) return;

  const g = await GoogleBusinessUrlModel.updateOne({ _id: businessUrlId }, { $set: set }).exec();
  if (g.matchedCount === 0) {
    const f = await FacebookBusinessUrlModel.updateOne({ _id: businessUrlId }, { $set: set }).exec();
    if (f.matchedCount === 0) throw new Error('Business not found.');
  }
};
/**
 * Keys for the JSON reviews API (GET /api/public/reviews): "rh_" and 48 hex
 * characters, which is 24 random bytes. Checked before any database lookup, so a
 * malformed key costs nothing and nothing but a plain string reaches the query.
 */
export const REVIEWS_API_KEY_PATTERN = /^rh_[0-9a-f]{48}$/;

/** The business's reviews API key, or null if none has been created. */
export const getBusinessApiKey = async (businessUrlId: string): Promise<string | null> => {
  await ensureDbConnected();
  const g = await GoogleBusinessUrlModel.findById(businessUrlId).select('+apiKey').lean().exec();
  if (g) return g.apiKey ?? null;
  const f = await FacebookBusinessUrlModel.findById(businessUrlId).select('+apiKey').lean().exec();
  return f?.apiKey ?? null;
};

/**
 * Creates the business's reviews API key, or replaces it. The old key stops working
 * the moment this returns, which is the point: it is how a leaked key is killed.
 */
export const rotateBusinessApiKey = async (businessUrlId: string): Promise<string> => {
  await ensureDbConnected();
  const apiKey = `rh_${crypto.randomBytes(24).toString('hex')}`;
  const g = await GoogleBusinessUrlModel.updateOne({ _id: businessUrlId }, { $set: { apiKey } }).exec();
  if (g.matchedCount === 0) {
    const f = await FacebookBusinessUrlModel.updateOne({ _id: businessUrlId }, { $set: { apiKey } }).exec();
    if (f.matchedCount === 0) throw new Error('Business not found.');
  }
  return apiKey;
};

/** Removes the key, which switches the reviews API off for this business. */
export const revokeBusinessApiKey = async (businessUrlId: string): Promise<void> => {
  await ensureDbConnected();
  const g = await GoogleBusinessUrlModel.updateOne({ _id: businessUrlId }, { $unset: { apiKey: 1 } }).exec();
  if (g.matchedCount === 0) {
    const f = await FacebookBusinessUrlModel.updateOne({ _id: businessUrlId }, { $unset: { apiKey: 1 } }).exec();
    if (f.matchedCount === 0) throw new Error('Business not found.');
  }
};

/**
 * The business a reviews API key belongs to, or null for any bad key. The key is
 * the only thing that picks the business: the API takes no business id, so there
 * is no parameter a caller could change to read someone else's reviews.
 */
export const getBusinessUrlByApiKey = async (apiKey: string): Promise<IBusinessUrl | null> => {
  if (!REVIEWS_API_KEY_PATTERN.test(apiKey)) return null;
  await ensureDbConnected();
  const g = await GoogleBusinessUrlModel.findOne({ apiKey }).lean().exec();
  if (g) return { ...g, source: 'google' as const };
  const f = await FacebookBusinessUrlModel.findOne({ apiKey }).lean().exec();
  if (f) return { ...f, source: 'facebook' as const };
  return null;
};

export const updateBusinessUrlScrapedTime = async (
  id: string,
  source: 'google' | 'facebook'
): Promise<IBusinessUrl | null> => {
  await ensureDbConnected();
  if (!Types.ObjectId.isValid(id)) {
    console.warn(`[Storage/updateBusinessUrlScrapedTime] Invalid ID format: ${id}`);
    return null;
  }

  const update = { lastScrapedAt: new Date() };
  let updatedDoc;

  if (source === 'google') {
    updatedDoc = await GoogleBusinessUrlModel.findByIdAndUpdate(
      id,
      update,
      { new: true }
    ).lean().exec();
  } else {
    updatedDoc = await FacebookBusinessUrlModel.findByIdAndUpdate(
      id,
      update,
      { new: true }
    ).lean().exec();
  }

  if (!updatedDoc) {
    console.warn(`[Storage/updateBusinessUrlScrapedTime] No document found with ID: ${id}`);
    return null;
  }

  return {
    ...updatedDoc,
    source
  };
};
interface GetReviewsOptions {
  limit?: number;    
  offset?: number;   
  minRating?: number;
  /**
   * Drop reviews with no written text. True unless set: the widgets only show
   * reviews with words in them. The JSON reviews API passes false, since a star
   * rating with no comment is still one of the business's reviews.
   */
  requireText?: boolean;
  /**
   * Only reviews posted on or after / before these ISO timestamps. A review whose
   * date is still "2 weeks ago" text cannot be placed in a range, so it is left out
   * whenever either bound is set.
   */
  postedFrom?: string;
  postedBefore?: string;
}
/**
 * One copy of each review, in the order given. Same rules as the widgets' query:
 * one review per platform id (keeping the copy with a real date), and a review
 * without an id is dropped when the same review also exists with one.
 */
export function dedupeStoredReviews<T extends IReviewItem>(reviews: T[]): T[] {
  const idKeys = new Set(reviews.filter((r) => r.reviewId).map(reviewFallbackKey));
  const byId = new Map<string, number>();
  const seenIdless = new Set<string>();
  const out: T[] = [];
  for (const r of reviews) {
    if (r.reviewId) {
      const at = byId.get(r.reviewId);
      if (at === undefined) {
        byId.set(r.reviewId, out.length);
        out.push(r);
      } else if (!ISO_DATE.test(out[at].postedAt || '') && ISO_DATE.test(r.postedAt || '')) {
        out[at] = r;
      }
      continue;
    }
    const key = reviewFallbackKey(r);
    if (idKeys.has(key) || seenIdless.has(key)) continue;
    seenIdless.add(key);
    out.push(r);
  }
  return out;
}

/**
 * Every stored review for a business, as one batch.
 *
 * Some businesses have two batches (re-added under a new id at some point) and the
 * crawler writes to the one owned by the current business id. This used to read
 * only the first batch it found, so the reviews page hid whole batches -- over two
 * thousand reviews across dozens of businesses -- and showed the same review id
 * twice where a batch held duplicates.
 */
export const getReviewBatchForBusinessUrl = async (
  urlHash: string,
  source: 'google' | 'facebook'
): Promise<IReviewBatch | null> => {
  await ensureDbConnected();
  const ModelToUse = source === 'google' ? GoogleReviewBatchModel : FacebookReviewBatchModel;

  let batches = await ModelToUse.find({ urlHash }).lean().exec();
  if (batches.length === 0) {
    // Older batches can be keyed only by the business id.
    const BusinessUrlModel = source === 'google' ? GoogleBusinessUrlModel : FacebookBusinessUrlModel;
    const businessUrl = await (BusinessUrlModel as any).findOne({ urlHash }).lean().exec();
    if (businessUrl) batches = await ModelToUse.find({ businessUrlId: businessUrl._id }).lean().exec();
  }
  if (batches.length === 0) return null;

  // The most recently scraped batch first, so its url and timestamps represent the business.
  batches.sort((a, b) => new Date(String(b.lastScrapedAt ?? 0)).getTime() - new Date(String(a.lastScrapedAt ?? 0)).getTime());
  const reviews = dedupeStoredReviews(batches.flatMap((b) => b.reviews || [])).map((review) => ({ ...review, source }));

  return { ...batches[0], source, reviews } as IReviewBatch;
};
export const getFilteredReviewsFromBatch = (
  reviewBatch: IReviewBatch | null,
  options: GetReviewsOptions = {}
): IReviewItem[] => {
  if (!reviewBatch || !reviewBatch.reviews || reviewBatch.reviews.length === 0) {
    return [];
  }
  
  let items = reviewBatch.reviews;
  const initialCount = items.length;
  
  // Log initial state
  
  if (options.minRating !== undefined) {
    const beforeFilterCount = items.length;
    items = items.filter(review => {
      // Handle Facebook reviews that use recommendationStatus instead of numeric rating
      if (reviewBatch.source === 'facebook') {
        if (options.minRating! >= 2) {
          // minRating=2 means "recommended only" for Facebook
          return review.recommendationStatus === 'recommended';
        } else {
          // minRating=1 means "all reviews" for Facebook (both recommended and not recommended)
          return review.recommendationStatus === 'recommended' || review.recommendationStatus === 'not_recommended';
        }
      }
      
      // Handle Google reviews with numeric ratings
      return review.rating !== undefined && review.rating >= options.minRating!;
    });
    
    const afterFilterCount = items.length;
  }
  
  const offset = options.offset || 0;
  const limit = options.limit;
  
  // Log pagination details
  if (limit !== undefined) {
    const beforePaginationCount = items.length;
    items = items.slice(offset, offset + limit);
    const afterPaginationCount = items.length;
  } else if (offset > 0) {
    const beforePaginationCount = items.length;
    items = items.slice(offset);
    const afterPaginationCount = items.length;
  }
  
  return items;
};
interface UpsertReviewsArgs {
  businessUrlId: string;
  url: string;
  urlHash: string;
  source: 'google' | 'facebook';
  reviews: IReviewItem[]; 
}
export const upsertReviews = async (data: UpsertReviewsArgs): Promise<IReviewBatch> => {
  await ensureDbConnected();
  if (!Types.ObjectId.isValid(data.businessUrlId)) throw new Error("Invalid businessUrlId for upsertReviews");
  // Facebook restriction removed to allow full replacements on manual recrawl
  const ReviewModelToUse = data.source === 'google' ? GoogleReviewBatchModel : FacebookReviewBatchModel;
  return ReviewModelToUse.findOneAndUpdate(
    { businessUrlId: new Types.ObjectId(data.businessUrlId), source: data.source },
    {
      $set: { 
        url: data.url,
        urlHash: data.urlHash,
        reviews: data.reviews,
        lastScrapedAt: new Date(),
        source: data.source, 
        businessUrlId: new Types.ObjectId(data.businessUrlId) 
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).exec();
};

// New function to merge new reviews with existing ones
/** A real timestamp, as opposed to the "2 weeks ago" text older scrapes stored. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

/**
 * Identity for a review that has no platform id. Author, opening text and rating
 * together: two different people, or two different reviews, almost never match.
 */
const reviewFallbackKey = (r: IReviewItem): string =>
  `${(r.author || '').trim().toLowerCase()}|${(r.content ?? (r as IReviewItem & { text?: string }).text ?? '').trim().slice(0, 50).toLowerCase()}|${r.rating ?? ''}`;

/**
 * Adds newly scraped reviews to a business. ADD-ONLY: nothing stored is ever
 * removed or replaced, so a partial or odd scrape can never cost a client a review.
 *
 * Duplicates are judged against EVERY batch holding this business's reviews --
 * some businesses have two, from being re-added under a new id, and the widgets
 * read them all by urlHash. A review with a platform id is a duplicate only of the
 * same id (or of an id-less stored copy of itself). A review without an id is
 * compared by author, opening text and rating.
 *
 * The old version compared ids alone, and a stored review with no id put
 * `undefined` in the id set -- after which every incoming review without an id
 * was silently thrown away as "already stored".
 *
 * When a review comes back that is already stored with a "2 weeks ago" style date,
 * its real timestamp replaces the text, which is what makes date filtering work on
 * older data.
 */
export const mergeNewReviews = async (
  data: UpsertReviewsArgs,
): Promise<{ added: number; datesFixed: number; checked: number }> => {
  await ensureDbConnected();
  if (!Types.ObjectId.isValid(data.businessUrlId)) throw new Error("Invalid businessUrlId for mergeNewReviews");

  const ReviewModelToUse = data.source === 'google' ? GoogleReviewBatchModel : FacebookReviewBatchModel;
  const businessOid = new Types.ObjectId(data.businessUrlId);

  const batches = await ReviewModelToUse.find({
    $or: [{ businessUrlId: businessOid }, { urlHash: data.urlHash }],
  }).exec();

  type Slot = { batch: (typeof batches)[number]; index: number };
  const byId = new Map<string, Slot>();
  const idless = new Map<string, Slot>();
  const allKeys = new Set<string>();
  batches.forEach((batch) => {
    (batch.reviews || []).forEach((review, index) => {
      if (review.reviewId) byId.set(review.reviewId, { batch, index });
      else if (!idless.has(reviewFallbackKey(review))) idless.set(reviewFallbackKey(review), { batch, index });
      allKeys.add(reviewFallbackKey(review));
    });
  });

  const toAdd: IReviewItem[] = [];
  // In-place fixes to stored reviews, as positional $set paths per batch.
  const fixes = new Map<(typeof batches)[number], Record<string, unknown>>();
  const fix = (slot: Slot, field: 'postedAt' | 'reviewId', value: string) => {
    const set = fixes.get(slot.batch) ?? {};
    set[`reviews.${slot.index}.${field}`] = value;
    fixes.set(slot.batch, set);
  };
  let datesFixed = 0;

  const seenThisScrape = new Set<string>();
  for (const review of data.reviews) {
    const key = reviewFallbackKey(review);
    if (review.reviewId) {
      if (seenThisScrape.has(review.reviewId)) continue;
      seenThisScrape.add(review.reviewId);
      const stored = byId.get(review.reviewId);
      if (stored) {
        const current = stored.batch.reviews[stored.index];
        if (!ISO_DATE.test(current.postedAt || '') && ISO_DATE.test(review.postedAt || '')) {
          fix(stored, 'postedAt', review.postedAt);
          datesFixed++;
        }
        continue;
      }
      // Stored before ids were kept: the same review, so give the stored copy its id
      // (and real date) rather than adding a second one.
      const twin = idless.get(key);
      if (twin) {
        const current = twin.batch.reviews[twin.index];
        fix(twin, 'reviewId', review.reviewId);
        if (!ISO_DATE.test(current.postedAt || '') && ISO_DATE.test(review.postedAt || '')) {
          fix(twin, 'postedAt', review.postedAt);
          datesFixed++;
        }
        idless.delete(key);
        byId.set(review.reviewId, twin);
        continue;
      }
    } else if (allKeys.has(key)) {
      continue;
    }
    allKeys.add(key);
    toAdd.push(review);
  }

  // Write into the batch owned by this business id, else the urlHash one, else a new one.
  const primary = batches.find((b) => String(b.businessUrlId) === String(businessOid)) || batches[0];
  if (!primary) {
    await ReviewModelToUse.create({
      businessUrlId: businessOid,
      url: data.url,
      urlHash: data.urlHash,
      reviews: toAdd,
      lastScrapedAt: new Date(),
      source: data.source,
    });
    return { added: toAdd.length, datesFixed: 0, checked: data.reviews.length };
  }

  // Targeted, atomic writes -- never a rewrite of the whole array. Re-saving the
  // array would re-validate every stored review (one bad legacy row would then
  // block all saving for the business) and would overwrite anything another
  // writer appended in the meantime. $push only appends, so the positional fixes
  // computed above still point at the right reviews.
  //
  // Fixes go first, as their own update: MongoDB refuses a positional $set and a
  // $push on the same array in one operation.
  for (const [batch, set] of fixes) {
    await ReviewModelToUse.updateOne({ _id: batch._id }, { $set: set }).exec();
  }
  await ReviewModelToUse.updateOne(
    { _id: primary._id },
    {
      $set: { lastScrapedAt: new Date(), url: data.url, urlHash: data.urlHash },
      ...(toAdd.length > 0 ? { $push: { reviews: { $each: toAdd } } } : {}),
    },
  ).exec();
  return { added: toAdd.length, datesFixed, checked: data.reviews.length };
};

/**
 * The newest real review date stored for a business, across all its batches.
 * Only ISO timestamps count: "2 weeks ago" says nothing without knowing when it
 * was scraped. Null when nothing usable is stored.
 */
export const getLatestStoredReviewDate = async (
  urlHash: string,
  source: 'google' | 'facebook',
): Promise<Date | null> => {
  await ensureDbConnected();
  const ReviewModelToUse = source === 'google' ? GoogleReviewBatchModel : FacebookReviewBatchModel;
  const [row] = await ReviewModelToUse.aggregate([
    { $match: { urlHash } },
    { $unwind: '$reviews' },
    { $match: { 'reviews.postedAt': { $regex: ISO_DATE.source } } },
    { $group: { _id: null, latest: { $max: '$reviews.postedAt' } } },
  ]).exec();
  const latest = row?.latest ? new Date(row.latest) : null;
  return latest && !isNaN(latest.getTime()) ? latest : null;
};

/**
 * Get the latest review date for a specific business URL
 * Returns the most recent review date or null if no reviews exist
 */
export const getLatestReviewDateForBusiness = async (
  businessUrlId: string,
  source: 'google' | 'facebook'
): Promise<Date | null> => {
  await ensureDbConnected();
  
  if (!Types.ObjectId.isValid(businessUrlId)) {
    console.warn(`[Storage/getLatestReviewDateForBusiness] Invalid businessUrlId: ${businessUrlId}`);
    return null;
  }

  try {
    const ReviewModelToUse = source === 'google' ? GoogleReviewBatchModel : FacebookReviewBatchModel;
    
    // Find the review batch for this business URL
    const reviewBatch = await ReviewModelToUse.findOne({ 
      businessUrlId: new Types.ObjectId(businessUrlId),
      source: source 
    }).exec();

    if (!reviewBatch || !reviewBatch.reviews || reviewBatch.reviews.length === 0) {
      return null;
    }

    // Find the latest review date
    let latestDate: Date | null = null;
    
    for (const review of reviewBatch.reviews) {
      let reviewDate: Date | null = null;
      
      // Try to parse the postedAt date
      if (review.postedAt) {
        const parsedDate = new Date(review.postedAt);
        if (!isNaN(parsedDate.getTime())) {
          reviewDate = parsedDate;
        }
      }
      
      // If postedAt is not available or invalid, try scrapedAt
      if (!reviewDate && review.scrapedAt) {
        reviewDate = new Date(review.scrapedAt);
      }
      
      // Update latest date if this review is more recent
      if (reviewDate && (!latestDate || reviewDate > latestDate)) {
        latestDate = reviewDate;
      }
    }

    return latestDate;
    
  } catch (error) {
    console.error(`[Storage/getLatestReviewDateForBusiness] Error getting latest review date for businessUrlId: ${businessUrlId}, source: ${source}:`, error);
    return null;
  }
};

/**
 * Optimized function to get review stats and a limited batch of reviews using MongoDB Aggregation
 * drastically reduces payload size by calculating stats on DB side
 */
export const getReviewStatsAndReviews = async (
  urlHash: string,
  source: 'google' | 'facebook',
  options: GetReviewsOptions = {}
): Promise<{
  totalCount: number;
  filteredCount?: number;
  averageRating: number | string;
  reviews: IReviewItem[];
  source: 'google' | 'facebook';
} | null> => {
  await ensureDbConnected();
  const ModelToUse = source === 'google' ? GoogleReviewBatchModel : FacebookReviewBatchModel;
  
  // Calculate default limit if not provided
  const limit = options.limit || 8;
  const offset = options.offset || 0;
  const minRating = options.minRating;
  const requireText = options.requireText !== false;
  const { postedFrom, postedBefore } = options;


  try {
    // 4. Facet stage to get stats/reviews
    // We want two sets of stats:
    // 1. "displayStats": Based on the FILTERED reviews (average rating of 4-star+ reviews, valid content, etc)
    // 2. "globalStats": The RAW total count of reviews for this business (ignoring minRating/content filters)
    
    // BUT 'pipeline' has already applied $match and $unwind. 
    // To get the RAW count properly, we actually need to branch *before* the specific filters (step 3).
    // Let's restructure.
    
    const basePipeline = [
       { $match: { urlHash: urlHash } },
       { $unwind: "$reviews" },
       // DEDUPLICATION STAGE:
       // Group duplications by reviewId (or author+content fallback) to ensure accurate counts.
       //
       // The id test must look at the string's length. `$ne: [<missing field>, null]`
       // is TRUE in aggregation, so the old test sent every review WITHOUT an id
       // down the "has an id" branch, grouped them all under one empty key, and
       // showed only one of them -- the rest silently vanished from widgets.
       // The fallback key matches the one mergeNewReviews uses.
       {
         $group: {
           _id: {
             $cond: {
               if: { $gt: [{ $strLenCP: { $ifNull: ["$reviews.reviewId", ""] } }, 0] },
               then: { $concat: ["id:", "$reviews.reviewId"] },
               else: { 
                 $concat: [
                   "nk:",
                   { $toLower: { $trim: { input: { $ifNull: ["$reviews.author", ""] } } } },
                   "|", 
                   { $toLower: { $substrCP: [{ $trim: { input: { $ifNull: ["$reviews.content", { $ifNull: ["$reviews.text", ""] }] } } }, 0, 50] } },
                   "|",
                   { $toString: { $ifNull: ["$reviews.rating", ""] } }
                 ] 
               }
             }
           },
           doc: { $first: "$$ROOT" }
         }
       },
       { $replaceRoot: { newRoot: "$doc" } },
       // Second pass: older scrapes stored some reviews without an id that were
       // later stored again with one. Group by the fallback key and, where a group
       // has copies WITH an id, keep only those -- distinct reviews that happen to
       // share author, text and rating all keep their own ids, so none is lost.
       {
         $addFields: {
           _hasId: { $gt: [{ $strLenCP: { $ifNull: ["$reviews.reviewId", ""] } }, 0] },
           _fk: {
             $concat: [
               { $toLower: { $trim: { input: { $ifNull: ["$reviews.author", ""] } } } },
               "|",
               { $toLower: { $substrCP: [{ $trim: { input: { $ifNull: ["$reviews.content", { $ifNull: ["$reviews.text", ""] }] } } }, 0, 50] } },
               "|",
               { $toString: { $ifNull: ["$reviews.rating", ""] } }
             ]
           }
         }
       },
       { $group: { _id: "$_fk", docs: { $push: "$$ROOT" } } },
       {
         $project: {
           keep: {
             $let: {
               vars: { withId: { $filter: { input: "$docs", cond: "$$this._hasId" } } },
               in: { $cond: [{ $gt: [{ $size: "$$withId" }, 0] }, "$$withId", [{ $arrayElemAt: ["$docs", 0] }]] }
             }
           }
         }
       },
       { $unwind: "$keep" },
       { $replaceRoot: { newRoot: "$keep" } },
       { $project: { _hasId: 0, _fk: 0 } }
    ];
    
    // Definition of the filter criteria
    const filterConditions = [
        ...(requireText ? [{
          $expr: {
            $gt: [
              {
                $strLenCP: {
                  $trim: {
                    input: { $ifNull: ["$reviews.content", { $ifNull: ["$reviews.text", ""] }] }
                  }
                }
              },
              0
            ]
          }
        }] : []),
        ...(minRating !== undefined ? [
          source === 'facebook' 
            ? (minRating >= 2 
                ? { "reviews.recommendationStatus": "recommended" }
                : { "reviews.recommendationStatus": { $in: ["recommended", "not_recommended"] } }
              )
            : { "reviews.rating": { $gte: minRating } }
        ] : []),
        ...(postedFrom || postedBefore ? [{
          // ISO strings sort as dates, so a string range is a date range.
          "reviews.postedAt": {
            $regex: "^\\d{4}-\\d{2}-\\d{2}",
            ...(postedFrom ? { $gte: postedFrom } : {}),
            ...(postedBefore ? { $lt: postedBefore } : {}),
          },
        }] : []),
    ];
    // $and refuses an empty array, so no conditions at all means match everything.
    const filterCriteria = filterConditions.length > 0 ? { $and: filterConditions } : {};

    const finalPipeline = [
      ...basePipeline,
      {
        $facet: {
          // A. Get the TOTAL count (unfiltered, just deduplicated)
          "totalResults": [
            { $count: "total" }
          ],

          // A2. Global average rating (all rated reviews, ignores minRating/content filters — matches Google profile)
          "globalRatingStats": source === 'google'
            ? [
                { $match: { "reviews.rating": { $exists: true, $ne: null } } },
                {
                  $group: {
                    _id: null,
                    avgRating: { $avg: "$reviews.rating" },
                  },
                },
              ]
            : [],
          
          // B. Calculate stats for FILTERED reviews
          "filteredStats": [
            { $match: filterCriteria }, // Apply filters here
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                avgRating: source === 'google' 
                  ? { $avg: "$reviews.rating" }
                  : { $sum: { $cond: [{ $eq: ["$reviews.recommendationStatus", "recommended"] }, 1, 0] } }
              }
            }
          ],
          
          // C. Get paginated FILTERED reviews
          "filteredReviews": [
            { $match: filterCriteria }, // Apply same filters
            // Newest first, in a FIXED order. Sorting the raw postedAt string put
            // "a year ago" text ahead of real dates (letters sort after digits) and
            // left ties in no particular order, so the same widget showed reviews in
            // a different order on each request and "load more" could repeat or skip
            // one. Real dates first, newest first; text-dated reviews after; the
            // review id breaks any tie.
            {
              $addFields: {
                _sortDate: { $cond: [{ $regexMatch: { input: { $ifNull: ["$reviews.postedAt", ""] }, regex: "^\\d{4}-\\d{2}-\\d{2}" } }, "$reviews.postedAt", ""] },
                _sortId: { $ifNull: ["$reviews.reviewId", { $ifNull: ["$reviews.author", ""] }] },
              },
            },
            { $sort: { _sortDate: -1, _sortId: -1 } },
            { $replaceRoot: { newRoot: "$reviews" } },
            { $skip: offset },
            { $limit: limit }
          ]
        }
      }
    ];

    // Execute aggregation
    const result = await ModelToUse.aggregate(finalPipeline as any[]).exec();
    
    if (!result || result.length === 0) {
       return null;
    }

    // Parse the new flattened structure
    const totalGroup = result[0].totalResults[0] || { total: 0 };
    const absoluteTotalCount = totalGroup.total || 0;
    
    const stats = (result[0].filteredStats && result[0].filteredStats[0]) 
      ? result[0].filteredStats[0] 
      : { count: 0, avgRating: 0 };

    const globalRatingStats =
      result[0].globalRatingStats && result[0].globalRatingStats[0]
        ? result[0].globalRatingStats[0]
        : null;
    
    const reviews = result[0].filteredReviews || [];
    
    // DEBUG: Log the raw aggregation result
    
    // Format the Avg Rating (based on FILTERED subset usually? Or should avg rating be global? 
    // Usually if you filter "4 stars+", you want average of THOSE. 
    // If user wants average of ALL, they shouldn't filter.
    // However, for "Total Count", user specifically asked to see "219" (total) not "194" (filtered).
    
    let formattedAvgRating: number | string = 0;
    
    if (source === 'facebook') {
      const totalReviews = stats.count; // Use filtered count for percentage calc to match displayed reviews? 
      // Actually usually Facebook % is "Recommended" / "Total". If we filter out "Not Recommended", % becomes 100%. 
      // That might be misleading. But if the USER set "Min Rating", they usually WANT to hide bad stuff.
      // Let's stick to calculating stats from the filtered set to ensure consistency with the list.
      
      const recommendedCount = stats.avgRating; 
      formattedAvgRating = totalReviews > 0 
        ? Math.round((recommendedCount / totalReviews) * 100) + "%" 
        : "100%";
    } else {
      const globalAvg = globalRatingStats?.avgRating;
      const filteredAvg = stats.avgRating;
      const ratingToUse = globalAvg ?? filteredAvg;
      formattedAvgRating = ratingToUse
        ? parseFloat(Number(ratingToUse).toFixed(1))
        : 0;
    }

    const reviewsWithSource = reviews.map((r: any) => ({ ...r, source }));

    // IMPORTANT: Return absoluteTotalCount as `totalCount` so the widget displays "219 Reviews".
    // We can also return a new field `filteredCount` if the widget needs to limit "Load More" (pagination).
    

    return {
      totalCount: absoluteTotalCount, // THIS FIXES THE VISIBLE COUNT
      filteredCount: stats.count,     // THIS IS FOR PAGINATION LIMITS
      averageRating: formattedAvgRating,
      reviews: reviewsWithSource,
      source: source
    };

  } catch (error) {
    console.error(`[Storage] 📊 Aggregation Error:`, error);
    // Fallback to old method if aggregation fails
    const batch = await getReviewBatchForBusinessUrl(urlHash, source);
    if (!batch) return null;
    
    const filtered = getFilteredReviewsFromBatch(batch, options);
    // Rough calc for fallback
    return {
      totalCount: filtered.length, // mismatched matching logic
      averageRating: 0,
      reviews: filtered.slice(0, limit),
      source
    };
  }
};

export const getLatestReviews = async (
  userId: string,
  limit = 10
): Promise<{ data: Array<IReviewItem & { businessName: string; source: 'google' | 'facebook' | string; businessUrl?: string }>, cacheHit: boolean }> => {
  await ensureDbConnected();

  if (!Types.ObjectId.isValid(userId)) {
    console.warn(`[Storage/getLatestReviews] Invalid userId: ${userId}`);
    return { data: [], cacheHit: false };
  }

  // Check cache first
  const cacheKey = `${userId}:${limit}`;
  const cached = latestReviewsCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return { data: cached.data, cacheHit: true };
  }

  const userIdObj = new Types.ObjectId(userId);

  try {
    // Use Promise.all to run both queries in parallel for better performance
    const [googleReviews, facebookReviews] = await Promise.all([
      GoogleReviewBatchModel.aggregate([
        {
          $lookup: {
            from: 'business_urls', // Collection name for GoogleBusinessUrl
            localField: 'businessUrlId',
            foreignField: '_id',
            as: 'businessUrl'
          }
        },
        {
          $unwind: {
            path: '$businessUrl',
            preserveNullAndEmptyArrays: false
          }
        },
        {
          $match: {
            'businessUrl.userId': userIdObj
          }
        },
        {
          $unwind: '$reviews'
        },
        {
          $addFields: {
            'reviews.businessName': '$businessUrl.name',
            'reviews.source': 'google',
            'reviews.businessUrl': '$businessUrl.url',
            'reviews.scrapedAt': { 
              $ifNull: [
                '$reviews.scrapedAt', 
                { $dateFromString: { dateString: '$reviews.postedAt', onError: new Date(0) } }
              ] 
            }
          }
        },
        {
          $replaceRoot: { newRoot: '$reviews' }
        },
        {
          $sort: { scrapedAt: -1 }
        },
        {
          $limit: limit
        }
      ]),
      
      FacebookReviewBatchModel.aggregate([
        {
          $lookup: {
            from: 'facebook_business_urls', // Collection name for FacebookBusinessUrl
            localField: 'businessUrlId',
            foreignField: '_id',
            as: 'businessUrl'
          }
        },
        {
          $unwind: {
            path: '$businessUrl',
            preserveNullAndEmptyArrays: false
          }
        },
        {
          $match: {
            'businessUrl.userId': userIdObj
          }
        },
        {
          $unwind: '$reviews'
        },
        {
          $addFields: {
            'reviews.businessName': '$businessUrl.name',
            'reviews.source': 'facebook',
            'reviews.businessUrl': '$businessUrl.url',
            'reviews.scrapedAt': { 
              $ifNull: [
                '$reviews.scrapedAt', 
                { $dateFromString: { dateString: '$reviews.postedAt', onError: new Date(0) } }
              ] 
            }
          }
        },
        {
          $replaceRoot: { newRoot: '$reviews' }
        },
        {
          $sort: { scrapedAt: -1 }
        },
        {
          $limit: limit
        }
      ])
    ]);

    // Combine and sort the results
    const allReviews = [...googleReviews, ...facebookReviews];
    
    // Sort by scrapedAt date (most recent first) and limit
    allReviews.sort((a, b) => {
      const dateA = a.scrapedAt ? new Date(a.scrapedAt).getTime() : 0;
      const dateB = b.scrapedAt ? new Date(b.scrapedAt).getTime() : 0;
      return dateB - dateA;
    });

    const finalResults = allReviews.slice(0, limit);
    
    // Cache the results
    latestReviewsCache.set(cacheKey, {
      data: finalResults,
      timestamp: Date.now()
    });

    return { data: finalResults, cacheHit: false };

  } catch (dbError: unknown) {
    const err = dbError as Error;
    console.error(`[Storage/getLatestReviews] DB Error for userId ${userId}:`, err.message, err.stack);
    throw new Error(`Database error in getLatestReviews: ${err.message}`);
  }
};
export const getWidgetById = async (id: string): Promise<IWidget | null> => {
  await ensureDbConnected();
  if (!Types.ObjectId.isValid(id)) return null;
  return WidgetModel.findById(id).populate('businessUrlId').lean().exec();
};
/** The widget alone, for the public feed: one round trip, no populate. */
export const getWidgetForPublicFeed = async (id: string): Promise<IWidget | null> => {
  await ensureDbConnected();
  if (!Types.ObjectId.isValid(id)) return null;
  return WidgetModel.findById(id).lean<IWidget>().exec();
};

/** Just the stored url of a business's review batch, without loading its reviews. */
export const getReviewBatchUrl = async (urlHash: string, source: 'google' | 'facebook'): Promise<string | null> => {
  await ensureDbConnected();
  const ModelToUse = source === 'google' ? GoogleReviewBatchModel : FacebookReviewBatchModel;
  const batch = await ModelToUse.findOne({ urlHash }, { url: 1 }).lean().exec();
  return batch?.url ?? null;
};

export const getWidgetsByUserId = async (userId: string): Promise<IWidget[]> => {
  await ensureDbConnected();
  if (!Types.ObjectId.isValid(userId)) return [];
  
  const widgets = await WidgetModel.find({ userId: new Types.ObjectId(userId) })
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  // Manually populate business URL information and get total review count
  const populatedWidgets = await Promise.all(
    widgets.map(async (widget) => {
      let businessUrl = undefined;
      let totalReviewCount = 0;
      
      if (widget.businessUrlId) {
        try {
          // Try to get business URL from the appropriate collection
          const businessUrlData = await getBusinessUrlById(widget.businessUrlId.toString());
          if (businessUrlData) {
            businessUrl = {
              _id: businessUrlData._id.toString(),
              name: businessUrlData.name,
              source: businessUrlData.source as 'google' | 'facebook',
              url: businessUrlData.url,
            };

            // Get total review count for this business URL
            if (businessUrlData.urlHash) {
              try {
                const reviewBatch = await getReviewBatchForBusinessUrl(
                  businessUrlData.urlHash,
                  businessUrlData.source as 'google' | 'facebook'
                );
                if (reviewBatch && reviewBatch.reviews) {
                  totalReviewCount = reviewBatch.reviews.length;
                }
              } catch (error) {
                console.error(`[Storage/getWidgetsByUserId] Error fetching review count for widget ${widget._id}:`, error);
              }
            }
          }
        } catch (error) {
          console.error(`[Storage/getWidgetsByUserId] Error fetching business URL for widget ${widget._id}:`, error);
        }
      } else if (widget.businessUrlSource) {
        // If no businessUrlId but we have businessUrlSource, create a minimal businessUrl object
        businessUrl = {
          _id: "",
          name: widget.name, // Use widget name as fallback
          source: widget.businessUrlSource as 'google' | 'facebook',
          url: undefined,
        };

        // Try to get total review count using urlHash from widget
        if (widget.urlHash) {
          try {
            const source = widget.businessUrlSource === 'GoogleBusinessUrl' ? 'google' : 'facebook';
            const reviewBatch = await getReviewBatchForBusinessUrl(widget.urlHash, source);
            if (reviewBatch && reviewBatch.reviews) {
              totalReviewCount = reviewBatch.reviews.length;
            }
          } catch (error) {
            console.error(`[Storage/getWidgetsByUserId] Error fetching review count for widget ${widget._id}:`, error);
          }
        }
      } else if (widget.type === 'video') {
        // No business URL by design -- a video widget's reviews live in Supabase.
        // Leave businessUrl undefined rather than falling through to the fallback
        // below, which would label it 'google' in every source-aware UI.
      } else {
        businessUrl = {
          _id: "",
          name: widget.name, // Use widget name as fallback
          source: 'google',
          url: undefined,
        };
      }

      return {
        ...widget,
        businessUrl,
        totalReviewCount,
      } as IWidget;
    })
  );

  return populatedWidgets;
};
export interface CreateWidgetArgs {
  userId: string;
  /** Omitted for type 'video', which is backed by a Supabase tenant instead. */
  businessUrlId?: string;
  businessUrlSource?: 'GoogleBusinessUrl' | 'FacebookBusinessUrl';
  urlHash?: string;
  /** Required for type 'video', ignored otherwise. */
  video?: IWidgetVideoTenant;
  name: string;
  type?: "grid" | "carousel" | "list" | "masonry" | "badge" | "bar" | "wall" | "video";
  minRating?: number;
  themeColor?: string;
  showRatings?: boolean;
  showDates?: boolean;
  showProfilePictures?: boolean;
  initialReviewCount?: number;
  settings?: {
    themeColor?: string;
    minRating?: number;
    showRatings?: boolean;
    showDates?: boolean;
    showProfilePictures?: boolean;
  };
}
export const createWidget = async (widgetData: CreateWidgetArgs): Promise<IWidget> => {
  await ensureDbConnected();
  const newWidgetDocumentData = {
    userId: new Types.ObjectId(widgetData.userId),
    // Spread, not a plain property: `new Types.ObjectId(undefined)` does not yield
    // undefined, it MINTS A FRESH RANDOM ID. On a video widget (which has no business
    // URL) that would quietly write a businessUrlId pointing at nothing, and the bad
    // reference would only surface later as an empty populate.
    ...(widgetData.businessUrlId
      ? {
          businessUrlId: new Types.ObjectId(widgetData.businessUrlId),
          businessUrlSource: widgetData.businessUrlSource,
          urlHash: widgetData.urlHash,
        }
      : {}),
    ...(widgetData.video ? { video: widgetData.video } : {}),
    name: widgetData.name,
    type: widgetData.type || 'grid',
    minRating: widgetData.minRating ?? 0,
    themeColor: widgetData.themeColor || '#3B82F6',
    showRatings: widgetData.showRatings ?? true,
    showDates: widgetData.showDates ?? true,
    showProfilePictures: widgetData.showProfilePictures ?? true,
    initialReviewCount: widgetData.initialReviewCount ?? 10,
    views: 0,
  };
  const newWidget = new WidgetModel(newWidgetDocumentData);
  const savedWidget = await newWidget.save();
  return savedWidget.toObject({ getters: true, virtuals: false }) as IWidget; 
};
interface UpdateWidgetArgs {
  name?: string;
  type?: "grid" | "carousel" | "list" | "masonry" | "badge" | "bar" | "wall" | "video";
  maxReviews?: number;
  minRating?: number;
  businessUrlId?: string;
  themeColor?: string;
  showRatings?: boolean;
  showDates?: boolean;
  showProfilePictures?: boolean;
  initialReviewCount?: number;
  settings?: Record<string, unknown>;
}
export const updateWidget = async (id: string, widgetData: UpdateWidgetArgs): Promise<IWidget | null> => {
  await ensureDbConnected();
  if (!Types.ObjectId.isValid(id)) return null;
  
  const updatePayload: UpdateQuery<IWidget> = { ...widgetData }; 
  updatePayload.updatedAt = new Date();
  
  if (widgetData.businessUrlId && Types.ObjectId.isValid(widgetData.businessUrlId)) {
    updatePayload.businessUrlId = new Types.ObjectId(widgetData.businessUrlId); 
  } else if (widgetData.businessUrlId && !Types.ObjectId.isValid(widgetData.businessUrlId)) {
    delete updatePayload.businessUrlId;
    console.warn(`Invalid businessUrlId provided for widget update: ${widgetData.businessUrlId}`);
  }
  
  const updatedWidget = await WidgetModel.findByIdAndUpdate(
    id, 
    { $set: updatePayload }, 
    { new: true }
  ).lean().exec();
  
  if (!updatedWidget) return null;

  // Manually populate business URL information and get total review count (similar to getWidgetsByUserId)
  let businessUrl = undefined;
  let totalReviewCount = 0;
  
  if (updatedWidget.businessUrlId) {
    try {
      // Get business URL from the appropriate collection
      const businessUrlData = await getBusinessUrlById(updatedWidget.businessUrlId.toString());
      if (businessUrlData) {
        businessUrl = {
          _id: businessUrlData._id.toString(),
          name: businessUrlData.name,
          source: businessUrlData.source as 'google' | 'facebook',
          url: businessUrlData.url,
        };

        // Get total review count for this business URL
        if (businessUrlData.urlHash) {
          try {
            const reviewBatch = await getReviewBatchForBusinessUrl(
              businessUrlData.urlHash,
              businessUrlData.source as 'google' | 'facebook'
            );
            if (reviewBatch && reviewBatch.reviews) {
              totalReviewCount = reviewBatch.reviews.length;
            }
          } catch (error) {
            console.error(`[Storage/updateWidget] Error fetching review count for widget ${updatedWidget._id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`[Storage/updateWidget] Error fetching business URL for widget ${updatedWidget._id}:`, error);
    }
  }

  return {
    ...updatedWidget,
    businessUrl,
    totalReviewCount,
  } as IWidget;
};
export const incrementWidgetViews = async (id: string): Promise<IWidget | null> => {
  await ensureDbConnected();
  if (!Types.ObjectId.isValid(id)) return null;
  return WidgetModel.findByIdAndUpdate(id, { $inc: { views: 1 } }, { new: true }).exec();
};
export const deleteWidget = async (id: string): Promise<{ acknowledged: boolean; deletedCount: number }> => {
  try {
    await ensureDbConnected();
    
    // Validate ObjectId
    if (!Types.ObjectId.isValid(id)) {
      console.warn(`Invalid widget ID provided for deletion: ${id}`);
      return { acknowledged: false, deletedCount: 0 };
    }

    // Delete widget from database
    const result = await WidgetModel.deleteOne({ _id: new Types.ObjectId(id) }).exec();
    
    // Log deletion result
    
    return result;
  } catch (error) {
    console.error('Error deleting widget:', error);
    throw error;
  }
};
export const getBusinessUrlStats = async (userId: string): Promise<IBusinessStats> => {
  await ensureDbConnected();
  if (!Types.ObjectId.isValid(userId)) {
    console.warn(`getBusinessUrlStats: Invalid userId provided: ${userId}`);
    return {
      totalBusinessUrls: 0,
      totalWidgets: 0,
      totalReviews: 0,
      averageRating: 0,
      totalViews: 0,
      reviewsBySource: { google: 0, facebook: 0 },
    };
  }
  const userObjId = new Types.ObjectId(userId);
  
  // Get business URLs from both models
  const [googleBusinessUrls, facebookBusinessUrls] = await Promise.all([
    GoogleBusinessUrlModel.find({ userId: userObjId }).lean().exec(),
    FacebookBusinessUrlModel.find({ userId: userObjId }).lean().exec()
  ]);
  
  const totalBusinessUrls = googleBusinessUrls.length + facebookBusinessUrls.length;
  if (totalBusinessUrls === 0) {
    return {
      totalBusinessUrls: 0, totalWidgets: 0, totalReviews: 0,
      averageRating: 0, totalViews: 0, reviewsBySource: { google: 0, facebook: 0 },
    };
  }
  
  const businessUrlObjectIds = [
    ...googleBusinessUrls.map((b: { _id: Types.ObjectId }) => b._id),
    ...facebookBusinessUrls.map((b: { _id: Types.ObjectId }) => b._id)
  ];
  
  // Get review stats from both Google and Facebook review batches
  const [googleReviewStats, facebookReviewStats] = await Promise.all([
    GoogleReviewBatchModel.aggregate<ReviewStatItem>([
      { $match: { businessUrlId: { $in: businessUrlObjectIds } } },
      { $unwind: '$reviews' },
      {
        $group: {
          _id: '$source',
          totalReviewsInSource: { $sum: 1 },
          sumOfRatings: { $sum: { $ifNull: ['$reviews.rating', 0] } }, 
          countOfRatedReviews: { $sum: { $cond: [{ $isNumber: '$reviews.rating' }, 1, 0] } }, 
        },
      },
    ]).exec(),
    FacebookReviewBatchModel.aggregate<ReviewStatItem>([
      { $match: { businessUrlId: { $in: businessUrlObjectIds } } },
      { $unwind: '$reviews' },
      {
        $group: {
          _id: '$source',
          totalReviewsInSource: { $sum: 1 },
          sumOfRatings: { $sum: { $ifNull: ['$reviews.rating', 0] } }, 
          countOfRatedReviews: { $sum: { $cond: [{ $isNumber: '$reviews.rating' }, 1, 0] } }, 
        },
      },
    ]).exec()
  ]);

  const reviewStats = [...googleReviewStats, ...facebookReviewStats];
  
  let totalReviews = 0;
  let totalSumOfRatings = 0;
  let totalCountOfRatedReviews = 0;
  const reviewsBySource: { google: number; facebook: number } = { google: 0, facebook: 0 };
  
  reviewStats.forEach((stat: ReviewStatItem) => { 
    totalReviews += stat.totalReviewsInSource || 0; 
    totalSumOfRatings += stat.sumOfRatings || 0;
    totalCountOfRatedReviews += stat.countOfRatedReviews || 0;
    if (stat._id === 'google') {
      reviewsBySource.google = stat.totalReviewsInSource || 0;
    } else if (stat._id === 'facebook') {
      reviewsBySource.facebook = stat.totalReviewsInSource || 0;
    }
  });
  
  const averageRating = totalCountOfRatedReviews > 0 ? totalSumOfRatings / totalCountOfRatedReviews : 0;
  const totalWidgets = await WidgetModel.countDocuments({ userId: userObjId }).exec();
  interface WidgetViewAggItem {
    _id: null;              
    totalViews: number | null;
  }
  const widgetViewsAgg = await WidgetModel.aggregate<WidgetViewAggItem>([
    { $match: { userId: userObjId } },
    { $group: { _id: null, totalViews: { $sum: '$views' } } },
  ]).exec();
    const totalViews = widgetViewsAgg.length > 0 && widgetViewsAgg[0].totalViews !== null
    ? widgetViewsAgg[0].totalViews
    : 0;
  return {
    totalBusinessUrls,
    totalWidgets,
    totalReviews,
    averageRating: parseFloat(averageRating.toFixed(2)),
    totalViews,
    reviewsBySource,
  };
}

export const getReviewAggregates = async (businessUrlObjectId: string, source: 'google' | 'facebook') => {
  await ensureDbConnected();
  const ModelToUse = source === 'google' ? GoogleReviewBatchModel : FacebookReviewBatchModel;
  
  const stats = await ModelToUse.aggregate([
    { $match: { businessUrlId: new Types.ObjectId(businessUrlObjectId) } },
    { $unwind: '$reviews' },
    {
      $group: {
        _id: null,
        totalReviews: { $sum: 1 },
        sumOfRatings: { $sum: '$reviews.rating' },
        countOfRatedReviews: {
          $sum: { $cond: [{ $ifNull: ['$reviews.rating', false] }, 1, 0] }
        }
      }
    }
  ]).exec();

  return stats[0] || { totalReviews: 0, sumOfRatings: 0, countOfRatedReviews: 0 };
};

interface IGoogleBusinessUrl {
  _id: Types.ObjectId;
  name: string;
  url: string;
  urlHash: string;
  userId: Types.ObjectId;
}

interface IFacebookBusinessUrl {
  _id: Types.ObjectId;
  name: string;
  url: string;
  urlHash: string;
  userId: Types.ObjectId;
}

export const findBusinessUrlByUrl = async (url: string): Promise<IBusinessUrlDisplay | null> => {
  await ensureDbConnected();
  
  // Try to find in Google Business URLs
  const googleBusinessUrl = await GoogleBusinessUrlModel.findOne({ url }).lean().exec() as IGoogleBusinessUrl | null;
  if (googleBusinessUrl) {
    return {
      _id: googleBusinessUrl._id.toString(),
      name: googleBusinessUrl.name,
      url: googleBusinessUrl.url,
      urlHash: googleBusinessUrl.urlHash,
      source: 'google'
    };
  }

  // Try to find in Facebook Business URLs
  const facebookBusinessUrl = await FacebookBusinessUrlModel.findOne({ url }).lean().exec() as IFacebookBusinessUrl | null;
  if (facebookBusinessUrl) {
    return {
      _id: facebookBusinessUrl._id.toString(),
      name: facebookBusinessUrl.name,
      url: facebookBusinessUrl.url,
      urlHash: facebookBusinessUrl.urlHash,
      source: 'facebook'
    };
  }

  return null;
};

export const getWidgetsByBusinessUrlId = async (businessUrlId: string): Promise<IWidget[]> => {
  await ensureDbConnected();
  if (!Types.ObjectId.isValid(businessUrlId)) return [];
  
  return WidgetModel.find({ businessUrlId: new Types.ObjectId(businessUrlId) })
    .sort({ createdAt: -1 })
    .lean()
    .exec();
};

export const deleteBusinessUrl = async (businessUrlId: string): Promise<void> => {
  await ensureDbConnected();
  
  // Try to delete from Google Business URLs
  const googleResult = await GoogleBusinessUrlModel.deleteOne({ _id: businessUrlId }).exec();
  
  // Try to delete from Facebook Business URLs
  const facebookResult = await FacebookBusinessUrlModel.deleteOne({ _id: businessUrlId }).exec();
  
  // If neither deletion was successful, throw an error
  if (googleResult.deletedCount === 0 && facebookResult.deletedCount === 0) {
    throw new Error('Business URL not found or could not be deleted.');
  }
};

interface PaginatedWidgetsParams {
  userId: string;
  page: number;
  limit: number;
  source?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

interface PaginatedWidgetsResult {
  widgets: IWidget[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export const getPaginatedWidgetsByUserId = async (params: PaginatedWidgetsParams): Promise<PaginatedWidgetsResult> => {
  await ensureDbConnected();
  if (!Types.ObjectId.isValid(params.userId)) {
    return {
      widgets: [],
      pagination: {
        page: params.page,
        limit: params.limit,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    };
  }


  // Build query
  // Video-review widgets are managed under Businesses (/reviews), not on My Widgets,
  // so they are excluded here.
  const query: any = { userId: new Types.ObjectId(params.userId), type: { $ne: 'video' } };

  // Add source filter if specified
  if (params.source && params.source !== 'all') {
    // For source filtering, we need to join with business URLs
    // This will be handled after the initial query
  }

  // Add search filter if specified (optimized for performance)
  if (params.search && params.search.trim()) {
    const searchTerm = params.search.trim();
    query.$or = [
      { name: { $regex: searchTerm, $options: 'i' } },
      // You can add more searchable fields here if needed
      // { description: { $regex: searchTerm, $options: 'i' } }
    ];
  }

  // Build sort object
  const sortOrder = params.sortOrder === 'asc' ? 1 : -1;
  const sort: any = {};
  sort[params.sortBy || 'createdAt'] = sortOrder;

  // Get total count for pagination
  const total = await WidgetModel.countDocuments(query);

  // Calculate pagination values
  const totalPages = Math.ceil(total / params.limit);
  const hasNext = params.page < totalPages;
  const hasPrev = params.page > 1;

  // Get paginated widgets
  const widgets = await WidgetModel.find(query)
    .sort(sort)
    .skip((params.page - 1) * params.limit)
    .limit(params.limit)
    .lean()
    .exec();

  // Manually populate business URL information and get total review count
  const populatedWidgets = await Promise.all(
    widgets.map(async (widget) => {
      let businessUrl = undefined;
      let totalReviewCount = 0;
      
      if (widget.businessUrlId) {
        try {
          // Try to get business URL from the appropriate collection
          const businessUrlData = await getBusinessUrlById(widget.businessUrlId.toString());
          if (businessUrlData) {
            // Apply source filter if specified
            if (params.source && params.source !== 'all' && businessUrlData.source !== params.source) {
              return null; // Skip this widget if it doesn't match the source filter
            }

            businessUrl = {
              _id: businessUrlData._id.toString(),
              name: businessUrlData.name,
              source: businessUrlData.source as 'google' | 'facebook',
              url: businessUrlData.url,
            };

            // Get total review count for this business URL
            if (businessUrlData.urlHash) {
              try {
                const reviewBatch = await getReviewBatchForBusinessUrl(
                  businessUrlData.urlHash,
                  businessUrlData.source as 'google' | 'facebook'
                );
                if (reviewBatch && reviewBatch.reviews) {
                  totalReviewCount = reviewBatch.reviews.length;
                }
              } catch (error) {
                console.error(`[Storage/getPaginatedWidgetsByUserId] Error fetching review count for widget ${widget._id}:`, error);
              }
            }
          }
        } catch (error) {
          console.error(`[Storage/getPaginatedWidgetsByUserId] Error fetching business URL for widget ${widget._id}:`, error);
        }
      } else if (widget.businessUrlSource) {
        // If no businessUrlId but we have businessUrlSource, create a minimal businessUrl object
        const source = widget.businessUrlSource === 'GoogleBusinessUrl' ? 'google' : 'facebook';
        
        // Apply source filter if specified
        if (params.source && params.source !== 'all' && source !== params.source) {
          return null; // Skip this widget if it doesn't match the source filter
        }

        businessUrl = {
          _id: "",
          name: widget.name, // Use widget name as fallback
          source: source,
          url: undefined,
        };

        // Try to get total review count using urlHash from widget
        if (widget.urlHash) {
          try {
            const reviewBatch = await getReviewBatchForBusinessUrl(widget.urlHash, source);
            if (reviewBatch && reviewBatch.reviews) {
              totalReviewCount = reviewBatch.reviews.length;
            }
          } catch (error) {
            console.error(`[Storage/getPaginatedWidgetsByUserId] Error fetching review count for widget ${widget._id}:`, error);
          }
        }
      } else if (widget.type === 'video') {
        // No business URL by design -- a video widget's reviews live in Supabase.
        // Leave businessUrl undefined rather than falling through to the fallback
        // below, which would label it 'google' AND float it into the Google tab,
        // since that branch never applies the source filter.
        if (params.source && params.source !== 'all' && params.source !== 'video') {
          return null;
        }
      } else {
        // A 'video' filter must not match anything that isn't a video widget.
        if (params.source === 'video') return null;
        businessUrl = {
          _id: "",
          name: widget.name, // Use widget name as fallback
          source: 'google',
          url: undefined,
        };
      }

      return {
        ...widget,
        businessUrl,
        totalReviewCount,
      } as IWidget;
    })
  );

  // Filter out null values (widgets that didn't match source filter)
  const filteredWidgets = populatedWidgets.filter(widget => widget !== null) as IWidget[];

  return {
    widgets: filteredWidgets,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasNext,
      hasPrev,
    },
  };
};