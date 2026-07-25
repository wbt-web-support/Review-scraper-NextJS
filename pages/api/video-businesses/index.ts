import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import dbConnect from "@/lib/mongodb";
import { z } from "zod/v4";
import {
  createVideoBusiness,
  listVideoBusinessesByUser,
} from "@/lib/videoBusinessStore";
import {
  videoTenantSchema,
  provisionVideoTenant,
  originForRequest,
} from "@/lib/videoTenant";
import { purgeTenant } from "@vrm/lib/tenants/purge";

const createSchema = videoTenantSchema.extend({
  name: z.string().trim().min(2, "Business name must be at least 2 characters.").max(120),
});

/**
 * Video-review businesses for the signed-in user.
 *
 * GET lists them. POST provisions a Video Review Manager tenant (collection page,
 * embed key, subdomain, the owner's login) and records the video business that owns
 * it. Authorization is the NextAuth session; provisioning uses the service-role
 * client, so this route IS the guard.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await dbConnect();
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user?.id) {
      return res.status(401).json({ message: "Unauthorized." });
    }
    const userId = session.user.id as string;

    if (req.method === "GET") {
      const videoBusinesses = await listVideoBusinessesByUser(userId);
      return res.status(200).json({ videoBusinesses });
    }

    if (req.method === "POST") {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid details." });
      }

      const provisioned = await provisionVideoTenant(parsed.data, originForRequest(req));
      if (!provisioned.ok) {
        return res.status(400).json({ message: provisioned.message });
      }

      try {
        const business = await createVideoBusiness({
          userId,
          name: parsed.data.name,
          video: provisioned.link,
          details: {
            email: parsed.data.contactEmail,
            phone: parsed.data.contactPhone || "",
            brandColor: parsed.data.brandColor,
            logoUrl: parsed.data.logoUrl || "",
          },
          // Kept so the operator can view and re-share the login later; see the model.
          loginPassword: parsed.data.adminPassword,
        });
        return res.status(201).json(business);
      } catch (error: unknown) {
        // The tenant is live but nothing points at it -- unwind it.
        await purgeTenant(provisioned.tenantId).catch(() => {});
        const detail = error instanceof Error ? error.message : "Could not save the business.";
        return res.status(500).json({ message: detail });
      }
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  } catch (error: unknown) {
    console.error("[video-businesses]", error);
    return res.status(500).json({ message: error instanceof Error ? error.message : "Server error." });
  }
}
