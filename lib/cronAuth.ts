import { timingSafeEqual } from 'crypto';
import type { NextApiRequest } from 'next';

/**
 * Who may trigger a crawl. Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`
 * when the project has a CRON_SECRET env var, so with it set, only Vercel gets in.
 *
 * Without it the route stays open rather than refusing: refusing would silently
 * stop every scheduled crawl, which is the failure this whole module exists to
 * prevent. The response and the logs both say so, loudly, until it is set.
 */
export function checkCronAuth(req: NextApiRequest): { ok: boolean; warning?: string } {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    const warning = 'CRON_SECRET is not set, so anyone can trigger a crawl. Add it in Vercel > Settings > Environment Variables.';
    console.warn(`[cron] ${warning}`);
    return { ok: true, warning };
  }
  const given = Buffer.from(req.headers.authorization ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return { ok: given.length === expected.length && timingSafeEqual(given, expected) };
}
