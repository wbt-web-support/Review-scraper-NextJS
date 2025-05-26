import type { NextApiRequest, NextApiResponse } from 'next';
import * as storage from '@/lib/storage';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    console.log('Testing getReviewBatchForBusinessUrl with Heatseal Solar data...');
    
    const urlHash = '1765014579';
    const source = 'google';
    
    const reviewBatch = await storage.getReviewBatchForBusinessUrl(urlHash, source);
    
    console.log('Result from getReviewBatchForBusinessUrl:', reviewBatch);
    
    return res.status(200).json({
      urlHash,
      source,
      reviewBatch: reviewBatch ? {
        _id: reviewBatch._id,
        urlHash: reviewBatch.urlHash,
        businessUrlId: reviewBatch.businessUrlId,
        source: reviewBatch.source,
        reviewCount: reviewBatch.reviews?.length || 0,
        reviews: reviewBatch.reviews || []
      } : null
    });
  } catch (error) {
    console.error('Test error:', error);
    const message = error instanceof Error ? error.message : 'Server error';
    return res.status(500).json({ message });
  }
} 