import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import dbConnect from "@/lib/mongodb";
import * as storage from "@/lib/storage";
import { IWidget } from "@/models/Widget.model";

interface PaginatedWidgetsResponse {
  widgets: IWidget[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface ErrorResponse {
  message: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PaginatedWidgetsResponse | ErrorResponse>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    await dbConnect();
    const session = await getServerSession(req, res, authOptions);

    if (!session || !session.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = session.user.id as string;
    
    // Parse query parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 12, 50); // Max 50 per page
    const source = req.query.source as string; // 'google', 'facebook', or undefined for all
    const search = req.query.search as string; // Search by widget name
    const sortBy = req.query.sortBy as string || 'createdAt';
    const sortOrder = req.query.sortOrder as string || 'desc';

    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // Get paginated widgets
    const result = await storage.getPaginatedWidgetsByUserId({
      userId,
      page,
      limit,
      source,
      search,
      sortBy,
      sortOrder,
    });

    return res.status(200).json(result);
  } catch (error: unknown) {
    console.error("API Error in /api/widgets/paginated:", error);
    const message =
      error instanceof Error ? error.message : "Server error fetching widgets.";
    return res.status(500).json({ message });
  }
}
