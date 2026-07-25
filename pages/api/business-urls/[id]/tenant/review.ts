import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import dbConnect from "@/lib/mongodb";
import { resolveOwnedTenant } from "@/lib/tenantAccess";
import { setReviewStatus, deleteTenantReview } from "@/lib/tenantAdmin";

const uuid = z.string().uuid();
const statusSchema = z.enum(["pending", "approved", "rejected"]);

/**
 * Moderate one review: PATCH sets its status (approve/reject), DELETE removes it and
 * its video for good. Rejecting hides; deleting is for takedowns and withdrawn consent.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH" && req.method !== "DELETE") {
    res.setHeader("Allow", ["PATCH", "DELETE"]);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
  try {
    await dbConnect();
    const ctx = await resolveOwnedTenant(req, res);
    if (!ctx) return;

    const reviewId = uuid.safeParse(req.body?.reviewId);
    if (!reviewId.success) return res.status(400).json({ message: "Invalid review id." });

    if (req.method === "PATCH") {
      const status = statusSchema.safeParse(req.body?.status);
      if (!status.success) return res.status(400).json({ message: "Invalid status." });
      await setReviewStatus(ctx.tenantId, reviewId.data, status.data);
      return res.status(200).json({ message: "Updated." });
    }

    await deleteTenantReview(ctx.tenantId, reviewId.data);
    return res.status(200).json({ message: "Deleted." });
  } catch (error: unknown) {
    console.error("[tenant review]", error);
    return res.status(500).json({ message: error instanceof Error ? error.message : "Server error." });
  }
}
