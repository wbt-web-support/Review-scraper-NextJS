import mongoose, { Schema, Document, Model, Types } from 'mongoose';
export interface IBusinessUrl extends Document {
  _id: Types.ObjectId;
  userId?: Types.ObjectId | null; 
  name: string;
  url: string;
  urlHash: string; 
  source?: 'google' | 'facebook' | string; 
  addedAt?: Date;
  lastScrapedAt?: Date;
}
const BusinessUrlSchema: Schema<IBusinessUrl> = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true, sparse: true }, 
  name: { type: String, required: true },
  url: { type: String, required: true },
  urlHash: { type: String, required: true, index: true }, 
  source: { type: String, enum: ['google', 'facebook', undefined, null] }, 
  addedAt: { type: Date, default: Date.now },
  lastScrapedAt: { type: Date },
});
const GoogleBusinessUrlModel: Model<IBusinessUrl> = mongoose.models.GoogleBusinessUrl || mongoose.model<IBusinessUrl>('GoogleBusinessUrl', BusinessUrlSchema, 'business_urls'); 
const FacebookBusinessUrlModel: Model<IBusinessUrl> = mongoose.models.FacebookBusinessUrl || mongoose.model<IBusinessUrl>('FacebookBusinessUrl', BusinessUrlSchema, 'facebook_business_urls');
export { GoogleBusinessUrlModel, FacebookBusinessUrlModel };