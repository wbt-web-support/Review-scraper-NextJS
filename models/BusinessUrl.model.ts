import mongoose, { Schema, Document, Model, Types } from 'mongoose';

/**
 * The link a scraped business keeps to its Video Review Manager tenant in Supabase.
 * Present once video reviews have been set up for the business (either at creation or
 * enabled later); absent otherwise. The tenant, its reviews, login and settings all
 * live in Postgres -- these four fields are the whole bridge. Same shape as a video
 * widget's `video` subdoc, on purpose.
 */
export interface IBusinessUrlVideo {
  tenantId: string;
  slug: string;
  embedKey: string;
  collectUrl: string;
}

/** Editable contact and branding details. See GoogleBusinessUrl.model for the note. */
export interface IBusinessUrlDetails {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  brandColor?: string;
  logoUrl?: string;
}

export interface IBusinessUrl extends Document {
  _id: Types.ObjectId;
  userId?: Types.ObjectId | null;
  name: string;
  url: string;
  urlHash: string;
  source?: 'google' | 'facebook' | string;
  video?: IBusinessUrlVideo;
  details?: IBusinessUrlDetails;
  addedAt?: Date;
  lastScrapedAt?: Date;
}
const BusinessUrlSchema: Schema<IBusinessUrl> = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true, sparse: true },
  name: { type: String, required: true },
  url: { type: String, required: true },
  urlHash: { type: String, required: true, index: true },
  source: { type: String, enum: ['google', 'facebook', undefined, null] },
  video: {
    type: new Schema<IBusinessUrlVideo>({
      tenantId: { type: String, required: true },
      slug: { type: String, required: true },
      embedKey: { type: String, required: true },
      collectUrl: { type: String, required: true },
    }, { _id: false }),
    required: false,
  },
  details: {
    type: new Schema<IBusinessUrlDetails>({
      firstName: { type: String },
      lastName: { type: String },
      email: { type: String },
      phone: { type: String },
      brandColor: { type: String },
      logoUrl: { type: String },
    }, { _id: false }),
    required: false,
  },
  addedAt: { type: Date, default: Date.now },
  lastScrapedAt: { type: Date },
});
const GoogleBusinessUrlModel: Model<IBusinessUrl> = mongoose.models.GoogleBusinessUrl || mongoose.model<IBusinessUrl>('GoogleBusinessUrl', BusinessUrlSchema, 'business_urls'); 
const FacebookBusinessUrlModel: Model<IBusinessUrl> = mongoose.models.FacebookBusinessUrl || mongoose.model<IBusinessUrl>('FacebookBusinessUrl', BusinessUrlSchema, 'facebook_business_urls');
export { GoogleBusinessUrlModel, FacebookBusinessUrlModel };