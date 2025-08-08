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

    console.log(`Looking for business URL with urlHash: ${targetUrlHash}`);

    // Use MongoDB client directly
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/review-scraper';
    const client = new MongoClient(uri);
    
    await client.connect();
    const db = client.db();

    // Check Google business URLs
    const googleCollection = db.collection('googlebusinessurls');
    const googleBusinessUrl = await googleCollection.findOne({ urlHash: targetUrlHash });
    
    // Check Facebook business URLs
    const facebookCollection = db.collection('facebookbusinessurls');
    const facebookBusinessUrl = await facebookCollection.findOne({ urlHash: targetUrlHash });

    // Also check what business URLs exist for the user
    const allGoogleUrls = await googleCollection.find({}).limit(10).toArray();
    const allFacebookUrls = await facebookCollection.find({}).limit(10).toArray();

    await client.close();

    res.status(200).json({
      message: 'Business URL search results',
      targetUrlHash,
      googleBusinessUrl,
      facebookBusinessUrl,
      sampleGoogleUrls: allGoogleUrls.map(url => ({ 
        _id: url._id, 
        name: url.name, 
        urlHash: url.urlHash 
      })),
      sampleFacebookUrls: allFacebookUrls.map(url => ({ 
        _id: url._id, 
        name: url.name, 
        urlHash: url.urlHash 
      }))
    });

  } catch (error) {
    console.error('Find business URL error:', error);
    const message = error instanceof Error ? error.message : 'Server error finding business URL.';
    res.status(500).json({ message });
  }
} 