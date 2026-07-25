import mongoose, { Schema, Document, Model, Types } from 'mongoose';

/** The link to a Video Review Manager tenant, once video reviews are enabled. */
export interface IBusinessUrlVideo {
  tenantId: string;
  slug: string;
  embedKey: string;
  collectUrl: string;
}

/**
 * Editable contact and branding details for the business. The scraper app owns these;
 * when video reviews are enabled they are also mirrored onto the Supabase tenant so the
 * collection page reflects them. firstName/lastName live only here -- the tenant has no
 * columns for them.
 */
export interface IBusinessUrlDetails {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  brandColor?: string;
  logoUrl?: string;
}

export interface IGoogleBusinessUrl extends Document {
  _id: Types.ObjectId;
  name: string;
  url: string;
  urlHash: string;
  addedAt?: Date;
  lastScrapedAt?: Date;
  userId?: Types.ObjectId | null;
  source: 'google';
  video?: IBusinessUrlVideo;
  details?: IBusinessUrlDetails;
}

const BusinessUrlDetailsSchema = new Schema<IBusinessUrlDetails>({
  firstName: { type: String },
  lastName: { type: String },
  email: { type: String },
  phone: { type: String },
  brandColor: { type: String },
  logoUrl: { type: String },
}, { _id: false });

const GoogleBusinessUrlSchema: Schema<IGoogleBusinessUrl> = new Schema({
  name: { type: String, required: true },
  url: { type: String, required: true },
  urlHash: { type: String, required: true, index: true },
  addedAt: { type: Date, default: Date.now },
  lastScrapedAt: { type: Date },
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true, sparse: true },
  source: { type: String, default: 'google', enum: ['google'], required: true },
  video: {
    type: new Schema<IBusinessUrlVideo>({
      tenantId: { type: String, required: true },
      slug: { type: String, required: true },
      embedKey: { type: String, required: true },
      collectUrl: { type: String, required: true },
    }, { _id: false }),
    required: false,
  },
  details: { type: BusinessUrlDetailsSchema, required: false },
}, { timestamps: { createdAt: 'addedAt', updatedAt: true } });

const GoogleBusinessUrlModel: Model<IGoogleBusinessUrl> =
mongoose.models.GoogleBusinessUrl || mongoose.model<IGoogleBusinessUrl>('GoogleBusinessUrl', GoogleBusinessUrlSchema, 'business_urls');

export default GoogleBusinessUrlModel;