import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { Types } from "mongoose";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import * as storage from "./storage";
import { getVideoBusinessById } from "./videoBusinessStore";

/**
 * The authorization boundary for managing a business's video-review tenant from the
 * scraper app.
 *
 * The video product's own screens authorize with a Supabase session and RLS. The
 * scraper user has neither -- they are a NextAuth user, and the tenant management they
 * do here runs on the service-role client, which bypasses RLS entirely. So THIS is the
 * only thing standing between them and a tenant: the caller must be signed in, and the
 * business whose tenant they are touching must be their own (its Mongo row carries
 * their userId). Every tenant API route calls this first and refuses to proceed
 * without the tenantId it returns.
 *
 * Returns null and has already sent the response on any failure -- callers just
 * `if (!ctx) return;`.
 */
export async function resolveOwnedTenant(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<{ userId: string; businessId: string; tenantId: string } | null> {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user?.id) {
    res.status(401).json({ message: "Unauthorized." });
    return null;
  }
  const userId = session.user.id as string;

  const businessId = req.query.id;
  if (typeof businessId !== "string" || !Types.ObjectId.isValid(businessId)) {
    res.status(400).json({ message: "Invalid business id." });
    return null;
  }

  // A client (video-business owner) may only touch their OWN business. Their session
  // carries the id it's scoped to; anything else is forbidden. They then resolve to
  // that VideoBusiness's tenant directly, without the operator ownership check below.
  if (session.user.role === "client") {
    if (businessId !== session.user.videoBusinessId) {
      res.status(403).json({ message: "Forbidden: this is not your business." });
      return null;
    }
    const own = await getVideoBusinessById(businessId);
    if (!own) {
      res.status(404).json({ message: "Business not found." });
      return null;
    }
    return { userId, businessId, tenantId: own.video.tenantId };
  }

  // The id may be a scraped BusinessUrl (legacy, video-enabled) or a dedicated
  // VideoBusiness. Either way, ownership is the userId on the Mongo record and the
  // tenant is its video.tenantId.
  const scraped = await storage.getBusinessUrlById(businessId);
  const owner = scraped?.userId?.toString();
  if (scraped) {
    if (owner !== userId) {
      res.status(403).json({ message: "Forbidden: this is not your business." });
      return null;
    }
    if (!scraped.video?.tenantId) {
      res.status(409).json({ message: "Video reviews are not enabled for this business." });
      return null;
    }
    return { userId, businessId, tenantId: scraped.video.tenantId };
  }

  const videoBiz = await getVideoBusinessById(businessId);
  if (!videoBiz) {
    res.status(404).json({ message: "Business not found." });
    return null;
  }
  if (videoBiz.userId !== userId) {
    res.status(403).json({ message: "Forbidden: this is not your business." });
    return null;
  }
  return { userId, businessId, tenantId: videoBiz.video.tenantId };
}
