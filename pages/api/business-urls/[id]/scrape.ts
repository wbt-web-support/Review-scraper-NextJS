import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { Types } from 'mongoose';
import { crawlBusinessNow } from '../../../../lib/reviewCrawler';

/**
 * POST /api/business-urls/<id>/scrape          crawl new reviews now
 * POST /api/business-urls/<id>/scrape?manual=true   fetch every review now (Recrawl)
 *
 * Both go through the scheduled crawler's own path, so a manual crawl has the same
 * guarantees: it only ever ADDS reviews (Recrawl used to replace them all with
 * whatever came back, which is how a short scrape cost clients reviews), it never
 * runs twice at once for one business, and if it outlasts this request the next
 * cron pass saves the results.
 */
export const config = { maxDuration: 300 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ message: 'Unauthorized: Not authenticated.' });
    }
    const { id } = req.query;
    if (typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid Business URL ID format.' });
    }

    const outcome = await crawlBusinessNow(id, { full: req.query.manual === 'true', waitSecs: 240 });
    switch (outcome.status) {
      case 'saved':
        return res.status(200).json({
          ...outcome,
          message: outcome.added
            ? `Found ${outcome.added} new review${outcome.added === 1 ? '' : 's'}.`
            : 'No new reviews. Everything is up to date.',
        });
      case 'running':
        return res.status(202).json({ ...outcome, message: 'Still crawling. New reviews will be saved automatically within 15 minutes.' });
      case 'skipped':
        return res.status(409).json({ ...outcome, message: outcome.error });
      default:
        return res.status(502).json({ ...outcome, message: outcome.error || 'Scraping service failed.' });
    }
  } catch (error: unknown) {
    console.error(`[API /scrape] ${req.query.id}:`, error);
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Scraping failed.' });
  }
}
