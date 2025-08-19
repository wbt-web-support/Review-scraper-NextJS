import dbConnect from './mongodb';
import UserModel, { IUser } from '../models/User.model';
import { IBusinessUrl } from '../models/BusinessUrl.model';
import { GoogleReviewBatchModel, FacebookReviewBatchModel, type IReviewBatch, IReviewItem } from '../models/Review.model';
import GoogleBusinessUrlModel from '../models/GoogleBusinessUrl.model';
import FacebookBusinessUrlModel from '../models/FacebookBusinessUrl.model';
import WidgetModel, { IWidget } from '../models/Widget.model';
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
    console.log(`[Storage/clearLatestReviewsCache] Cleared cache for user: ${userId}`);
  } else {
    // Clear all cache
    latestReviewsCache.clear();
    console.log('[Storage/clearLatestReviewsCache] Cleared all latest reviews cache');
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
  console.log(`[Storage/getBusinessUrlById] Searching for ID: ${id}`);
  
  // Try Google first - use correct collection name
  const googleBusinessUrl = await GoogleBusinessUrlModel.findById(id).lean().exec();
  if (googleBusinessUrl) {
    console.log(`[Storage/getBusinessUrlById] Found in GoogleBusinessUrlModel:`, googleBusinessUrl.name);
    return {
      ...googleBusinessUrl,
      source: 'google' as const
    };
  }

  // Try Facebook if not found in Google - use correct collection name
  console.log(`[Storage/getBusinessUrlById] Not in Google, trying FacebookBusinessUrlModel for ID: ${id}`);
  const facebookBusinessUrl = await FacebookBusinessUrlModel.findById(id).lean().exec();
  if (facebookBusinessUrl) {
    console.log(`[Storage/getBusinessUrlById] Found in FacebookBusinessUrlModel:`, facebookBusinessUrl.name);
    return {
      ...facebookBusinessUrl,
      source: 'facebook' as const
    };
  }

  console.log(`[Storage/getBusinessUrlById] ID ${id} not found in any business URL collection.`);
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
  console.log(`[Storage/getBusinessUrlsByUserId] Fetching URLs for userId (ObjectId): ${userIdObj}`);

  try {
    const googleUrlsRaw = await GoogleBusinessUrlModel.find({ userId: userIdObj })
      .sort({ addedAt: -1 })
      .lean()
      .exec();
    console.log(`[Storage/getBusinessUrlsByUserId] Found ${googleUrlsRaw.length} Google URLs.`);

    const facebookUrlsRaw = await FacebookBusinessUrlModel.find({ userId: userIdObj })
      .sort({ addedAt: -1 })
      .lean()
      .exec();
    console.log(`[Storage/getBusinessUrlsByUserId] Found ${facebookUrlsRaw.length} Facebook URLs.`);

    const googleUrls: IBusinessUrlDisplay[] = googleUrlsRaw.map(doc => ({
      _id: doc._id.toString(),
      name: doc.name,
      url: doc.url,
      urlHash: doc.urlHash,
      source: 'google' as const,
      userId: doc.userId?.toString(),
    }));

    const facebookUrls: IBusinessUrlDisplay[] = facebookUrlsRaw.map(doc => ({
      _id: doc._id.toString(),
      name: doc.name,
      url: doc.url,
      urlHash: doc.urlHash,
      source: 'facebook' as const,
      userId: doc.userId?.toString(),
    }));

    const combinedUrls = [...googleUrls, ...facebookUrls];
    console.log(`[Storage/getBusinessUrlsByUserId] Combined ${combinedUrls.length} URLs for userId: ${userId}`);
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
}
export const getAllBusinessUrlsForDisplay = async (): Promise<IBusinessUrlDisplay[]> => {
  await ensureDbConnected();
  console.log("[Storage/getAllBusinessUrlsForDisplay] Fetching all business URLs for display");

  try {
    const googleUrlsRaw = await GoogleBusinessUrlModel.find()
      .sort({ addedAt: -1 })
      .lean()
      .exec();
    console.log(`[Storage/getAllBusinessUrlsForDisplay] Found ${googleUrlsRaw.length} Google URLs.`);

    const facebookUrlsRaw = await FacebookBusinessUrlModel.find()
      .sort({ addedAt: -1 })
      .lean()
      .exec();
    console.log(`[Storage/getAllBusinessUrlsForDisplay] Found ${facebookUrlsRaw.length} Facebook URLs.`);

    const googleUrls: IBusinessUrlDisplay[] = googleUrlsRaw.map(doc => ({
      _id: doc._id.toString(),
      name: doc.name,
      url: doc.url,
      urlHash: doc.urlHash,
      source: 'google' as const,
      userId: doc.userId?.toString(),
    }));

    const facebookUrls: IBusinessUrlDisplay[] = facebookUrlsRaw.map(doc => ({
      _id: doc._id.toString(),
      name: doc.name,
      url: doc.url,
      urlHash: doc.urlHash,
      source: 'facebook' as const,
      userId: doc.userId?.toString(),
    }));

    const combinedUrls = [...googleUrls, ...facebookUrls];
    console.log(`[Storage/getAllBusinessUrlsForDisplay] Combined ${combinedUrls.length} URLs for display`);
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
  };
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
}
export const getReviewBatchForBusinessUrl = async (
  urlHash: string,
  source: 'google' | 'facebook'
): Promise<IReviewBatch | null> => {
  await ensureDbConnected();
  const ModelToUse = source === 'google' ? GoogleReviewBatchModel : FacebookReviewBatchModel;
  
  // First try to find by urlHash
  let reviewBatch = await ModelToUse.findOne({ urlHash }).lean().exec();
  
  // If not found by urlHash, try to find the business URL and then look up by businessUrlId
  if (!reviewBatch) {
    console.log(`[getReviewBatchForBusinessUrl] No batch found by urlHash ${urlHash}, trying businessUrlId lookup`);
    
    // Find the business URL by urlHash to get the businessUrlId
    const BusinessUrlModel = source === 'google' ? GoogleBusinessUrlModel : FacebookBusinessUrlModel;
    const businessUrl = await (BusinessUrlModel as any).findOne({ urlHash }).lean().exec();
    
    if (businessUrl) {
      console.log(`[getReviewBatchForBusinessUrl] Found business URL with ID ${businessUrl._id}, looking for reviews`);
      reviewBatch = await ModelToUse.findOne({ businessUrlId: businessUrl._id }).lean().exec();
    }
  }
  
  if (!reviewBatch) {
    return null;
  }
  
  // Add source to each review in the batch
  const reviewsWithSource = reviewBatch.reviews?.map(review => ({
    ...review,
    source
  })) || [];
  
  return { 
    ...reviewBatch, 
    source,
    reviews: reviewsWithSource
  };
};
export const getFilteredReviewsFromBatch = (
  reviewBatch: IReviewBatch | null,
  options: GetReviewsOptions = {}
): IReviewItem[] => {
  if (!reviewBatch || !reviewBatch.reviews || reviewBatch.reviews.length === 0) {
    return [];
  }
  let items = reviewBatch.reviews;
  if (options.minRating !== undefined) {
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
  }
  const offset = options.offset || 0;
  if (options.limit !== undefined) {
    items = items.slice(offset, offset + options.limit);
  } else if (offset > 0) {
    items = items.slice(offset);
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
  if (data.source === 'facebook') {
    throw new Error("upsertReviews should NOT be used for Facebook reviews. Use mergeNewReviews instead to avoid duplicate urlHash errors.");
  }
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
export const mergeNewReviews = async (data: UpsertReviewsArgs): Promise<IReviewBatch> => {
  await ensureDbConnected();
  if (!Types.ObjectId.isValid(data.businessUrlId)) throw new Error("Invalid businessUrlId for mergeNewReviews");
  
  const ReviewModelToUse = data.source === 'google' ? GoogleReviewBatchModel : FacebookReviewBatchModel;
  
  // Find existing review batch by businessUrlId
  let existingBatch = await ReviewModelToUse.findOne({ 
    businessUrlId: new Types.ObjectId(data.businessUrlId), 
    source: data.source 
  }).exec();

  // If not found, try to find by urlHash (to avoid duplicate key error)
  if (!existingBatch) {
    existingBatch = await ReviewModelToUse.findOne({ urlHash: data.urlHash, source: data.source }).exec();
  }

  if (!existingBatch) {
    // If still not found, create new batch
    console.log(`[Storage/mergeNewReviews] No existing batch found for businessUrlId: ${data.businessUrlId} or urlHash: ${data.urlHash}, creating new batch with ${data.reviews.length} reviews`);
    const newBatch = await ReviewModelToUse.create({
      businessUrlId: new Types.ObjectId(data.businessUrlId),
      url: data.url,
      urlHash: data.urlHash,
      reviews: data.reviews,
      lastScrapedAt: new Date(),
      source: data.source
    });
    if (!newBatch) {
      throw new Error("Failed to create new review batch");
    }
    return newBatch;
  }

  // Clean existing reviews: remove any with missing or empty content
  existingBatch.reviews = existingBatch.reviews.filter(
    review => typeof review.content === 'string' && review.content.trim().length > 0
  );

  // Merge new reviews with existing ones
  const existingReviewIds = new Set(existingBatch.reviews.map(review => review.reviewId));
  // Also filter new reviews for valid content (defensive)
  const newReviews = data.reviews.filter(
    review => !existingReviewIds.has(review.reviewId) && typeof review.content === 'string' && review.content.trim().length > 0
  );
  
  console.log(`[Storage/mergeNewReviews] Existing batch has ${existingBatch.reviews.length} reviews, ${data.reviews.length} new reviews provided, ${newReviews.length} are actually new`);

  if (newReviews.length === 0) {
    // No new reviews, just update the lastScrapedAt timestamp and url/urlHash
    existingBatch.lastScrapedAt = new Date();
    existingBatch.url = data.url;
    existingBatch.urlHash = data.urlHash;
    await existingBatch.save();
    return existingBatch;
  }

  // Add new reviews to existing batch
  existingBatch.reviews = [...existingBatch.reviews, ...newReviews];
  existingBatch.lastScrapedAt = new Date();
  existingBatch.url = data.url;
  existingBatch.urlHash = data.urlHash;
  await existingBatch.save();
  return existingBatch;
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
      console.log(`[Storage/getLatestReviewDateForBusiness] No reviews found for businessUrlId: ${businessUrlId}, source: ${source}`);
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

    console.log(`[Storage/getLatestReviewDateForBusiness] Latest review date for businessUrlId: ${businessUrlId}, source: ${source}: ${latestDate}`);
    return latestDate;
    
  } catch (error) {
    console.error(`[Storage/getLatestReviewDateForBusiness] Error getting latest review date for businessUrlId: ${businessUrlId}, source: ${source}:`, error);
    return null;
  }
};

export const getLatestReviews = async (
  userId: string,
  limit = 10
): Promise<{ data: Array<IReviewItem & { businessName: string; source: 'google' | 'facebook' | string; businessUrl?: string }>, cacheHit: boolean }> => {
  console.log(`[Storage/getLatestReviews] Attempting for userId: ${userId}, limit: ${limit}`);
  await ensureDbConnected();

  if (!Types.ObjectId.isValid(userId)) {
    console.warn(`[Storage/getLatestReviews] Invalid userId: ${userId}`);
    return { data: [], cacheHit: false };
  }

  // Check cache first
  const cacheKey = `${userId}:${limit}`;
  const cached = latestReviewsCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    console.log(`[Storage/getLatestReviews] Returning cached results for ${cacheKey}`);
    return { data: cached.data, cacheHit: true };
  }

  const userIdObj = new Types.ObjectId(userId);
  console.log(`[Storage/getLatestReviews] Converted userId to ObjectId: ${userIdObj}`);

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

    console.log(`[Storage/getLatestReviews] Returning ${finalResults.length} reviews after optimization.`);
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
export const getWidgetsByUserId = async (userId: string): Promise<IWidget[]> => {
  await ensureDbConnected();
  if (!Types.ObjectId.isValid(userId)) return [];
  console.log(`[Storage/getWidgetsByUserId] Fetching widgets for userId: ${userId}`);
  
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
  businessUrlId: string;
  businessUrlSource: 'GoogleBusinessUrl' | 'FacebookBusinessUrl';
  urlHash: string;
  name: string;
  type?: "grid" | "carousel" | "list" | "masonry" | "badge";
  minRating?: number;
  themeColor?: string;
  showRatings?: boolean;
  showDates?: boolean;
  showProfilePictures?: boolean;
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
  console.log("[Storage/createWidget] Received data:", widgetData);
  const newWidgetDocumentData = {
    userId: new Types.ObjectId(widgetData.userId),
    businessUrlId: new Types.ObjectId(widgetData.businessUrlId),
    businessUrlSource: widgetData.businessUrlSource,
    urlHash: widgetData.urlHash,
    name: widgetData.name,
    type: widgetData.type || 'grid', 
    minRating: widgetData.minRating ?? 0,
    themeColor: widgetData.themeColor || '#3B82F6',
    showRatings: widgetData.showRatings ?? true,
    showDates: widgetData.showDates ?? true,
    showProfilePictures: widgetData.showProfilePictures ?? true,
    views: 0,
  };
  console.log("[Storage/createWidget] Data for new WidgetModel:", newWidgetDocumentData);
  const newWidget = new WidgetModel(newWidgetDocumentData);
  const savedWidget = await newWidget.save();
  console.log("[Storage/createWidget] Widget saved:", savedWidget);
  return savedWidget.toObject({ getters: true, virtuals: false }) as IWidget; 
};
interface UpdateWidgetArgs {
  name?: string;
  type?: string;
  maxReviews?: number;
  minRating?: number;
  businessUrlId?: string;
  themeColor?: string;
  showRatings?: boolean;
  showDates?: boolean;
  showProfilePictures?: boolean;
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
    console.log(`Widget deletion result for ID ${id}:`, result);
    
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

  console.log(`[Storage/getPaginatedWidgetsByUserId] Fetching widgets for userId: ${params.userId}`, params);

  // Build query
  const query: any = { userId: new Types.ObjectId(params.userId) };

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