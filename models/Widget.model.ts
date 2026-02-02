import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IWidget extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  businessUrlId: Types.ObjectId;
  businessUrlSource: 'GoogleBusinessUrl' | 'FacebookBusinessUrl';
  urlHash?: string;
  name: string;
  type: string;
  maxReviews?: number;
  minRating: number;
  settings: Record<string, unknown>; 
  views: number;
  isActive?: boolean;
  themeColor?: string;
  showRatings?: boolean;
  showDates?: boolean;
  showProfilePictures?: boolean;
  businessUrl?: {
    _id: Types.ObjectId | string;
    name: string;
    url: string;
    source: 'google' | 'facebook';
  };
  initialReviewCount?: number;
  totalReviewCount?: number; // Computed field, not stored in DB
  createdAt: Date;
  updatedAt: Date;
}

const WidgetSchema: Schema<IWidget> = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  businessUrlSource: { type: String, enum: ['GoogleBusinessUrl', 'FacebookBusinessUrl'], required: true },
  businessUrlId: { type: Schema.Types.ObjectId, refPath: 'businessUrlSource', required: true, index: true },
  urlHash: { type: String, required: false, index: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['list', 'grid', 'carousel', 'badge', 'masonry', 'bar'], default: 'list' },
  maxReviews: { type: Number, default: 10, required: false },
  initialReviewCount: { type: Number, default: 12, required: false },
  minRating: { type: Number, default: 1 },
  settings: { type: Schema.Types.Mixed, default: {} },
  views: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  themeColor: { type: String, default: '#3B82F6' },
  showRatings: { type: Boolean, default: true },
  showDates: { type: Boolean, default: true },
  showProfilePictures: { type: Boolean, default: true }
}, { timestamps: true });

const WidgetModel: Model<IWidget> = mongoose.models.Widget || mongoose.model<IWidget>('Widget', WidgetSchema, 'widgets');
export default WidgetModel;