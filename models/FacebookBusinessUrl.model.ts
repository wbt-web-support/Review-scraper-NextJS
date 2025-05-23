import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IFacebookBusinessUrl extends Document { // Can be similar to IGoogleBusinessUrl
  _id: Types.ObjectId;
  name: string;
  url: string;
  urlHash: string;
  addedAt?: Date;
  lastScrapedAt?: Date;

  userId?: Types.ObjectId | null;
  source: 'facebook';
}

const FacebookBusinessUrlSchema: Schema<IFacebookBusinessUrl> = new Schema({
  name: { type: String, required: true },
  url: { type: String, required: true },
  urlHash: { type: String, required: true, index: true },
  addedAt: { type: Date, default: Date.now },
  lastScrapedAt: { type: Date }, 
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true, sparse: true },
  source: { type: String, default: 'facebook', enum: ['facebook'], required: true },
}, { timestamps: { createdAt: 'addedAt', updatedAt: true } });

const FacebookBusinessUrlModel: Model<IFacebookBusinessUrl> =
  mongoose.models.FacebookBusinessUrl ||
  mongoose.model<IFacebookBusinessUrl>('FacebookBusinessUrl', FacebookBusinessUrlSchema, 'facebook_business_urls'); // COLLECTION NAME

export default FacebookBusinessUrlModel;