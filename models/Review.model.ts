import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IReviewItem {
  reviewId?: string; 
  author: string;
  content: string;
  rating?: number;
  postedAt: string; 
  profilePicture?: string; 
  recommendationStatus?: string; 
  userProfile?: string; 
  scrapedAt?: Date; 
  /**
   * Service categories: keys from the business's list (see lib/reviewCategories).
   * Absent or empty means general feedback that names no service; the feed shows
   * those under every category as well as under "All".
   */
  categories?: string[];
  /** How the categories were set. Manual tags are never overwritten by the rules. */
  categorySource?: 'rule' | 'manual';
  /** Fingerprint of the rules used, so an edit to the words redoes only stale reviews. */
  categoryRulesVersion?: string;
  /** The business's public reply on the platform, when it has one. */
  ownerReply?: string;
  ownerReplyAt?: string;
  /** Google: what the reviewer picked when asked, e.g. { Service: "Boiler installation" }. */
  reviewContext?: Record<string, unknown>;
  reviewDetailedRating?: Record<string, unknown>;
  imageUrls?: string[];
  likesCount?: number;
  reviewUrl?: string;
  textTranslated?: string;
  language?: string;
  /** Facebook: the tags the reviewer picked. */
  tags?: string[];
  /** Everything else the scraper returned about this review, kept as it came. */
  raw?: Record<string, unknown>;
} 

const ReviewItemSchema: Schema<IReviewItem> = new Schema({
  reviewId: { type: String, index: true },
  author: { type: String, required: true },
  content: { type: String, required: false }, // Changed from required: true to allow empty content
  rating: { type: Number },
  postedAt: { type: String, required: true }, 
  profilePicture: { type: String },
  recommendationStatus: { type: String },
  userProfile: { type: String },
  scrapedAt: { type: Date },
  // `default: undefined` on the arrays: Mongoose would otherwise write an empty
  // array onto every review, and an absent field is what "general" means.
  categories: { type: [String], default: undefined },
  categorySource: { type: String, enum: ['rule', 'manual'], required: false },
  categoryRulesVersion: { type: String },
  ownerReply: { type: String },
  ownerReplyAt: { type: String },
  reviewContext: { type: Schema.Types.Mixed },
  reviewDetailedRating: { type: Schema.Types.Mixed },
  imageUrls: { type: [String], default: undefined },
  likesCount: { type: Number },
  reviewUrl: { type: String },
  textTranslated: { type: String },
  language: { type: String },
  tags: { type: [String], default: undefined },
  raw: { type: Schema.Types.Mixed },
}, { _id: false }); 

export interface IReviewBatch extends Document {
  _id: Types.ObjectId;
  urlHash: string;
  url?: string;   
  reviews: IReviewItem[];
  lastScrapedAt?: Date;
  timestamp?: Date;
  businessUrlId?: Types.ObjectId | null;
  source?: 'google' | 'facebook';  
  /**
   * What the scraper says about the business itself (address, Google's own review
   * count and average, categories...). The same on every review it returns, so it
   * is kept once here rather than repeated on each review.
   */
  place?: Record<string, unknown>;
  placeUpdatedAt?: Date;
}

const ReviewBatchSchemaBaseFields = {
  urlHash: { type: String, required: true, index: true },
  url: { type: String },
  reviews: [ReviewItemSchema],
  lastScrapedAt: { type: Schema.Types.Mixed }, 
  timestamp: { type: Date },
  businessUrlId: { type: Schema.Types.ObjectId, ref: 'UnifiedBusinessUrl', index: true, sparse: true, required: false }, 
  source: { type: String, enum: ['google', 'facebook'], required: false },
  place: { type: Schema.Types.Mixed, required: false },
  placeUpdatedAt: { type: Date, required: false },
};

const GoogleReviewBatchSchema: Schema<IReviewBatch> = new Schema(ReviewBatchSchemaBaseFields);
const FacebookReviewBatchSchema: Schema<IReviewBatch> = new Schema(ReviewBatchSchemaBaseFields);

const GoogleReviewBatchModel: Model<IReviewBatch> =
  mongoose.models.GoogleReviewBatch || 
  mongoose.model<IReviewBatch>('GoogleReviewBatch', GoogleReviewBatchSchema, 'business_reviews'); 

const FacebookReviewBatchModel: Model<IReviewBatch> =
  mongoose.models.FacebookReviewBatch || 
  mongoose.model<IReviewBatch>('FacebookReviewBatch', FacebookReviewBatchSchema, 'facebook_reviews');

export { GoogleReviewBatchModel, FacebookReviewBatchModel };
