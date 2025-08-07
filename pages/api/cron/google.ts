import type { NextApiRequest, NextApiResponse } from 'next';
import { runScheduledReviewFetch } from '../../../lib/scheduledReviewFetch';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const data = await runScheduledReviewFetch({ source: 'google' });
    res.status(200).json({ message: 'Google script executed', output: data });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to execute Google script', details: error.message });
  }
}
