import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import * as storage from '@/lib/storage';
import { IReviewItem } from '@/models/Review.model';
import { ReviewModel } from '@/models/Review.model';
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
    
    // Fetch all reviews for this business and source from the new ReviewModel
    const reviews = await ReviewModel.find({ urlHash, source }).lean().exec();
    console.log('Returning reviews:', reviews.length);
    return res.status(200).json({ reviews });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    const message = error instanceof Error ? error.message : 'Server error fetching reviews.';
    return res.status(500).json({ message });
  }
} 