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
    const urlHash = '752957005';

    console.log(`Adding urlHash ${urlHash} to widget ${widgetId}...`);

    // Use $set to add the urlHash field
    const result = await WidgetModel.updateOne(
      { _id: new Types.ObjectId(widgetId) },
      { $set: { urlHash: urlHash } }
    );

    console.log('Update result:', result);

    // Verify the update
    const updatedWidget = await WidgetModel.findById(widgetId).lean().exec();
    console.log('Updated widget urlHash:', updatedWidget?.urlHash);

    res.status(200).json({
      message: 'urlHash added successfully',
      result,
      urlHash: updatedWidget?.urlHash
    });

  } catch (error) {
    console.error('Add urlHash error:', error);
    const message = error instanceof Error ? error.message : 'Server error adding urlHash.';
    res.status(500).json({ message });
  }
} 