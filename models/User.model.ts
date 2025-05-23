import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IUser extends Document {
  _id: Types.ObjectId;
  fullName?: string;
  email: string;
  username?: string;
  password?: string; 
  isVerified: boolean;
  createdAt: Date;
  verificationCode?: string | null;
  verificationExpires?: Date | null;
  resetPasswordToken?: string | null;
  resetPasswordExpire?: Date | null;
}

const UserSchema: Schema<IUser> = new Schema({
  fullName: { type: String },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  username: { type: String, unique: true, sparse: true, trim: true }, 
  password: { type: String, select: false }, 
  isVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  verificationCode: { type: String, default: null },
  verificationExpires: { type: Date, default: null },
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpire: { type: Date, default: null },
});

const UserModel: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema, 'users');
export default UserModel;