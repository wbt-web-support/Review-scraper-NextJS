import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]'; 
import dbConnect from '@/lib/mongodb'; 

interface StatsResponse {
  totalWidgets?: number;
  totalReviews?: number;
  averageRating?: number;
  totalViews?: number;
  message?: string;
}
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StatsResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
  try {
    await dbConnect();
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const stats = {
      totalWidgets: 5,
      totalReviews: 150,
      averageRating: 4.5,
      totalViews: 1200,
    };
    if (!stats) {
        return res.status(404).json({ message: "Statistics not found." });
    }
    return res.status(200).json(stats);
  } catch (error: unknown) {
    console.error("API Error in /api/dashboard/stats:", error);
    const message = error instanceof Error ? error.message : "Server error fetching dashboard stats.";
    return res.status(500).json({ message });
  }
}