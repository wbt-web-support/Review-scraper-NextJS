import type { NextApiRequest, NextApiResponse } from 'next';
import * as storage from '../../../../lib/storage';
import dbConnect from '../../../../lib/mongodb';
import { Types } from 'mongoose';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  const { widgetId } = req.query;

  if (typeof widgetId !== 'string' || !Types.ObjectId.isValid(widgetId)) {
    return res.status(400).json({ message: 'Invalid widget ID format.' });
  }

  try {
    await dbConnect();

    const widgetDoc = await storage.getWidgetById(widgetId);
    
    if (!widgetDoc) {
      return res.status(404).json({ message: 'Widget not found.' });
    }

    // Also get the business URL if it exists
    let businessUrl = null;
    if (widgetDoc.businessUrlId) {
      businessUrl = await storage.getBusinessUrlById(widgetDoc.businessUrlId.toString());
    }

    res.status(200).json({
      widget: widgetDoc,
      businessUrl: businessUrl,
      debug: {
        businessUrlIdType: typeof widgetDoc.businessUrlId,
        businessUrlIdString: widgetDoc.businessUrlId?.toString(),
        businessUrlSource: widgetDoc.businessUrlSource,
      }
    });

  } catch (error) {
    console.error('Error fetching raw widget data:', error);
    const message = error instanceof Error ? error.message : 'Server error fetching widget data.';
    res.status(500).json({ message });
  }
} 