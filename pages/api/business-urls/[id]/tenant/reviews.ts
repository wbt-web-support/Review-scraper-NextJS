import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import { resolveOwnedTenant } from "@/lib/tenantAccess";
import { listTenantReviews, type ReviewStatus } from "@/lib/tenantAdmin";

const STATUSES: ReviewStatus[] = ["pending", "approved", "rejected"];

/** The tenant's video reviews, for the moderation tab. Optional ?status= filter. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
  try {
    await dbConnect();
    const ctx = await resolveOwnedTenant(req, res);
    if (!ctx) return;

    const statusRaw = req.query.status;
    const status = typeof statusRaw === "string" && STATUSES.includes(statusRaw as ReviewStatus)
      ? (statusRaw as ReviewStatus)
      : undefined;

    const reviews = await listTenantReviews(ctx.tenantId, status);
    return res.status(200).json({ reviews });
  } catch (error: unknown) {
    console.error("[tenant reviews GET]", error);
    return res.status(500).json({ message: error instanceof Error ? error.message : "Server error." });
  }
}
