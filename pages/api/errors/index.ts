import type { NextApiRequest, NextApiResponse } from 'next';
import { parseBrowserReport, recordError } from '../../../lib/errorTracker';

/**
 * POST /api/errors -- a browser on one of our own pages reporting an uncaught error.
 *
 * No login needed (errors happen on the login page too), so it is fenced instead:
 * same-site requests only, small bodies only, and a per-sender rate limit.
 */
export const config = { api: { bodyParser: { sizeLimit: '8kb' } } };

const hits = new Map<string, { at: number; n: number }>();
const LIMIT_PER_MINUTE = 30;

function sameSite(req: NextApiRequest): boolean {
  const origin = req.headers.origin || req.headers.referer;
  if (!origin) return false;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }
  if (!sameSite(req)) return res.status(204).end();

  const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim();
  const now = Date.now();
  const h = hits.get(ip);
  if (h && now - h.at < 60_000) {
    if (++h.n > LIMIT_PER_MINUTE) return res.status(204).end();
  } else {
    if (hits.size > 5000) hits.clear();
    hits.set(ip, { at: now, n: 1 });
  }

  const report = parseBrowserReport(req.body);
  if (report) {
    const error = new Error(report.message);
    error.stack = report.stack ? `Error: ${report.message}\n${report.stack.split('\n').filter((l) => l.trim().startsWith('at ')).join('\n')}` : error.stack;
    await recordError({ where: 'browser', error, route: report.route, extra: { userAgent: report.userAgent } });
  }
  return res.status(204).end();
}
