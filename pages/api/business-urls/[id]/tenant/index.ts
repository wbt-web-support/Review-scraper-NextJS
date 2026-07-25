import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import { resolveOwnedTenant } from "@/lib/tenantAccess";
import { getTenantBundle } from "@/lib/tenantAdmin";

/** Everything the business profile's tenant-management tabs need, in one call. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
  try {
    await dbConnect();
    const ctx = await resolveOwnedTenant(req, res);
    if (!ctx) return;

    const bundle = await getTenantBundle(ctx.tenantId);
    if (!bundle) return res.status(404).json({ message: "Tenant not found." });
    return res.status(200).json(bundle);
  } catch (error: unknown) {
    console.error("[tenant GET]", error);
    return res.status(500).json({ message: error instanceof Error ? error.message : "Server error." });
  }
}
