import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/mongodb';
import { MongoClient } from 'mongodb';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    await dbConnect();

    const targetUrlHash = '752957005';

    console.log(`Checking review collections for urlHash: ${targetUrlHash}`);

    // Use MongoDB client directly
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/review-scraper';
    const client = new MongoClient(uri);
    
    await client.connect();
    const db = client.db();

    // Check Google review batches
    const googleReviewsCollection = db.collection('googlereviewbatches');
    const googleReviewBatch = await googleReviewsCollection.findOne({ urlHash: targetUrlHash });
    
    // Check Facebook review batches  
    const facebookReviewsCollection = db.collection('facebookreviewbatches');
    const facebookReviewBatch = await facebookReviewsCollection.findOne({ urlHash: targetUrlHash });

    // Also check what review batches exist
    const allGoogleBatches = await googleReviewsCollection.find({}).limit(5).toArray();
    const allFacebookBatches = await facebookReviewsCollection.find({}).limit(5).toArray();

    // Check all collections in the database
    const collections = await db.listCollections().toArray();

    await client.close();

    res.status(200).json({
      message: 'Review collections search results',
      targetUrlHash,
      googleReviewBatch: googleReviewBatch ? {
        _id: googleReviewBatch._id,
        urlHash: googleReviewBatch.urlHash,
        businessUrlId: googleReviewBatch.businessUrlId,
        reviewCount: googleReviewBatch.reviews?.length || 0,
        url: googleReviewBatch.url
      } : null,
      facebookReviewBatch: facebookReviewBatch ? {
        _id: facebookReviewBatch._id,
        urlHash: facebookReviewBatch.urlHash,
        businessUrlId: facebookReviewBatch.businessUrlId,
        reviewCount: facebookReviewBatch.reviews?.length || 0,
        url: facebookReviewBatch.url
      } : null,
      sampleGoogleBatches: allGoogleBatches.map(batch => ({
        _id: batch._id,
        urlHash: batch.urlHash,
        businessUrlId: batch.businessUrlId,
        reviewCount: batch.reviews?.length || 0
      })),
      sampleFacebookBatches: allFacebookBatches.map(batch => ({
        _id: batch._id,
        urlHash: batch.urlHash,
        businessUrlId: batch.businessUrlId,
        reviewCount: batch.reviews?.length || 0
      })),
      allCollections: collections.map(c => c.name)
    });

  } catch (error) {
    console.error('Check reviews error:', error);
    const message = error instanceof Error ? error.message : 'Server error checking reviews.';
    res.status(500).json({ message });
  }
} 