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

    console.log(`Fixing businessUrlId for widget ${widgetId}...`);
    console.log(`Setting businessUrlId to: ${correctBusinessUrlId}`);

    // Use MongoDB client directly
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/review-scraper';
    const client = new MongoClient(uri);
    
    await client.connect();
    const db = client.db();
    const collection = db.collection('widgets');

    // First, let's check if the businessUrlId exists in the business URLs collection
    const businessUrlCollection = db.collection('googlebusinessurls');
    const businessUrlExists = await businessUrlCollection.findOne({ _id: new ObjectId(correctBusinessUrlId) });
    
    if (!businessUrlExists) {
      await client.close();
      return res.status(400).json({ 
        message: 'Business URL not found',
        businessUrlId: correctBusinessUrlId 
      });
    }

    console.log('Business URL exists:', businessUrlExists.name);

    // Update just the businessUrlId field
    const result = await collection.updateOne(
      { _id: new ObjectId(widgetId) },
      {
        $set: {
          businessUrlId: new ObjectId(correctBusinessUrlId),
          updatedAt: new Date()
        }
      }
    );

    console.log('BusinessUrlId update result:', result);

    // Verify the update
    const updatedWidget = await collection.findOne({ _id: new ObjectId(widgetId) });
    console.log('Updated widget businessUrlId:', updatedWidget?.businessUrlId);

    await client.close();

    res.status(200).json({
      message: 'BusinessUrlId fixed successfully',
      result,
      businessUrlId: updatedWidget?.businessUrlId,
      businessUrlExists: businessUrlExists.name
    });

  } catch (error) {
    console.error('Fix businessUrlId error:', error);
    const message = error instanceof Error ? error.message : 'Server error fixing businessUrlId.';
    res.status(500).json({ message });
  }
} 