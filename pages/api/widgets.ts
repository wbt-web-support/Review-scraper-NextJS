import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { z } from "zod/v4";
import { authOptions } from "./auth/[...nextauth]";
import dbConnect from "@/lib/mongodb";
import * as storage from "@/lib/storage";
import { IWidget } from "@/models/Widget.model";
import type { FormValues } from "@/components/CreateWidgetModal";
import { IBusinessUrlDisplay } from "@/lib/storage";
import { purgeTenant } from "@vrm/lib/tenants/purge";
import {
  videoTenantSchema,
  provisionVideoTenant,
  originForRequest,
} from "@/lib/videoTenant";

interface ErrorResponse {
  message: string;
}

/** The widget form adds a name to the shared video-tenant fields. */
const CreateVideoWidgetSchema = videoTenantSchema.extend({
  name: z.string().trim().min(1, { error: "Enter a business name." }).max(120),
});

/**
 * Creating a Video Reviews widget provisions a real Video Review Manager tenant:
 * its collection page, subdomain, embed key, default settings, and the client's own
 * login. The Mongo widget is the agency-side handle on all of that.
 *
 * Authorization is the NextAuth session checked by the caller. Provisioning goes
 * through the shared provisionVideoTenant() -- the same path the Add Business dialog
 * uses -- so the two cannot drift.
 */
async function createVideoWidget(
  req: NextApiRequest,
  userId: string,
): Promise<{ ok: true; widget: IWidget } | { ok: false; status: number; message: string }> {
  const parsed = CreateVideoWidgetSchema.safeParse(req.body);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      message: z.prettifyError(parsed.error).split("\n")[0].replace(/^✖\s*/, ""),
    };
  }

  const provisioned = await provisionVideoTenant(parsed.data, originForRequest(req));
  if (!provisioned.ok) {
    return { ok: false, status: 400, message: provisioned.message };
  }

  try {
    const widget = await storage.createWidget({
      userId,
      name: parsed.data.name,
      type: "video",
      themeColor: parsed.data.brandColor,
      video: provisioned.link,
    });
    return { ok: true, widget };
  } catch (error: unknown) {
    // The tenant is already live at this point -- collection page, login and all.
    // Leaving it behind would mean a client account nobody can see or manage from
    // the widget list, so unwind it the same way provisionTenant unwinds itself.
    const undone = await purgeTenant(provisioned.tenantId);
    const detail = error instanceof Error ? error.message : "Could not save the widget.";
    return {
      ok: false,
      status: 500,
      message: undone.ok
        ? detail
        : `${detail} The tenant could not be cleaned up either -- remove "${provisioned.tenantName}" from /video/admin by hand.`,
    };
  }
}

// interface ApiReceivedWidgetData {
//   name: string;
//   businessUrlId: string;
//   themeColor: string;
//   layout: "grid" | "carousel" | "list" | "masonry" | "badge";
//   minRating: number;
//   showRatings: boolean;
//   showDates: boolean;
//   showProfilePictures: boolean;
//   maxReviews?: number;
// }

// interface WidgetsResponse {
//   widgets?: IWidget[];
//   message?: string;
// }

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<IWidget | { widgets?: IWidget[] } | ErrorResponse>
) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res
      .status(405)
      .json({ message: `Method ${req.method} Not Allowed` });
  }
  try {
    await dbConnect();
    const session = await getServerSession(req, res, authOptions);

    if (!session || !session.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = session.user.id as string;
    console.log(`[API /api/widgets] User ID: ${userId}`);

    if (req.method === "POST") {
      // Video widgets are provisioned against Supabase, not built from a scraped
      // business URL, so they branch off before any of the business-URL lookup below.
      //
      // Checks BOTH keys deliberately. The modal sends the chosen layout as `type`
      // while the scraper branch below reads `layout`;;that mismatch is pre-existing
      // (it is why every scraper widget saves with the default type), and this branch
      // must not inherit it -- picking Video Reviews and silently getting a grid would
      // provision no tenant and fail validation on a business URL the user never saw.
      const body = req.body as Partial<FormValues> & { type?: string };
      if (body?.layout === "video" || body?.type === "video") {
        const result = await createVideoWidget(req, userId);
        return result.ok
          ? res.status(201).json(result.widget)
          : res.status(result.status).json({ message: result.message });
      }

      try {
        const widgetClientData = req.body as FormValues;
        // Use getAllBusinessUrlsForDisplay to match the data source used in the modal
        const businessUrls = await storage.getAllBusinessUrlsForDisplay();
        const selectedBusinessUrlObject = businessUrls.find(
          (b: IBusinessUrlDisplay) => b._id === widgetClientData.businessUrlId
        );
        
        if (!selectedBusinessUrlObject) {
          return res.status(400).json({ message: "Selected business URL not found" });
        }
        
        // Map the source to the correct format for the widget model
        const businessUrlSource = selectedBusinessUrlObject.source === 'google' 
          ? 'GoogleBusinessUrl' 
          : 'FacebookBusinessUrl';

        const dataForStorage: import("@/lib/storage").CreateWidgetArgs = {
          userId: userId,
          name: widgetClientData.name,
          businessUrlId: widgetClientData.businessUrlId,
          businessUrlSource: businessUrlSource,
          urlHash: selectedBusinessUrlObject.urlHash,
          type: widgetClientData.layout,
          themeColor: widgetClientData.themeColor,
          minRating: widgetClientData.minRating,
          showRatings: widgetClientData.showRatings ?? true,
          showDates: widgetClientData.showDates ?? true,
          showProfilePictures: widgetClientData.showProfilePictures ?? true,
          initialReviewCount: widgetClientData.initialReviewCount || 10,
        };
        const createdWidget = await storage.createWidget(dataForStorage);
        return res.status(201).json(createdWidget);
      } catch (error: unknown) {
        console.error("Error creating widget:", error);
        const message =
          error instanceof Error ? error.message : "Error creating widget.";
        return res.status(500).json({ message });
      }
    }

    const widgets = await storage.getWidgetsByUserId(userId);
    return res.status(200).json({ widgets });
  } catch (error: unknown) {
    console.error("API Error in /api/widgets:", error);
    const message =
      error instanceof Error ? error.message : "Server error fetching widgets.";
    return res.status(500).json({ message });
  }
}