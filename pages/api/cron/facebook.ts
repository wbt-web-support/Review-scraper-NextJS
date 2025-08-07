import type { NextApiRequest, NextApiResponse } from 'next';
import { runScheduledReviewFetch } from '../../../lib/scheduledReviewFetch';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const data = await runScheduledReviewFetch({ source: 'facebook' });
    res.status(200).json({ message: 'Facebook script executed', output: data });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to execute Facebook script', details: error.message });
  }
}
