import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getDashboardOverview } from '../../../lib/dashboard';
import type { DashboardOverview } from '../../../lib/dashboard';

/**
 * Workspace-wide numbers, the same for every operator, and they move only when a
 * crawl lands. So one copy is kept for a minute per server instance: the first
 * load does the work, the next ones are instant.
 */
let cached: { at: number; data: DashboardOverview } | null = null;
const CACHE_MS = 60_000;

/** GET /api/dashboard/overview -- the operator dashboard's data, in one request. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ message: 'Unauthorized' });
  // Workspace-wide numbers are for operators; a client sees only their own page.
  if (session.user.role === 'client') return res.status(403).json({ message: 'Forbidden.' });
  try {
    const fresh = req.query.fresh === '1';
    if (!cached || fresh || Date.now() - cached.at > CACHE_MS) {
      cached = { at: Date.now(), data: await getDashboardOverview() };
    }
    return res.status(200).json(cached.data);
  } catch (error) {
    console.error('[dashboard/overview]', error);
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Could not load the dashboard.' });
  }
}
