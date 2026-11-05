import type { NextApiRequest, NextApiResponse } from 'next';
import { Types } from 'mongoose';
import { requireOperator } from '../../../../lib/apiAuth';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import dbConnect from '@/lib/mongodb';
import * as storage from '@/lib/storage';
import { servicesFor } from '@/lib/reviewCategories';

/**
 * POST /api/business-urls/[id]/categorize   { dryRun?: boolean }
 *
 * Runs the service-category rules over every stored review of the business and
 * reports the counts. Reviews tagged by hand are left as they are. Reads only
 * what is stored: no crawl, no Apify spend.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<storage.RecategorizeResult | { message: string }>,
) {
  if (!(await requireOperator(req, res))) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  const { id } = req.query;
  if (typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid business id.' });
  }

  try {
    await dbConnect();
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) return res.status(401).json({ message: 'Unauthorized' });

    // Any operator, the same as starting a crawl from the business's page.
    const business = await storage.getBusinessUrlById(id);
    if (!business) return res.status(404).json({ message: 'Business not found.' });
    if (!business.urlHash || (business.source !== 'google' && business.source !== 'facebook')) {
      return res.status(500).json({ message: 'This business has no reviews to tag.' });
    }

    const dryRun = req.body?.dryRun === true;
    const result = await storage.recategorizeBusiness(business.urlHash, business.source, servicesFor(business), { dryRun });
    return res.status(200).json(result);
  } catch (error) {
    console.error('[categorize] failed:', error);
    return res.status(500).json({ message: 'Could not tag the reviews.' });
  }
}
