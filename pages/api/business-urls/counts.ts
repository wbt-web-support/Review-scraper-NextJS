import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import dbConnect from "@/lib/mongodb";
import { GoogleReviewBatchModel, FacebookReviewBatchModel } from "@/models/Review.model";
import { createAdminClient } from "@vrm/lib/supabase/admin";

/**
 * Review counts for every business, for the /reviews table.
 *
 * Two aggregate queries, NOT one-per-business: scraped counts come from a Mongo
 * aggregation over the review batches (keyed by urlHash), and video counts from a
 * single Supabase read of every review's tenant_id, tallied here. The table maps
 * these onto its rows by urlHash and video.tenantId.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
  try {
    await dbConnect();
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user?.id) {
      return res.status(401).json({ message: "Unauthorized." });
    }

    // --- Scraped reviews: sum the reviews array length per urlHash, per source. ---
    const scraped: Record<string, number> = {};
    const agg = [
      { $group: { _id: "$urlHash", n: { $sum: { $size: { $ifNull: ["$reviews", []] } } } } },
    ];
    const [google, facebook] = await Promise.all([
      GoogleReviewBatchModel.aggregate(agg).exec(),
      FacebookReviewBatchModel.aggregate(agg).exec(),
    ]);
    for (const row of [...google, ...facebook]) {
      if (row?._id) scraped[row._id] = (scraped[row._id] ?? 0) + (row.n ?? 0);
    }

    // --- Video reviews: one read of every review's tenant_id, tallied by tenant. ---
    const video: Record<string, number> = {};
    const { data: reviews } = await createAdminClient().from("reviews").select("tenant_id");
    for (const r of reviews ?? []) {
      const id = (r as { tenant_id: string }).tenant_id;
      if (id) video[id] = (video[id] ?? 0) + 1;
    }

    return res.status(200).json({ scraped, video });
  } catch (error: unknown) {
    console.error("[business-urls/counts]", error);
    return res.status(500).json({ message: error instanceof Error ? error.message : "Server error." });
  }
}
