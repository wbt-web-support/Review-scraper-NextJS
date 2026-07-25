import mongoose, { Schema, Document, Model, Types } from 'mongoose';

/**
 * A video widget is backed by a Video Review Manager tenant in Supabase, not by a
 * scraped business URL. This is the only link between the two halves of the app --
 * everything else about the tenant (reviews, settings, domain) lives in Postgres and
 * is reached through these identifiers.
 */
export interface IWidgetVideoTenant {
  /** tenants.id in Supabase. */
  tenantId: string;
  /** Drives /c/<slug> and the tenant's subdomain. */
  slug: string;
  /** Goes in the embed snippet as data-tenant. */
  embedKey: string;
  /** Where "Leave a review" sends people, at the time the widget was created. */
  collectUrl: string;
}

export interface IWidget extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  /** Absent on video widgets, which have a Supabase tenant instead. */
  businessUrlId?: Types.ObjectId;
  businessUrlSource?: 'GoogleBusinessUrl' | 'FacebookBusinessUrl';
  urlHash?: string;
  /** Set only when type === 'video'. */
  video?: IWidgetVideoTenant;
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

/**
 * A video widget has no scraped business URL to point at -- its reviews come from a
 * Supabase tenant. So the business-URL fields are required for every OTHER type and
 * optional for this one.
 *
 * Written as a function rather than dropping `required` altogether so the scraper
 * widgets keep the exact validation they have always had: a grid widget with no
 * business URL is still a hard validation error, same as before.
 */
function requiredUnlessVideo(this: IWidget): boolean {
  return this.type !== 'video';
}

const WidgetSchema: Schema<IWidget> = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  businessUrlSource: { type: String, enum: ['GoogleBusinessUrl', 'FacebookBusinessUrl'], required: requiredUnlessVideo },
  businessUrlId: { type: Schema.Types.ObjectId, refPath: 'businessUrlSource', required: requiredUnlessVideo, index: true },
  urlHash: { type: String, required: false, index: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['list', 'grid', 'carousel', 'badge', 'masonry', 'bar', 'video'], default: 'list' },
  video: {
    type: new Schema<IWidgetVideoTenant>({
      tenantId: { type: String, required: true },
      slug: { type: String, required: true },
      embedKey: { type: String, required: true },
      collectUrl: { type: String, required: true },
    }, { _id: false }),
    required: false,
  },
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