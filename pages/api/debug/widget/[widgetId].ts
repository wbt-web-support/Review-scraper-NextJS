import type { NextApiRequest, NextApiResponse } from 'next';
import * as storage from '../../../../lib/storage';
import dbConnect from '../../../../lib/mongodb';
import { Types } from 'mongoose';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { widgetId } = req.query;

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  if (typeof widgetId !== 'string' || !Types.ObjectId.isValid(widgetId)) {
    return res.status(400).json({ message: 'Invalid widget ID format.' });
  }

  try {
    await dbConnect();

    const widgetDoc = await storage.getWidgetById(widgetId);
    
    if (!widgetDoc) {
      return res.status(404).json({ message: 'Widget not found.' });
    }

    // Get business URL info if it exists
    let businessUrlInfo = null;
    if (widgetDoc.businessUrlId) {
      businessUrlInfo = await storage.getBusinessUrlById(widgetDoc.businessUrlId.toString());
    }

    // Get all business URLs to see what's available
    const allBusinessUrls = await storage.getAllBusinessUrlsForDisplay();

    res.status(200).json({
      widget: widgetDoc,
      businessUrlInfo,
      allBusinessUrls: allBusinessUrls.slice(0, 5), // Just first 5 for debugging
      debug: {
        hasBusinessUrlId: !!widgetDoc.businessUrlId,
        businessUrlIdString: widgetDoc.businessUrlId?.toString(),
        businessUrlSource: widgetDoc.businessUrlSource,
      }
    });

  } catch (error) {
    console.error(`Debug API Error for widget ID ${widgetId}:`, error);
    const message = error instanceof Error ? error.message : 'Server error.';
    res.status(500).json({ message });
  }
} 