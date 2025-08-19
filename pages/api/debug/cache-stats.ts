import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getLatestReviewsCacheStats, clearLatestReviewsCache } from '@/lib/storage';

interface CacheStatsResponse {
  stats?: {
    totalEntries: number;
    expiredEntries: number;
    validEntries: number;
    cacheSize: number;
  };
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CacheStatsResponse>
) {
  console.log(`[API /cache-stats] Method: ${req.method}`);

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session || !session.user?.id) {
      console.log("[API /cache-stats] Unauthorized.");
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (req.method === 'GET') {
      // Get cache statistics
      const stats = getLatestReviewsCacheStats();
      console.log(`[API /cache-stats] Cache stats:`, stats);
      return res.status(200).json({ stats });
    } else if (req.method === 'POST') {
      // Clear cache
      const { userId } = req.body;
      clearLatestReviewsCache(userId);
      return res.status(200).json({ message: `Cache cleared${userId ? ` for user ${userId}` : ' for all users'}` });
    }

  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[API /cache-stats] Error:`, err.message, err.stack);
    return res.status(500).json({ message: err.message || "Server error getting cache stats." });
  }
}
