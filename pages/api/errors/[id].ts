import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { resolveError } from '../../../lib/errorTracker';

/** PATCH /api/errors/<id> -- an operator marks a tracked error as fixed. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', ['PATCH']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ message: 'Unauthorized' });
  if (session.user.role === 'client') return res.status(403).json({ message: 'Forbidden.' });
  const id = typeof req.query.id === 'string' ? req.query.id : '';
  const ok = await resolveError(id);
  return ok ? res.status(200).json({ ok: true }) : res.status(404).json({ message: 'Error not found.' });
}
