import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { Types } from 'mongoose';
import { authOptions } from '../../auth/[...nextauth]';
import dbConnect from '../../../../lib/mongodb';
import * as storage from '../../../../lib/storage';
import WidgetModel from '../../../../models/Widget.model';

/**
 * Manage a business's key for the JSON reviews API (GET /api/public/reviews).
 *
 *   GET    -> { apiKey: string | null }   the current key, if one exists
 *   POST   -> { apiKey: string }          create it, or replace it (old key dies now)
 *   DELETE -> { apiKey: null }            revoke it, switching the API off
 *
 * Who may: a signed-in operator who owns the business or owns a widget for it. The
 * widget half matters because operators share businesses -- the widget modal lists
 * every business, not just your own -- and the person looking at a widget's Embed
 * Code tab has to be able to use it. Client logins are refused outright: the key
 * is the agency's to hand out, and a client never sees this screen.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');

  if (!['GET', 'POST', 'DELETE'].includes(req.method ?? '')) {
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    await dbConnect();
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user?.id) {
      return res.status(401).json({ message: 'Unauthorized: Not authenticated.' });
    }
    if (session.user.role === 'client') {
      return res.status(403).json({ message: 'Forbidden.' });
    }
    const userId = session.user.id as string;

    const businessId = req.query.id;
    if (typeof businessId !== 'string' || !Types.ObjectId.isValid(businessId)) {
      return res.status(400).json({ message: 'Invalid business id.' });
    }

    const business = await storage.getBusinessUrlById(businessId);
    if (!business) {
      return res.status(404).json({ message: 'Business not found.' });
    }
    const ownsBusiness = business.userId?.toString() === userId;
    const ownsWidget = ownsBusiness
      ? true
      : Boolean(await WidgetModel.exists({ businessUrlId: new Types.ObjectId(businessId), userId: new Types.ObjectId(userId) }));
    if (!ownsBusiness && !ownsWidget) {
      return res.status(403).json({ message: 'Forbidden: you have no widget for this business.' });
    }

    if (req.method === 'GET') {
      return res.status(200).json({ apiKey: await storage.getBusinessApiKey(businessId) });
    }
    if (req.method === 'POST') {
      const apiKey = await storage.rotateBusinessApiKey(businessId);
      return res.status(200).json({ apiKey });
    }
    await storage.revokeBusinessApiKey(businessId);
    return res.status(200).json({ apiKey: null });
  } catch (error) {
    console.error('[business api-key]', error instanceof Error ? error.message : error);
    return res.status(500).json({ message: 'Could not update the API key.' });
  }
}
