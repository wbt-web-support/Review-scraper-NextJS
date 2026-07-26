import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import dbConnect from "@/lib/mongodb";
import { resolveOwnedTenant } from "@/lib/tenantAccess";
import * as tenant from "@/lib/tenantAdmin";
import * as storage from "@/lib/storage";
import { getVideoBusinessById, updateVideoBusiness } from "@/lib/videoBusinessStore";
import { MIN_VIDEO_SECONDS, MAX_VIDEO_SECONDS } from "@vrm/lib/video/limits";

/**
 * Every tenant-settings write, dispatched by `section`, so the six management tabs
 * share one authorized entry point rather than six near-identical route files.
 *
 * Branding also writes back to the Mongo business, so the /reviews list and Edit
 * dialog stay in step with what was changed here.
 */
const schemas = {
  collection: z.object({
    welcomeText: z.string().trim().min(1).max(300),
    description: z.string().trim().max(500).optional(),
    thankYouText: z.string().trim().min(1).max(300),
    promptQuestions: z.array(z.string()).max(20),
  }),
  branding: z.object({
    name: z.string().trim().min(1).max(120),
    brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #8A9A5B."),
    logoUrl: z.union([z.string().url(), z.literal("")]).optional(),
    contactEmail: z.union([z.string().email(), z.literal("")]).optional(),
    contactPhone: z.string().trim().max(40).optional(),
  }),
  // What a CLIENT may change about their own branding -- everything except the email,
  // which is their login identity. The email is preserved server-side.
  clientBranding: z.object({
    name: z.string().trim().min(1).max(120),
    brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #8A9A5B."),
    logoUrl: z.union([z.string().url(), z.literal("")]).optional(),
    contactPhone: z.string().trim().max(40).optional(),
  }),
  videoLimit: z.object({
    maxVideoSeconds: z.coerce.number().int().min(MIN_VIDEO_SECONDS, `Minimum is ${MIN_VIDEO_SECONDS} seconds.`).max(MAX_VIDEO_SECONDS, `Maximum is ${MAX_VIDEO_SECONDS} seconds.`),
  }),
  widget: z.object({ layout: z.enum(["grid", "carousel", "single"]), autoplay: z.coerce.boolean() }),
  openMode: z.object({ mode: z.enum(["dialog", "page"]) }),
  apiKey: z.object({}),
  domainSave: z.object({ rootDomain: z.string().max(255) }),
  domainVerify: z.object({}),
} as const;

type Section = keyof typeof schemas;

/**
 * Keep the Mongo record in step with tenant branding. A video business owns a
 * VideoBusiness row; a scraped business owns a BusinessUrl. Update whichever exists.
 */
async function mirrorBrandingToMongo(
  businessId: string,
  fields: { name: string; brandColor: string; logoUrl: string; email: string; phone: string },
): Promise<void> {
  const details = { brandColor: fields.brandColor, logoUrl: fields.logoUrl, email: fields.email, phone: fields.phone };
  const videoBiz = await getVideoBusinessById(businessId);
  if (videoBiz) {
    await updateVideoBusiness(businessId, { name: fields.name, details });
  } else {
    await storage.updateBusinessUrlDetails(businessId, { name: fields.name, details });
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
    res.setHeader("Allow", ["PUT"]);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
  try {
    await dbConnect();
    const ctx = await resolveOwnedTenant(req, res);
    if (!ctx) return;

    const section = req.body?.section as Section | undefined;
    if (!section || !(section in schemas)) {
      return res.status(400).json({ message: "Unknown settings section." });
    }
    const parsed = schemas[section].safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid input." });
    }
    const data = parsed.data as Record<string, unknown>;
    const { tenantId, businessId } = ctx;

    switch (section) {
      case "collection":
        await tenant.updateCollection(tenantId, {
          welcomeText: data.welcomeText as string,
          description: (data.description as string) ?? "",
          thankYouText: data.thankYouText as string,
          promptQuestions: data.promptQuestions as string[],
        });
        return res.status(200).json({ message: "Saved." });

      case "branding": {
        const b = data as { name: string; brandColor: string; logoUrl?: string; contactEmail?: string; contactPhone?: string };
        await tenant.updateBranding(tenantId, b);
        await mirrorBrandingToMongo(businessId, {
          name: b.name, brandColor: b.brandColor, logoUrl: b.logoUrl ?? "", email: b.contactEmail ?? "", phone: b.contactPhone ?? "",
        });
        return res.status(200).json({ message: "Saved." });
      }

      case "clientBranding": {
        // The client edits everything but their email (their login identity), which we
        // preserve from the existing record.
        const c = data as { name: string; brandColor: string; logoUrl?: string; contactPhone?: string };
        const existing = await getVideoBusinessById(businessId);
        const email = existing?.details?.email ?? "";
        await tenant.updateBranding(tenantId, {
          name: c.name, brandColor: c.brandColor, logoUrl: c.logoUrl, contactEmail: email, contactPhone: c.contactPhone,
        });
        await mirrorBrandingToMongo(businessId, {
          name: c.name, brandColor: c.brandColor, logoUrl: c.logoUrl ?? "", email, phone: c.contactPhone ?? "",
        });
        return res.status(200).json({ message: "Saved." });
      }

      case "videoLimit": {
        const message = await tenant.setVideoLimit(tenantId, data.maxVideoSeconds as number);
        return res.status(200).json({ message });
      }

      case "widget":
        await tenant.updateWidgetSettings(tenantId, {
          layout: data.layout as "grid" | "carousel" | "single",
          autoplay: data.autoplay as boolean,
        });
        return res.status(200).json({ message: "Saved. The widget updates within a minute." });

      case "openMode":
        await tenant.setOpenMode(tenantId, data.mode as "dialog" | "page");
        return res.status(200).json({ message: "Saved." });

      case "apiKey": {
        const apiKey = await tenant.rotateApiKey(tenantId);
        return res.status(200).json({ message: "New key generated. The old one stopped working immediately.", apiKey });
      }

      case "domainSave": {
        const result = await tenant.saveCustomDomain(tenantId, data.rootDomain as string);
        return result.ok
          ? res.status(200).json({ message: result.message })
          : res.status(400).json({ message: result.error });
      }

      case "domainVerify": {
        const result = await tenant.verifyCustomDomain(tenantId);
        return result.ok
          ? res.status(200).json({ message: result.message })
          : res.status(400).json({ message: result.error });
      }
    }
  } catch (error: unknown) {
    console.error("[tenant settings PUT]", error);
    return res.status(500).json({ message: error instanceof Error ? error.message : "Server error." });
  }
}
