import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession, type Session } from 'next-auth';
import { authOptions } from '../pages/api/auth/[...nextauth]';

/**
 * For routes only the agency's own team may use. Refuses anyone not signed in, and
 * client logins: a client signs in through the same /login, so "signed in" alone
 * does not mean operator. Sends the response itself; callers just
 * `if (!(await requireOperator(req, res))) return;`.
 */
export async function requireOperator(req: NextApiRequest, res: NextApiResponse): Promise<Session | null> {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    res.status(401).json({ message: 'Unauthorized: Not authenticated.' });
    return null;
  }
  if (session.user.role === 'client') {
    res.status(403).json({ message: 'Forbidden.' });
    return null;
  }
  return session;
}
