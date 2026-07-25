import mongoose, { Schema, Document, Model, Types } from 'mongoose';

/**
 * A business set up specifically for VIDEO reviews.
 *
 * Deliberately separate from BusinessUrl (the scraped Google/Facebook businesses):
 * video reviews are their own product now, managed on /video-reviews, and a video
 * business has no scraping URL -- it has a Video Review Manager tenant in Supabase
 * instead. The `video` subdoc is the bridge to that tenant.
 */
export interface IVideoBusinessTenant {
  tenantId: string;
  slug: string;
  embedKey: string;
  collectUrl: string;
}

export interface IVideoBusinessDetails {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  brandColor?: string;
  logoUrl?: string;
}

export interface IVideoBusiness extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  video: IVideoBusinessTenant;
  details?: IVideoBusinessDetails;
  /**
   * The business's current sign-in password, kept in plain text ON PURPOSE.
   *
   * Supabase only stores a hash of it, so once set it can never be read back -- yet
   * the operator needs to be able to see and re-send a client's login at any time.
   * This is the copy that makes that possible. It is only ever exposed to the
   * business's own owner (the NextAuth operator, ownership-checked), never publicly.
   * Kept in step with the real auth password: written on create and on every reset.
   */
  loginPassword?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VideoBusinessSchema: Schema<IVideoBusiness> = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  video: {
    type: new Schema<IVideoBusinessTenant>({
      tenantId: { type: String, required: true },
      slug: { type: String, required: true },
      embedKey: { type: String, required: true },
      collectUrl: { type: String, required: true },
    }, { _id: false }),
    required: true,
  },
  details: {
    type: new Schema<IVideoBusinessDetails>({
      firstName: { type: String },
      lastName: { type: String },
      email: { type: String },
      phone: { type: String },
      brandColor: { type: String },
      logoUrl: { type: String },
    }, { _id: false }),
    required: false,
  },
  loginPassword: { type: String },
}, { timestamps: true });

const VideoBusinessModel: Model<IVideoBusiness> =
  mongoose.models.VideoBusiness ||
  mongoose.model<IVideoBusiness>('VideoBusiness', VideoBusinessSchema, 'video_businesses');

export default VideoBusinessModel;
