import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import dbConnect from '@/lib/mongodb';
import * as storage from '@/lib/storage';

interface ErrorResponse {
  message: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ acknowledged: boolean; deletedCount: number } | ErrorResponse>
) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
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

    // Delete widget from database
    const result = await storage.deleteWidget(id);
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Widget not found or already deleted.' });
    }

    // Return success response
    return res.status(200).json(result);
  } catch (error: unknown) {
    console.error('API Error in /api/widgets/[id]:', error);
    const message = error instanceof Error ? error.message : 'Server error deleting widget.';
    return res.status(500).json({ message });
  }
} 