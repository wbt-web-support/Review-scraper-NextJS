import { Types } from 'mongoose';
import dbConnect from './mongodb';
import VideoBusinessModel, {
  type IVideoBusinessTenant,
  type IVideoBusinessDetails,
} from '../models/VideoBusiness.model';

export interface VideoBusinessDisplay {
  _id: string;
  name: string;
  userId?: string;
  video: IVideoBusinessTenant;
  details?: IVideoBusinessDetails;
  loginPassword?: string;
  createdAt?: string;
}

function toDisplay(doc: {
  _id: Types.ObjectId;
  name: string;
  userId?: Types.ObjectId | null;
  video: IVideoBusinessTenant;
  details?: IVideoBusinessDetails;
  loginPassword?: string;
  createdAt?: Date;
}): VideoBusinessDisplay {
  return {
    _id: doc._id.toString(),
    name: doc.name,
    userId: doc.userId?.toString(),
    video: doc.video,
    details: doc.details,
    loginPassword: doc.loginPassword,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
  };
}

export async function createVideoBusiness(input: {
  userId: string;
  name: string;
  video: IVideoBusinessTenant;
  details?: IVideoBusinessDetails;
  loginPassword?: string;
}): Promise<VideoBusinessDisplay> {
  await dbConnect();
  const doc = await VideoBusinessModel.create({
    userId: new Types.ObjectId(input.userId),
    name: input.name,
    video: input.video,
    details: input.details,
    loginPassword: input.loginPassword,
  });
  return toDisplay(doc.toObject());
}

export async function setVideoBusinessPassword(id: string, loginPassword: string): Promise<void> {
  await dbConnect();
  await VideoBusinessModel.updateOne({ _id: id }, { $set: { loginPassword } }).exec();
}

/**
 * Authenticate a video-business client by their login email + password.
 *
 * The login is the contact email on the business plus the plain-text `loginPassword`
 * we store (see the model). Matched case-insensitively on email, exactly on password.
 * Returns the minimum a session needs, or null. This is the ONLY read that touches the
 * stored password, and only NextAuth's authorize() calls it.
 */
export async function findVideoBusinessLogin(
  email: string,
  password: string,
): Promise<{ _id: string; email: string; name: string } | null> {
  await dbConnect();
  const normalized = email.trim().toLowerCase();
  const doc = await VideoBusinessModel.findOne({
    "details.email": { $regex: `^${escapeRegex(normalized)}$`, $options: "i" },
    loginPassword: password,
  })
    .lean()
    .exec();
  if (!doc) return null;
  const d = doc as unknown as { _id: Types.ObjectId; name: string; details?: { email?: string } };
  return { _id: d._id.toString(), email: d.details?.email ?? normalized, name: d.name };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listVideoBusinessesByUser(userId: string): Promise<VideoBusinessDisplay[]> {
  await dbConnect();
  if (!Types.ObjectId.isValid(userId)) return [];
  const docs = await VideoBusinessModel.find({ userId: new Types.ObjectId(userId) })
    .sort({ createdAt: -1 })
    .lean()
    .exec();
  return docs.map((d) => toDisplay(d as never));
}

export async function getVideoBusinessById(id: string): Promise<VideoBusinessDisplay | null> {
  await dbConnect();
  if (!Types.ObjectId.isValid(id)) return null;
  const doc = await VideoBusinessModel.findById(id).lean().exec();
  return doc ? toDisplay(doc as never) : null;
}

export async function updateVideoBusiness(
  id: string,
  patch: { name?: string; details?: IVideoBusinessDetails },
): Promise<void> {
  await dbConnect();
  const set: Record<string, unknown> = {};
  if (typeof patch.name === 'string') set.name = patch.name;
  if (patch.details) {
    for (const [k, v] of Object.entries(patch.details)) {
      if (v !== undefined) set[`details.${k}`] = v;
    }
  }
  if (Object.keys(set).length === 0) return;
  await VideoBusinessModel.updateOne({ _id: id }, { $set: set }).exec();
}

export async function deleteVideoBusiness(id: string): Promise<void> {
  await dbConnect();
  await VideoBusinessModel.deleteOne({ _id: id }).exec();
}
