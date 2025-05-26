import type { NextApiRequest, NextApiResponse } from 'next';
import * as storage from '../../../lib/storage';
import dbConnect from '../../../lib/mongodb';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    await dbConnect();
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }
    const businessUrls = await storage.getAllBusinessUrlsForDisplay();
    return res.status(200).json({ businessUrls });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An internal server error occurred.';
    return res.status(500).json({ message });
  }
} 