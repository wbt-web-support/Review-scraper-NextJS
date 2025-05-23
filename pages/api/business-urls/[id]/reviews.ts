import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import dbConnect from '@/lib/mongodb';
import * as storage from '@/lib/storage';
import { IReviewItem } from '@/models/Review.model'; 
import { Types } from 'mongoose';

interface ReviewsApiResponse {
  reviews?: IReviewItem[];
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ReviewsApiResponse>
) {
  const { id: businessUrlId_param, limit: limitQuery } = req.query;
  console.log(`[API /reviews] Request for businessUrlId: "${businessUrlId_param}", Method: ${req.method}, Query:`, req.query);

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    await dbConnect();
    console.log("[API /reviews] DB Connected.");

    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user?.id) {
      console.log("[API /reviews] Unauthorized: No session or user ID for general review fetch.");
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const userId_string_from_session = session.user.id as string;
    console.log(`[API /reviews] Authenticated User ID: ${userId_string_from_session}`);


    if (typeof businessUrlId_param !== 'string' || !businessUrlId_param) {
      console.log("[API /reviews] Bad Request: businessUrlId_param missing or not a string.");
      return res.status(400).json({ message: 'Bad Request: Business URL ID is required and must be a string.' });
    }
    if (!Types.ObjectId.isValid(businessUrlId_param)) {
      console.log("[API /reviews] Bad Request: Invalid Business URL ID format:", businessUrlId_param);
      return res.status(400).json({ message: 'Bad Request: Invalid Business URL ID format.' });
    }

    console.log(`[API /reviews] Fetching parent BusinessUrl for ID: ${businessUrlId_param}.`);
    const businessUrlDoc = await storage.getBusinessUrlById(businessUrlId_param);

    if (!businessUrlDoc) {
      console.log(`[API /reviews] Parent BusinessUrl with ID ${businessUrlId_param} not found.`);
      return res.status(404).json({ message: 'Business URL not found.' });
    }
    console.log(`[API /reviews] Found parent BusinessUrl: "${businessUrlDoc.name}", Source: "${businessUrlDoc.source}", Stored UserID: "${businessUrlDoc.userId}"`);
    if (businessUrlDoc.userId && businessUrlDoc.userId.toString() !== userId_string_from_session) {
      console.log(`[API /reviews] Forbidden: Session User ${userId_string_from_session} does not own business URL ${businessUrlId_param} (Owner: ${businessUrlDoc.userId.toString()})`);
      return res.status(403).json({ message: 'Forbidden: You do not have permission to access these reviews.' });
    }
    console.log(`[API /reviews] Ownership check passed or not applicable for user ${userId_string_from_session}.`);


    const limit = typeof limitQuery === 'string' && !isNaN(parseInt(limitQuery))
      ? parseInt(limitQuery)
      : 10; 
    if (!businessUrlDoc.source || (businessUrlDoc.source !== 'google' && businessUrlDoc.source !== 'facebook')) {
        console.error(`[API /reviews] CRITICAL: BusinessUrl document (ID: ${businessUrlDoc._id}) has an invalid or missing 'source' field: "${businessUrlDoc.source}".`);
        return res.status(500).json({ message: 'Server error: Business source information is corrupt or missing.' });
    }
    const source = businessUrlDoc.source as 'google' | 'facebook'; 

     if (!businessUrlDoc.urlHash) {
        console.error(`[API /reviews.ts] CRITICAL: BusinessUrl (ID: ${businessUrlDoc._id}) is missing urlHash.`);
        return res.status(500).json({ message: 'Server error: Business data integrity issue.' });
    }

    console.log(`[API /reviews] Calling storage.getReviewBatchForBusinessUrl with businessUrlObjectId: ${businessUrlDoc._id.toString()}, source: ${source}`);
    const reviewBatchDoc = await storage.getReviewBatchForBusinessUrl(businessUrlDoc.urlHash, source);

    if (!reviewBatchDoc || !reviewBatchDoc.reviews || reviewBatchDoc.reviews.length === 0) {
      console.log(`[API /reviews] No reviews found in storage for BusinessUrl ID: ${businessUrlDoc._id}, Source: ${source}`);
      return res.status(200).json({ reviews: [] }); 
    }

    const reviewsToReturn = reviewBatchDoc.reviews.slice(0, limit);
    console.log(`[API /reviews] Returning ${reviewsToReturn.length} reviews from storage.`);
    return res.status(200).json({ reviews: reviewsToReturn });

  } catch (error: unknown) {
    const err = error as Error; 
    const queryId = req.query.id || "unknown_id"; 
    console.error(`API Error in /api/business-urls/[id]/reviews for ID [${queryId}]:`, err.message, "\nStack:", err.stack);
    return res.status(500).json({ message: err.message || "Server error fetching reviews." });
  }
}