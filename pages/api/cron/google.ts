import type { NextApiRequest, NextApiResponse } from 'next';
import { runScheduledReviewFetch } from '../../../lib/scheduledReviewFetch';

function getRequestBaseUrl(req: NextApiRequest): string | undefined {
  const host = req.headers.host;
  if (!host) return undefined;
  const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
  return `${proto}://${host}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const data = await runScheduledReviewFetch({
      source: 'google',
      baseUrl: getRequestBaseUrl(req),
    });
    res.status(200).json({ message: 'Google script executed', output: data });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to execute Google script', details: error.message });
  }
}
