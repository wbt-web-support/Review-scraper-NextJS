import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IGoogleBusinessUrl extends Document {
  _id: Types.ObjectId;
  name: string;        
  url: string;         
  urlHash: string;     
  addedAt?: Date;      
  lastScrapedAt?: Date;
  userId?: Types.ObjectId | null;
  source: 'google'; 
}

const GoogleBusinessUrlSchema: Schema<IGoogleBusinessUrl> = new Schema({
  name: { type: String, required: true },
  url: { type: String, required: true },
  urlHash: { type: String, required: true, index: true }, 
  addedAt: { type: Date, default: Date.now },
  lastScrapedAt: { type: Date },
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true, sparse: true }, 
  source: { type: String, default: 'google', enum: ['google'], required: true },
}, { timestamps: { createdAt: 'addedAt', updatedAt: true } }); 

const GoogleBusinessUrlModel: Model<IGoogleBusinessUrl> =
mongoose.models.GoogleBusinessUrl || mongoose.model<IGoogleBusinessUrl>('GoogleBusinessUrl', GoogleBusinessUrlSchema, 'business_urls');

export default GoogleBusinessUrlModel;