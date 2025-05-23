import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "@/lib/mongodb";
import * as storage from "@/lib/storage";

interface ErrorResponse {
  message: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ widgetId: string } | ErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    await dbConnect();
    const { businessUrl } = req.body;

    if (!businessUrl) {
      return res.status(400).json({ message: "Business URL is required" });
    }

    // Find the business URL in the database
    const businessUrlDoc = await storage.findBusinessUrlByUrl(businessUrl);
    
    if (!businessUrlDoc) {
      return res.status(404).json({ message: "Business URL not found" });
    }

    // Get the default widget for this business URL
    const widgets = await storage.getWidgetsByBusinessUrlId(businessUrlDoc._id.toString());
    
    if (!widgets || widgets.length === 0) {
      return res.status(404).json({ message: "No widget found for this business" });
    }

    // Return the first widget's ID
    return res.status(200).json({ widgetId: widgets[0]._id.toString() });
  } catch (error) {
    console.error("API Error in /api/widgets/by-url:", error);
    const message = error instanceof Error ? error.message : "Server error";
    return res.status(500).json({ message });
  }
} 