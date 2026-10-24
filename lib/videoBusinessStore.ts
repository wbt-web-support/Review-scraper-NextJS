import { Types } from 'mongoose';
import { createHash, timingSafeEqual } from "crypto";
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
  email: unknown,
  password: unknown,
): Promise<{ _id: string; email: string; name: string } | null> {
  // Plain strings only, checked here as well as in authorize(): this function must
  // be safe whoever calls it.
  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) return null;
  await dbConnect();
  const normalized = email.trim().toLowerCase();
  // Find by email ONLY, then compare the password here in code. The password used
  // to be part of the database query, where a crafted value acts as a condition
  // ("any password that isn't X") and signs someone in without knowing it.
  const docs = await VideoBusinessModel.find(
    { "details.email": { $regex: `^${escapeRegex(normalized)}$`, $options: "i" } },
    { name: 1, details: 1, loginPassword: 1 },
  )
    .lean()
    .exec();
  const match = (docs as unknown as { _id: Types.ObjectId; name: string; details?: { email?: string }; loginPassword?: unknown }[])
    .find((d) => typeof d.loginPassword === "string" && d.loginPassword.length > 0 && samePassword(d.loginPassword, password));
  if (!match) return null;
  return { _id: match._id.toString(), email: match.details?.email ?? normalized, name: match.name };
}

/** Constant-time comparison, so response timing reveals nothing about the password. */
function samePassword(stored: string, given: string): boolean {
  const a = createHash("sha256").update(stored).digest();
  const b = createHash("sha256").update(given).digest();
  return timingSafeEqual(a, b);
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
