import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './[...nextauth]';
interface ISessionUser {
  id: string;
  name?: string | null; 
  email?: string | null;
  image?: string | null; 
  username?: string | null;
  fullName?: string | null; 
}
interface UserApiResponse {
  _id: string; 
  username: string;
  email: string;
  fullName?: string | null;
}
interface ErrorResponse {
  message: string;
}
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UserApiResponse | ErrorResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user) {
      return res.status(401).json({ message: 'Unauthorized: Not authenticated.' });
    }
    const sessionUser = session.user as ISessionUser; 
    if (!sessionUser.id || !sessionUser.email) {
      console.error('API Error in /api/auth/user: Essential data (id, email) missing from session user object.', sessionUser);
      return res.status(500).json({ message: 'Server error: Incomplete user session data.' });
    }
    const responseUser: UserApiResponse = {
      _id: sessionUser.id, 
      username: sessionUser.username || '', 
      email: sessionUser.email,
      fullName: sessionUser.fullName,
    };
    return res.status(200).json(responseUser);
  } catch (error: unknown) {
    console.error("API Error in /api/auth/user:", error);
    const message = error instanceof Error ? error.message : "Server error fetching user data.";
    return res.status(500).json({ message });
  }
}