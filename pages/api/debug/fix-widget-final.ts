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
    const correctBusinessUrlId = '6826f23eede7b71586fd8a46'; // From business_urls collection
    const correctUrlHash = '752957005';

    console.log(`Final fix for widget ${widgetId}...`);
    console.log(`Setting businessUrlId to: ${correctBusinessUrlId} (from business_urls collection)`);

    // Use MongoDB client directly
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/review-scraper';
    const client = new MongoClient(uri);
    
    await client.connect();
    const db = client.db();
    const collection = db.collection('widgets');

    // Update the widget with correct data
    const result = await collection.updateOne(
      { _id: new ObjectId(widgetId) },
      {
        $set: {
          businessUrlId: new ObjectId(correctBusinessUrlId),
          businessUrlSource: 'GoogleBusinessUrl',
          urlHash: correctUrlHash,
          minRating: 0, // Show all reviews
          updatedAt: new Date()
        }
      }
    );

    console.log('Final update result:', result);

    // Verify the update
    const updatedWidget = await collection.findOne({ _id: new ObjectId(widgetId) });
    console.log('Final updated widget:', updatedWidget);

    await client.close();

    res.status(200).json({
      message: 'Widget fixed with correct businessUrlId from business_urls collection',
      result,
      updatedWidget: {
        _id: updatedWidget?._id,
        businessUrlId: updatedWidget?.businessUrlId,
        urlHash: updatedWidget?.urlHash,
        minRating: updatedWidget?.minRating,
        businessUrlSource: updatedWidget?.businessUrlSource
      }
    });

  } catch (error) {
    console.error('Final fix error:', error);
    const message = error instanceof Error ? error.message : 'Server error with final fix.';
    res.status(500).json({ message });
  }
} 