import type { NextApiRequest, NextApiResponse } from 'next';
import { checkCronAuth } from '../../../lib/cronAuth';
import { runCrawlBatch } from '../../../lib/reviewCrawler';

/**
 * Every 15 minutes (vercel.json). One pass of the review crawler: saves finished
 * Apify runs and starts the next few overdue businesses. Most passes take seconds;
 * the budget below keeps even a busy one well inside the function limit.
 */
export const config = { maxDuration: 300 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
  const auth = checkCronAuth(req);
  if (!auth.ok) return res.status(401).json({ message: 'Unauthorized.' });

  try {
    // ?dryRun=1 shows who would be crawled next, and from when, without starting anything.
    const summary = await runCrawlBatch({ budgetMs: 240_000, dryRun: req.query.dryRun === '1' });
    return res.status(200).json({ ...summary, ...(auth.warning ? { warning: auth.warning } : {}) });
  } catch (error) {
    console.error('[cron/crawl] pass failed:', error);
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Crawl pass failed.' });
  }
}
