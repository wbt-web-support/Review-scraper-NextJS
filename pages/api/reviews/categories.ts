import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import dbConnect from '../../../lib/mongodb';
import * as storage from '../../../lib/storage';
import { CATEGORY_KEY, servicesFor } from '../../../lib/reviewCategories';

/**
 * POST /api/reviews/categories  { reviewId, source, urlHash, categories }
 *
 * Sets one review's service categories by hand. `categories` is a list of keys
 * from the business's services (an empty list means general feedback), or null
 * to hand the review back to the automatic rules. Operators only.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ categories: string[]; categorySource: 'rule' | 'manual' } | { message: string }>,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ message: 'Sign in to tag reviews.' });
  if (session.user.role === 'client') return res.status(403).json({ message: 'Forbidden.' });

  const { reviewId, source, urlHash, categories } = req.body ?? {};
  if (typeof reviewId !== 'string' || !reviewId || typeof urlHash !== 'string' || !urlHash) {
    return res.status(400).json({ message: 'reviewId and urlHash are required.' });
  }
  if (source !== 'google' && source !== 'facebook') {
    return res.status(400).json({ message: 'source must be "google" or "facebook".' });
  }
  if (categories !== null && (!Array.isArray(categories) || !categories.every((c) => typeof c === 'string' && CATEGORY_KEY.test(c)))) {
    return res.status(400).json({ message: 'categories must be a list of category keys, or null.' });
  }

  try {
    await dbConnect();
    const business = await storage.getBusinessUrlByUrlHash(urlHash);
    const services = servicesFor(business);
    const known = new Set(services.map((s) => s.key));
    if (Array.isArray(categories)) {
      const unknown = categories.find((c: string) => !known.has(c));
      if (unknown) return res.status(400).json({ message: `"${unknown}" is not one of this business's services.` });
    }

    const result = await storage.setReviewCategories(source, urlHash, reviewId, categories, services);
    if (!result) return res.status(404).json({ message: 'Review not found.' });
    return res.status(200).json(result);
  } catch (error) {
    console.error('[reviews/categories] failed:', error);
    return res.status(500).json({ message: 'Could not save the categories.' });
  }
}
