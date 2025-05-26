import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/mongodb';
import WidgetModel from '../../../models/Widget.model';
import { Types } from 'mongoose';

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
    const correctBusinessUrlId = '6826f23eede7b71586fd8a47'; // From your data
    const correctUrlHash = '752957005'; // From your data

    console.log(`Fixing widget ${widgetId}...`);

    const result = await WidgetModel.updateOne(
      { _id: new Types.ObjectId(widgetId) },
      {
        $set: {
          businessUrlId: new Types.ObjectId(correctBusinessUrlId),
          businessUrlSource: 'GoogleBusinessUrl', // Change to Google
          urlHash: correctUrlHash, // Add the correct urlHash
          minRating: 0, // Show all reviews
        }
      }
    );

    console.log('Update result:', result);

    // Get the updated widget
    const updatedWidget = await WidgetModel.findById(widgetId).lean().exec();

    res.status(200).json({
      message: 'Widget fixed successfully',
      result,
      updatedWidget
    });

  } catch (error) {
    console.error('Fix widget error:', error);
    const message = error instanceof Error ? error.message : 'Server error fixing widget.';
    res.status(500).json({ message });
  }
} 