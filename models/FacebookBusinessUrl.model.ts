import mongoose, { Schema, Document, Model, Types } from 'mongoose';

/** The link to a Video Review Manager tenant, once video reviews are enabled. */
export interface IBusinessUrlVideo {
  tenantId: string;
  slug: string;
  embedKey: string;
  collectUrl: string;
}

/** Editable contact and branding details. See GoogleBusinessUrl.model for the full note. */
export interface IBusinessUrlDetails {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  brandColor?: string;
  logoUrl?: string;
}

export interface IFacebookBusinessUrl extends Document { // Can be similar to IGoogleBusinessUrl
  _id: Types.ObjectId;
  name: string;
  url: string;
  urlHash: string;
  addedAt?: Date;
  lastScrapedAt?: Date;

  userId?: Types.ObjectId | null;
  source: 'facebook';
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

const FacebookBusinessUrlSchema: Schema<IFacebookBusinessUrl> = new Schema({
  name: { type: String, required: true },
  url: { type: String, required: true },
  urlHash: { type: String, required: true, index: true },
  addedAt: { type: Date, default: Date.now },
  lastScrapedAt: { type: Date },
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true, sparse: true },
  source: { type: String, default: 'facebook', enum: ['facebook'], required: true },
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

const FacebookBusinessUrlModel: Model<IFacebookBusinessUrl> =
  mongoose.models.FacebookBusinessUrl ||
  mongoose.model<IFacebookBusinessUrl>('FacebookBusinessUrl', FacebookBusinessUrlSchema, 'facebook_business_urls'); // COLLECTION NAME

export default FacebookBusinessUrlModel;