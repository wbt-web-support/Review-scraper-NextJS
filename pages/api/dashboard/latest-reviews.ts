import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]'; 
import dbConnect from '@/lib/mongodb';
import * as storage from '@/lib/storage';
import { IReviewItem } from '@/models/Review.model';

interface LatestReviewResponseItem extends IReviewItem {
    businessName: string;
    source: 'google' | 'facebook' | string;
    businessUrl?: string;
}

interface LatestReviewsApiResponse {
  reviews?: LatestReviewResponseItem[];
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LatestReviewsApiResponse>
) {
  console.log(`[API /latest-reviews] Method: ${req.method}, Query:`, req.query);

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    await dbConnect();
    console.log("[API /latest-reviews] DB Connected.");

    const session = await getServerSession(req, res, authOptions);
    console.log("[API /latest-reviews] Session:", session ? `User ID: ${session.user?.id}` : "No session");

    if (!session || !session.user?.id) {
      console.log("[API /latest-reviews] Unauthorized.");
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const userId = session.user.id as string; // Assuming session.user.id is string
    console.log(`[API /latest-reviews] Authenticated User ID: ${userId}`);

    const limitQuery = req.query.limit;
    const limit = typeof limitQuery === 'string' && !isNaN(parseInt(limitQuery))
      ? parseInt(limitQuery)
      : 10;
    console.log(`[API /latest-reviews] Parsed Limit: ${limit}`);

    console.log(`[API /latest-reviews] Calling storage.getLatestReviews for user: ${userId}, limit: ${limit}`);
    const latestReviewsFromStorage = await storage.getLatestReviews(userId, limit); // <--- CALL TO STORAGE
    console.log(`[API /latest-reviews] Reviews from storage count: ${latestReviewsFromStorage?.length}`);
    // console.log("[API /latest-reviews] Reviews from storage:", JSON.stringify(latestReviewsFromStorage, null, 2)); // Can be very verbose

    return res.status(200).json({ reviews: latestReviewsFromStorage as LatestReviewResponseItem[] });

  } catch (error: unknown) {
    // THIS CATCH BLOCK IS BEING HIT
    const err = error as Error;
    const userIdForError = (req as any).session?.user?.id || 'unknown_user'; // Attempt to get userId for error log
    console.error(`API Error in /api/dashboard/latest-reviews for user ${userIdForError}:`, err.message, "\nStack:", err.stack);
    return res.status(500).json({ message: err.message || "Server error fetching latest reviews." });
  }
}