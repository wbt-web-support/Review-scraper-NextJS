import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { Types } from "mongoose";
import { z } from "zod";
import { authOptions } from "../auth/[...nextauth]";
import dbConnect from "@/lib/mongodb";
import {
  getVideoBusinessById,
  updateVideoBusiness,
  deleteVideoBusiness,
} from "@/lib/videoBusinessStore";
import { updateTenantDetails } from "@/lib/videoTenant";
import { purgeTenant } from "@vrm/lib/tenants/purge";

const editSchema = z.object({
  name: z.string().trim().min(2, "Business name must be at least 2 characters.").max(120).optional(),
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  email: z.union([z.string().trim().email("Enter a valid email."), z.literal("")]).optional(),
  phone: z.string().trim().max(40).optional(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Brand colour must be a hex value like #8A9A5B.").optional(),
  logoUrl: z.union([z.string().url("Enter a valid URL."), z.literal("")]).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

    if (req.method === "GET") {
      return res.status(200).json(business);
    }

    if (req.method === "PUT") {
      const parsed = editSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid details." });
      }
      const d = parsed.data;
      await updateVideoBusiness(id, {
        name: d.name,
        details: { firstName: d.firstName, lastName: d.lastName, email: d.email, phone: d.phone, brandColor: d.brandColor, logoUrl: d.logoUrl },
      });
      // Mirror the display fields onto the tenant so the collection page reflects them.
      const synced = await updateTenantDetails(business.video.tenantId, {
        name: d.name, brandColor: d.brandColor, logoUrl: d.logoUrl, contactEmail: d.email, contactPhone: d.phone,
      });
      if (!synced.ok) console.error(`[video-businesses PUT] tenant sync failed: ${synced.error}`);
      return res.status(200).json({ message: "Business updated." });
    }

    if (req.method === "DELETE") {
      const purged = await purgeTenant(business.video.tenantId);
      if (!purged.ok) {
        return res.status(500).json({ message: `Could not delete the tenant: ${purged.error}` });
      }
      await deleteVideoBusiness(id);
      return res.status(200).json({ message: "Business deleted." });
    }

    res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  } catch (error: unknown) {
    console.error(`[video-businesses/${req.query.id}]`, error);
    return res.status(500).json({ message: error instanceof Error ? error.message : "Server error." });
  }
}
