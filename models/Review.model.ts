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
} 

const ReviewItemSchema: Schema<IReviewItem> = new Schema({
  reviewId: { type: String, index: true },
  author: { type: String, required: true },
  content: { type: String, required: true },
  rating: { type: Number },
  postedAt: { type: String, required: true }, 
  profilePicture: { type: String },
  recommendationStatus: { type: String },
  userProfile: { type: String },
  scrapedAt: { type: Date },
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
}

const ReviewBatchSchemaBaseFields = {
  urlHash: { type: String, required: true, index: true },
  url: { type: String },
  reviews: [ReviewItemSchema],
  lastScrapedAt: { type: Schema.Types.Mixed }, 
  timestamp: { type: Date },
  businessUrlId: { type: Schema.Types.ObjectId, ref: 'UnifiedBusinessUrl', index: true, sparse: true, required: false }, 
  source: { type: String, enum: ['google', 'facebook'], required: false },
};

const GoogleReviewBatchSchema: Schema<IReviewBatch> = new Schema(ReviewBatchSchemaBaseFields);
const FacebookReviewBatchSchema: Schema<IReviewBatch> = new Schema(ReviewBatchSchemaBaseFields);

const GoogleReviewBatchModel: Model<IReviewBatch> =
  mongoose.models.GoogleReviewBatch || 
  mongoose.model<IReviewBatch>('GoogleReviewBatch', GoogleReviewBatchSchema, 'business_reviews'); 

const FacebookReviewBatchModel: Model<IReviewBatch> =
  mongoose.models.FacebookReviewBatch || 
  mongoose.model<IReviewBatch>('FacebookReviewBatch', FacebookReviewBatchSchema, 'facebook_reviews');

// New: Single review document model
export interface IReviewDoc extends Document {
  businessUrlId: Types.ObjectId;
  urlHash: string;
  source: 'google' | 'facebook';
  reviewId?: string;
  author: string;
  content: string;
  rating?: number;
  postedAt: string;
  profilePicture?: string;
  recommendationStatus?: string;
  userProfile?: string;
  scrapedAt?: Date;
}

const ReviewDocSchema: Schema<IReviewDoc> = new Schema({
  businessUrlId: { type: Schema.Types.ObjectId, ref: 'UnifiedBusinessUrl', required: true, index: true },
  urlHash: { type: String, required: true, index: true },
  source: { type: String, enum: ['google', 'facebook'], required: true },
  reviewId: { type: String },
  author: { type: String },
  content: { type: String },
  rating: { type: Number },
  postedAt: { type: String },
  profilePicture: { type: String },
  recommendationStatus: { type: String },
  userProfile: { type: String },
  scrapedAt: { type: Date },
});

const ReviewModel: Model<IReviewDoc> =
  mongoose.models.Review || mongoose.model<IReviewDoc>('Review', ReviewDocSchema, 'reviews');

export { GoogleReviewBatchModel, FacebookReviewBatchModel, ReviewModel };