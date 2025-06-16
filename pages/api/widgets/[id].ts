import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import dbConnect from '@/lib/mongodb';
import * as storage from '@/lib/storage';

interface ErrorResponse {
  message: string;
}

interface UpdateWidgetData {
  name?: string;
  businessUrlId?: string;
  themeColor?: string;
  type?: string;
  layout?: string;
  minRating?: number;
  showRatings?: boolean;
  showDates?: boolean;
  showProfilePictures?: boolean;
  maxReviews?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any | ErrorResponse>
) {
  // CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,DELETE,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'DELETE' && req.method !== 'PUT') {
    res.setHeader('Allow', ['DELETE', 'PUT']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    // Connect to database
    await dbConnect();

    // Verify user authentication
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Get widget ID from query
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ message: 'Widget ID is required.' });
    }

    if (req.method === 'DELETE') {
      // Delete widget from database
      const result = await storage.deleteWidget(id);
      if (result.deletedCount === 0) {
        return res.status(404).json({ message: 'Widget not found or already deleted.' });
      }

      // Return success response
      return res.status(200).json(result);
    }

    if (req.method === 'PUT') {
      // Update widget
      const updateData: UpdateWidgetData = req.body;
      
      // Validate required fields for update
      if (!updateData.name || !updateData.businessUrlId) {
        return res.status(400).json({ message: 'Name and business URL ID are required.' });
      }

      // Map layout to type if provided
      if (updateData.layout && !updateData.type) {
        updateData.type = updateData.layout;
      }

      // Update widget in database
      const updatedWidget = await storage.updateWidget(id, updateData);
      if (!updatedWidget) {
        return res.status(404).json({ message: 'Widget not found.' });
      }

      // Return updated widget
      return res.status(200).json(updatedWidget);
    }

  } catch (error: unknown) {
    console.error('API Error in /api/widgets/[id]:', error);
    const message = error instanceof Error ? error.message : 'Server error processing widget request.';
    return res.status(500).json({ message });
  }
} 