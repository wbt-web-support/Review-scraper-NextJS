import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import dbConnect from "@/lib/mongodb";
import * as storage from "@/lib/storage";
import { IWidget } from "@/models/Widget.model";
import type { FormValues } from "@/components/CreateWidgetModal";
import { IBusinessUrlDisplay } from "@/lib/storage";

interface ErrorResponse {
  message: string;
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

        const dataForStorage = {
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