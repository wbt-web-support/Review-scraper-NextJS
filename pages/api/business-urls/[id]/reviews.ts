import type { NextApiRequest, NextApiResponse } from 'next';
import { requireOperator } from '../../../../lib/apiAuth';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import dbConnect from '@/lib/mongodb';
import * as storage from '@/lib/storage';
import { IReviewItem } from '@/models/Review.model'; 
import { Types } from 'mongoose';

interface ReviewsApiResponse {
  reviews?: IReviewItem[];
  totalReviewCount?: number;
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ReviewsApiResponse>
) {
  // Operators only: refuses anyone signed out, and client logins.
  if (!(await requireOperator(req, res))) return;

  const { id: businessUrlId_param, limit: limitQuery } = req.query;

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    await dbConnect();

    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const userId_string_from_session = session.user.id as string;


    if (typeof businessUrlId_param !== 'string' || !businessUrlId_param) {
      return res.status(400).json({ message: 'Bad Request: Business URL ID is required and must be a string.' });
    }
    if (!Types.ObjectId.isValid(businessUrlId_param)) {
      return res.status(400).json({ message: 'Bad Request: Invalid Business URL ID format.' });
    }

    const businessUrlDoc = await storage.getBusinessUrlById(businessUrlId_param);

    if (!businessUrlDoc) {
      return res.status(404).json({ message: 'Business URL not found.' });
    }
    if (businessUrlDoc.userId && businessUrlDoc.userId.toString() !== userId_string_from_session) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to access these reviews.' });
    }


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

    const reviewBatchDoc = await storage.getReviewBatchForBusinessUrl(businessUrlDoc.urlHash, source);

    if (!reviewBatchDoc || !reviewBatchDoc.reviews || reviewBatchDoc.reviews.length === 0) {
      return res.status(200).json({ reviews: [], totalReviewCount: 0 }); 
    }

    const reviewsToReturn = reviewBatchDoc.reviews.slice(0, limit);
    return res.status(200).json({ reviews: reviewsToReturn, totalReviewCount: reviewBatchDoc.reviews.length });

  } catch (error: unknown) {
    const err = error as Error; 
    const queryId = req.query.id || "unknown_id"; 
    console.error(`API Error in /api/business-urls/[id]/reviews for ID [${queryId}]:`, err.message, "\nStack:", err.stack);
    return res.status(500).json({ message: err.message || "Server error fetching reviews." });
  }
}