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

    console.log(`Checking actual collections for urlHash: ${targetUrlHash}`);

    // Use MongoDB client directly
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/review-scraper';
    const client = new MongoClient(uri);
    
    await client.connect();
    const db = client.db();

    // Check business_reviews collection
    const businessReviewsCollection = db.collection('business_reviews');
    const businessReviewBatch = await businessReviewsCollection.findOne({ urlHash: targetUrlHash });
    
    // Check facebook_reviews collection
    const facebookReviewsCollection = db.collection('facebook_reviews');
    const facebookReviewBatch = await facebookReviewsCollection.findOne({ urlHash: targetUrlHash });

    // Check business_urls collection
    const businessUrlsCollection = db.collection('business_urls');
    const businessUrl = await businessUrlsCollection.findOne({ urlHash: targetUrlHash });

    // Check facebook_business_urls collection
    const facebookBusinessUrlsCollection = db.collection('facebook_business_urls');
    const facebookBusinessUrl = await facebookBusinessUrlsCollection.findOne({ urlHash: targetUrlHash });

    // Get samples from each collection
    const sampleBusinessReviews = await businessReviewsCollection.find({}).limit(3).toArray();
    const sampleFacebookReviews = await facebookReviewsCollection.find({}).limit(3).toArray();
    const sampleBusinessUrls = await businessUrlsCollection.find({}).limit(3).toArray();
    const sampleFacebookBusinessUrls = await facebookBusinessUrlsCollection.find({}).limit(3).toArray();

    await client.close();

    res.status(200).json({
      message: 'Actual collections search results',
      targetUrlHash,
      businessReviewBatch: businessReviewBatch ? {
        _id: businessReviewBatch._id,
        urlHash: businessReviewBatch.urlHash,
        reviewCount: businessReviewBatch.reviews?.length || 0,
        url: businessReviewBatch.url
      } : null,
      facebookReviewBatch: facebookReviewBatch ? {
        _id: facebookReviewBatch._id,
        urlHash: facebookReviewBatch.urlHash,
        reviewCount: facebookReviewBatch.reviews?.length || 0,
        url: facebookReviewBatch.url
      } : null,
      businessUrl: businessUrl ? {
        _id: businessUrl._id,
        name: businessUrl.name,
        urlHash: businessUrl.urlHash,
        url: businessUrl.url
      } : null,
      facebookBusinessUrl: facebookBusinessUrl ? {
        _id: facebookBusinessUrl._id,
        name: facebookBusinessUrl.name,
        urlHash: facebookBusinessUrl.urlHash,
        url: facebookBusinessUrl.url
      } : null,
      samples: {
        businessReviews: sampleBusinessReviews.map(r => ({ _id: r._id, urlHash: r.urlHash, reviewCount: r.reviews?.length || 0 })),
        facebookReviews: sampleFacebookReviews.map(r => ({ _id: r._id, urlHash: r.urlHash, reviewCount: r.reviews?.length || 0 })),
        businessUrls: sampleBusinessUrls.map(u => ({ _id: u._id, name: u.name, urlHash: u.urlHash })),
        facebookBusinessUrls: sampleFacebookBusinessUrls.map(u => ({ _id: u._id, name: u.name, urlHash: u.urlHash }))
      }
    });

  } catch (error) {
    console.error('Check actual collections error:', error);
    const message = error instanceof Error ? error.message : 'Server error checking actual collections.';
    res.status(500).json({ message });
  }
} 