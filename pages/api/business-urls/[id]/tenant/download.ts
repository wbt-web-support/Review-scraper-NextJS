import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import { resolveOwnedTenant } from "@/lib/tenantAccess";
import { getReviewDownloadSource } from "@/lib/tenantAdmin";

/**
 * Streams one review's video back as a download.
 *
 * The `download` attribute on an <a> is ignored cross-origin, so linking straight to
 * Bunny just plays the file in a tab. This route fetches it server-side (same origin as
 * the app) and re-sends it with Content-Disposition: attachment, so the browser saves
 * it. Works for both the operator and the client (resolveOwnedTenant authorizes both).
 */
export const config = {
  // Video files are bigger than the default 4MB response cap.
  api: { responseLimit: false },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
  try {
    await dbConnect();
    const ctx = await resolveOwnedTenant(req, res);
    if (!ctx) return;

    const reviewId = typeof req.query.reviewId === "string" ? req.query.reviewId : "";
    if (!reviewId) return res.status(400).json({ message: "Missing reviewId." });

    const source = await getReviewDownloadSource(ctx.tenantId, reviewId);
    if (!source) return res.status(404).json({ message: "No downloadable video for this review." });

    const upstream = await fetch(source.url);
    if (!upstream.ok || !upstream.body) {
      // Most likely a Bunny video that hasn't finished encoding its MP4 yet.
      return res.status(502).json({ message: "The video isn't ready to download yet. Try again shortly." });
    }

    res.setHeader("Content-Type", upstream.headers.get("content-type") || "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="${source.filename}"`);
    const len = upstream.headers.get("content-length");
    if (len) res.setHeader("Content-Length", len);

    const buffer = Buffer.from(await upstream.arrayBuffer());
    return res.status(200).send(buffer);
  } catch (error: unknown) {
    console.error("[tenant download]", error);
    return res.status(500).json({ message: error instanceof Error ? error.message : "Server error." });
  }
}
