import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { Types } from "mongoose";
import { authOptions } from "../../auth/[...nextauth]";
import dbConnect from "@/lib/mongodb";
import { getVideoBusinessById, setVideoBusinessPassword } from "@/lib/videoBusinessStore";
import { resetTenantLoginPassword } from "@/lib/videoTenant";

/**
 * Set the sign-in password for a video business's owner login.
 *
 * Body may carry a specific `{ password }` (min 8 chars) to set, or be empty to
 * generate a fresh one. The new value is applied to the Supabase auth user, mirrored
 * onto our own record so it can be shown again later, and returned. Ownership is
 * enforced against the Mongo record before we touch anything in Supabase.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
  try {
    await dbConnect();
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user?.id) {
      return res.status(401).json({ message: "Unauthorized." });
    }
    const userId = session.user.id as string;

    const id = req.query.id;
    if (typeof id !== "string" || !Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid id." });
    }

    const business = await getVideoBusinessById(id);
    if (!business) return res.status(404).json({ message: "Business not found." });
    if (business.userId !== userId) return res.status(403).json({ message: "Forbidden: this is not your business." });

    // Optional custom password. If given it must be usable; if absent we generate one.
    const custom = typeof req.body?.password === "string" ? req.body.password.trim() : "";
    if (custom && custom.length < 8) {
      return res.status(400).json({ message: "The login password must be at least 8 characters." });
    }

    const result = await resetTenantLoginPassword(business.video.tenantId, custom || undefined);
    if (!result.ok) return res.status(400).json({ message: result.error });

    // Mirror it onto our record so the profile can show it again later.
    await setVideoBusinessPassword(id, result.password);

    return res.status(200).json({ password: result.password });
  } catch (error: unknown) {
    console.error(`[video-businesses/${req.query.id}/reset-login]`, error);
    return res.status(500).json({ message: error instanceof Error ? error.message : "Server error." });
  }
}
