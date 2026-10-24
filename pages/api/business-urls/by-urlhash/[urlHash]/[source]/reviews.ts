import type { NextApiRequest, NextApiResponse } from 'next';
import { requireOperator } from '../../../../../../lib/apiAuth';
import dbConnect from '@/lib/mongodb';
import * as storage from '@/lib/storage';
import { IReviewItem } from '@/models/Review.model';
import { GoogleReviewBatchModel, FacebookReviewBatchModel } from '@/models/Review.model';
import GoogleBusinessUrlModel from '@/models/GoogleBusinessUrl.model';
import FacebookBusinessUrlModel from '@/models/FacebookBusinessUrl.model';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ reviews?: IReviewItem[]; message?: string }>
) {
  // Operators only: refuses anyone signed out, and client logins.
  if (!(await requireOperator(req, res))) return;

  const { urlHash, source } = req.query;

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  if (typeof urlHash !== 'string' || !urlHash || (source !== 'google' && source !== 'facebook')) {
    return res.status(400).json({ message: 'Bad Request: urlHash and valid source are required.' });
  }

  try {
    await dbConnect();
    
    // Add direct database query for debugging
    const ModelToUse = source === 'google' ? GoogleReviewBatchModel : FacebookReviewBatchModel;
    const BusinessUrlModel = source === 'google' ? GoogleBusinessUrlModel : FacebookBusinessUrlModel;
    
    // Check if any documents exist for this urlHash
    const allDocsWithUrlHash = await ModelToUse.find({ urlHash }).lean().exec();
    
    // Check all documents in the collection
    const totalDocs = await ModelToUse.countDocuments();
    
    // Get a sample of documents to see what urlHashes exist
    const sampleDocs = await ModelToUse.find({}).limit(5).select('urlHash businessUrlId').lean().exec();
    // console.log('Sample documents:', sampleDocs);
    
    // Check if business URL exists
    const businessUrl = await (BusinessUrlModel as any).findOne({ urlHash }).lean().exec();
    
    // If business URL exists, check for reviews by businessUrlId
    if (businessUrl) {
      const reviewsByBusinessId = await ModelToUse.find({ businessUrlId: businessUrl._id }).lean().exec();
      if (reviewsByBusinessId.length > 0) {
        // console.log('Sample review by businessUrlId:', reviewsByBusinessId[0]);
      }
    }
    
    const reviewBatch = await storage.getReviewBatchForBusinessUrl(urlHash, source as 'google' | 'facebook');
    
    if (!reviewBatch || !reviewBatch.reviews || reviewBatch.reviews.length === 0) {
      return res.status(200).json({ reviews: [] });
    }
    
    // Normalize Facebook review fields for frontend compatibility
    let reviews = reviewBatch.reviews;
    if (source === 'facebook') {
      reviews = reviews.map((review) => ({
        ...review,
        profilePicture: review.profilePicture || review.userProfile || '',
        recommendationStatus: review.recommendationStatus === 'recommended' ? 'recommended' : (review.recommendationStatus === 'not_recommended' ? 'not_recommended' : undefined),
        source: 'facebook',
      }));
    }

    // Deduplicate reviews (Fix for "110 reviews found" when only 100 actual reviews exist)
    const uniqueReviews: IReviewItem[] = [];
    const seenKeys = new Set<string>();

    for (const review of reviews) {
      // Create a unique key. Prefer reviewId, fallback to author+content hash if missing.
      // We also verify content isn't just whitespace/empty if we want to be strict, but for dedupe we focus on identity.
      const uniqueKey = review.reviewId 
        ? review.reviewId 
        : `${review.author}|${(review.content || '').substring(0, 50)}`;

      if (!seenKeys.has(uniqueKey)) {
        seenKeys.add(uniqueKey);
        uniqueReviews.push(review);
      }
    }
    reviews = uniqueReviews;
    
    return res.status(200).json({ reviews });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    const message = error instanceof Error ? error.message : 'Server error fetching reviews.';
    return res.status(500).json({ message });
  }
} 