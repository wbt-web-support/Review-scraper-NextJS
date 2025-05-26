import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/mongodb';
import { MongoClient, ObjectId } from 'mongodb';

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

    const widgetId = '6832c330dd506564ff9d8b8d';
    const correctBusinessUrlId = '6826f23eede7b71586fd8a47';
    const correctUrlHash = '752957005';

    console.log(`Direct fix for widget ${widgetId}...`);

    // Use MongoDB client directly to bypass any Mongoose schema issues
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/review-scraper';
    const client = new MongoClient(uri);
    
    await client.connect();
    const db = client.db();
    const collection = db.collection('widgets');

    // Direct MongoDB update
    const result = await collection.updateOne(
      { _id: new ObjectId(widgetId) },
      {
        $set: {
          businessUrlId: new ObjectId(correctBusinessUrlId),
          businessUrlSource: 'GoogleBusinessUrl',
          urlHash: correctUrlHash,
          minRating: 0,
          updatedAt: new Date()
        }
      }
    );

    console.log('Direct update result:', result);

    // Verify the update
    const updatedWidget = await collection.findOne({ _id: new ObjectId(widgetId) });
    console.log('Updated widget:', updatedWidget);

    await client.close();

    res.status(200).json({
      message: 'Widget fixed with direct MongoDB update',
      result,
      updatedWidget
    });

  } catch (error) {
    console.error('Direct fix error:', error);
    const message = error instanceof Error ? error.message : 'Server error with direct fix.';
    res.status(500).json({ message });
  }
} 