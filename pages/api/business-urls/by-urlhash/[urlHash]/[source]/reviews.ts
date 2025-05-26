import type { NextApiRequest, NextApiResponse } from 'next';
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
  const { urlHash, source } = req.query;
  console.log('API called with:', { urlHash, source });

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  if (typeof urlHash !== 'string' || !urlHash || (source !== 'google' && source !== 'facebook')) {
    console.log('Invalid parameters:', { urlHash, source });
    return res.status(400).json({ message: 'Bad Request: urlHash and valid source are required.' });
  }

  try {
    await dbConnect();
    console.log('Fetching reviews for:', { urlHash, source });
    
    // Add direct database query for debugging
    const ModelToUse = source === 'google' ? GoogleReviewBatchModel : FacebookReviewBatchModel;
    const BusinessUrlModel = source === 'google' ? GoogleBusinessUrlModel : FacebookBusinessUrlModel;
    console.log('Using model:', source === 'google' ? 'GoogleReviewBatchModel' : 'FacebookReviewBatchModel');
    
    // Check if any documents exist for this urlHash
    const allDocsWithUrlHash = await ModelToUse.find({ urlHash }).lean().exec();
    console.log(`Found ${allDocsWithUrlHash.length} documents with urlHash ${urlHash}`);
    
    // Check all documents in the collection
    const totalDocs = await ModelToUse.countDocuments();
    console.log(`Total documents in ${source} collection:`, totalDocs);
    
    // Get a sample of documents to see what urlHashes exist
    const sampleDocs = await ModelToUse.find({}).limit(5).select('urlHash businessUrlId').lean().exec();
    console.log('Sample documents:', sampleDocs);
    
    // Check if business URL exists
    const businessUrl = await BusinessUrlModel.findOne({ urlHash }).lean().exec();
    console.log('Business URL found:', businessUrl ? `ID: ${businessUrl._id}, Name: ${businessUrl.name}` : 'null');
    
    // If business URL exists, check for reviews by businessUrlId
    if (businessUrl) {
      const reviewsByBusinessId = await ModelToUse.find({ businessUrlId: businessUrl._id }).lean().exec();
      console.log(`Reviews found by businessUrlId ${businessUrl._id}:`, reviewsByBusinessId.length);
      if (reviewsByBusinessId.length > 0) {
        console.log('Sample review by businessUrlId:', reviewsByBusinessId[0]);
      }
    }
    
    const reviewBatch = await storage.getReviewBatchForBusinessUrl(urlHash, source as 'google' | 'facebook');
    console.log('Review batch found:', reviewBatch ? `${reviewBatch.reviews?.length || 0} reviews` : 'null');
    
    if (!reviewBatch || !reviewBatch.reviews || reviewBatch.reviews.length === 0) {
      console.log('No reviews found, returning empty array');
      return res.status(200).json({ reviews: [] });
    }
    
    console.log('Returning reviews:', reviewBatch.reviews.length);
    return res.status(200).json({ reviews: reviewBatch.reviews });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    const message = error instanceof Error ? error.message : 'Server error fetching reviews.';
    return res.status(500).json({ message });
  }
} 