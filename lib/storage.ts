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
    const businessUrl = await BusinessUrlModel.findOne({ urlHash }).lean().exec();
    
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
    items = items.filter(review => review.rating !== undefined && review.rating >= options.minRating!);
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
export const getLatestReviews = async (
  userId: string,
  limit = 10
): Promise<Array<IReviewItem & { businessName: string; source: 'google' | 'facebook' | string; businessUrl?: string }>> => {
  console.log(`[Storage/getLatestReviews] Attempting for userId: ${userId}, limit: ${limit}`);
  await ensureDbConnected();

  if (!Types.ObjectId.isValid(userId)) {
    console.warn(`[Storage/getLatestReviews] Invalid userId: ${userId}`);
    return [];
  }
  const userIdObj = new Types.ObjectId(userId);
  console.log(`[Storage/getLatestReviews] Converted userId to ObjectId: ${userIdObj}`);

  try {
    console.log(`[Storage/getLatestReviews] Fetching GoogleBusinessUrls for userId: ${userIdObj}`);
    const userGoogleBusinessUrls = await GoogleBusinessUrlModel.find({ userId: userIdObj })
      .select('_id name url source urlHash addedAt') // Ensure urlHash is selected for old review lookup
      .lean().exec();
    console.log(`[Storage/getLatestReviews] Found ${userGoogleBusinessUrls.length} Google URLs.`);

    console.log(`[Storage/getLatestReviews] Fetching FacebookBusinessUrls for userId: ${userIdObj}`);
    const userFacebookBusinessUrls = await FacebookBusinessUrlModel.find({ userId: userIdObj })
      .select('_id name url source urlHash addedAt') // Ensure urlHash is selected
      .lean().exec();
    console.log(`[Storage/getLatestReviews] Found ${userFacebookBusinessUrls.length} Facebook URLs.`);

    const allUserBusinessUrls = [
        ...(userGoogleBusinessUrls as IBusinessUrl[]), // Cast to ensure type compatibility
        ...(userFacebookBusinessUrls as IBusinessUrl[])
    ];
    console.log(`[Storage/getLatestReviews] Total business URLs for user: ${allUserBusinessUrls.length}`);

    if (allUserBusinessUrls.length === 0) {
      console.log("[Storage/getLatestReviews] No business URLs found for user, returning empty array.");
      return [];
    }

    const results: Array<IReviewItem & { businessName: string; source: 'google' | 'facebook' | string; businessUrl?: string }> = [];

    for (const bizUrl of allUserBusinessUrls) {
      if (!bizUrl._id) {
        console.warn("[Storage/getLatestReviews] Skipping bizUrl due to missing _id:", bizUrl);
        continue;
      }
      // Ensure bizUrl.source is reliable, default if necessary for model selection
      const source = bizUrl.source || (bizUrl.url.includes('facebook.com') ? 'facebook' : 'google');
      console.log(`[Storage/getLatestReviews] Processing bizUrl: "${bizUrl.name}" (ID: ${bizUrl._id}, Source: ${source}, Hash: ${bizUrl.urlHash})`);

      const ReviewModelToUse = source === 'google' ? GoogleReviewBatchModel : FacebookReviewBatchModel;

      let reviewBatch = await ReviewModelToUse.findOne({ businessUrlId: bizUrl._id }) // Try new link
        .sort({ lastScrapedAt: -1 })
        .lean().exec();

      if (!reviewBatch && bizUrl.urlHash) { // Fallback to old link
        console.log(`[Storage/getLatestReviews] No batch by businessUrlId for "${bizUrl.name}", trying urlHash: ${bizUrl.urlHash}`);
        reviewBatch = await ReviewModelToUse.findOne({ urlHash: bizUrl.urlHash })
          .sort({ lastScrapedAt: -1 }) // or timestamp for google old data
          .lean().exec();
      }

      if (reviewBatch && reviewBatch.reviews && reviewBatch.reviews.length > 0) {
        console.log(`[Storage/getLatestReviews] Found ${reviewBatch.reviews.length} reviews in batch for "${bizUrl.name}"`);
        const reviewsFromBatch = reviewBatch.reviews.map(r => ({
          ...r,
          businessName: bizUrl.name,
          source: source, // Use determined source
          businessUrl: bizUrl.url,
        }));
        results.push(...reviewsFromBatch);
      } else {
        console.log(`[Storage/getLatestReviews] No reviews in batch for "${bizUrl.name}" (Source: ${source})`);
      }
    }

    console.log(`[Storage/getLatestReviews] Total reviews collected before sort/limit: ${results.length}`);

    results.sort((a, b) => {
      const dateA = a.scrapedAt || (a.postedAt && !isNaN(new Date(a.postedAt).getTime()) ? new Date(a.postedAt) : null);
      const dateB = b.scrapedAt || (b.postedAt && !isNaN(new Date(b.postedAt).getTime()) ? new Date(b.postedAt) : null);
      if (dateA && dateB) {
        return dateB.getTime() - dateA.getTime(); // Most recent first
      }
      if (dateA) return -1; // Put items with dates first
      if (dateB) return 1;
      return 0;
    });

    console.log(`[Storage/getLatestReviews] Returning ${results.slice(0, limit).length} reviews after slicing.`);
    return results.slice(0, limit);

  } catch (dbError: unknown) {
    const err = dbError as Error;
    console.error(`[Storage/getLatestReviews] DB Error for userId ${userId}:`, err.message, err.stack);
    throw new Error(`Database error in getLatestReviews: ${err.message}`); // Re-throw a new error or the original
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

  // Manually populate business URL information
  const populatedWidgets = await Promise.all(
    widgets.map(async (widget) => {
      let businessUrl = undefined;
      
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
          }
        } catch (error) {
          console.error(`[Storage/getWidgetsByUserId] Error fetching business URL for widget ${widget._id}:`, error);
        }
      } else if (widget.businessUrlSource) {
        // If no businessUrlId but we have businessUrlSource, create a minimal businessUrl object
        businessUrl = {
          _id: "",
          name: widget.name, // Use widget name as fallback
          source: (widget.businessUrlSource === 'GoogleBusinessUrl' ? 'google' : 'facebook') as 'google' | 'facebook',
          url: undefined,
        };
      }

      return {
        ...widget,
        businessUrl,
      } as IWidget;
    })
  );

  return populatedWidgets;
};
interface CreateWidgetArgs {
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
  return WidgetModel.findByIdAndUpdate(id, { $set: updatePayload }, { new: true }).lean().exec();
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
  userId: Types.ObjectId;
}

interface IFacebookBusinessUrl {
  _id: Types.ObjectId;
  name: string;
  url: string;
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