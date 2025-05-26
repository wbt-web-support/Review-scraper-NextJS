import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { GoogleReviewBatchModel, FacebookReviewBatchModel } from '@/models/Review.model';
import GoogleBusinessUrlModel from '@/models/GoogleBusinessUrl.model';
import FacebookBusinessUrlModel from '@/models/FacebookBusinessUrl.model';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    await dbConnect();
    
    // Count documents in each collection
    const googleBusinessUrlCount = await GoogleBusinessUrlModel.countDocuments();
    const facebookBusinessUrlCount = await FacebookBusinessUrlModel.countDocuments();
    const googleReviewBatchCount = await GoogleReviewBatchModel.countDocuments();
    const facebookReviewBatchCount = await FacebookReviewBatchModel.countDocuments();
    
    // Get sample business URLs
    const sampleGoogleBusinessUrls = await GoogleBusinessUrlModel.find({}).limit(3).lean().exec();
    const sampleFacebookBusinessUrls = await FacebookBusinessUrlModel.find({}).limit(3).lean().exec();
    
    // Get sample review batches
    const sampleGoogleReviewBatches = await GoogleReviewBatchModel.find({}).limit(3).lean().exec();
    const sampleFacebookReviewBatches = await FacebookReviewBatchModel.find({}).limit(3).lean().exec();
    
    // Check for the specific business mentioned in the logs
    const heatsealBusiness = await GoogleBusinessUrlModel.findOne({ 
      $or: [
        { urlHash: '1765014579' },
        { name: /heatseal/i }
      ]
    }).lean().exec();
    
    let heatsealReviews = null;
    let heatsealReviewsFullData = null;
    if (heatsealBusiness) {
      heatsealReviews = await GoogleReviewBatchModel.find({
        $or: [
          { urlHash: '1765014579' },
          { businessUrlId: heatsealBusiness._id }
        ]
      }).lean().exec();
      
      // Get the full review data for debugging
      heatsealReviewsFullData = await GoogleReviewBatchModel.findOne({
        urlHash: '1765014579'
      }).lean().exec();
    }
    
    return res.status(200).json({
      counts: {
        googleBusinessUrls: googleBusinessUrlCount,
        facebookBusinessUrls: facebookBusinessUrlCount,
        googleReviewBatches: googleReviewBatchCount,
        facebookReviewBatches: facebookReviewBatchCount
      },
      samples: {
        googleBusinessUrls: sampleGoogleBusinessUrls,
        facebookBusinessUrls: sampleFacebookBusinessUrls,
        googleReviewBatches: sampleGoogleReviewBatches.map(batch => ({
          _id: batch._id,
          urlHash: batch.urlHash,
          businessUrlId: batch.businessUrlId,
          reviewCount: batch.reviews?.length || 0,
          lastScrapedAt: batch.lastScrapedAt
        })),
        facebookReviewBatches: sampleFacebookReviewBatches.map(batch => ({
          _id: batch._id,
          urlHash: batch.urlHash,
          businessUrlId: batch.businessUrlId,
          reviewCount: batch.reviews?.length || 0,
          lastScrapedAt: batch.lastScrapedAt
        }))
      },
      heatsealBusiness,
      heatsealReviews: heatsealReviews?.map(batch => ({
        _id: batch._id,
        urlHash: batch.urlHash,
        businessUrlId: batch.businessUrlId,
        reviewCount: batch.reviews?.length || 0,
        lastScrapedAt: batch.lastScrapedAt
      })),
      heatsealReviewsFullData: heatsealReviewsFullData ? {
        _id: heatsealReviewsFullData._id,
        urlHash: heatsealReviewsFullData.urlHash,
        businessUrlId: heatsealReviewsFullData.businessUrlId,
        source: heatsealReviewsFullData.source,
        url: heatsealReviewsFullData.url,
        lastScrapedAt: heatsealReviewsFullData.lastScrapedAt,
        reviewCount: heatsealReviewsFullData.reviews?.length || 0,
        sampleReview: heatsealReviewsFullData.reviews?.[0] || null,
        reviewsStructure: heatsealReviewsFullData.reviews ? 'array' : 'missing'
      } : null
    });
  } catch (error) {
    console.error('Debug DB error:', error);
    const message = error instanceof Error ? error.message : 'Server error';
    return res.status(500).json({ message });
  }
} 