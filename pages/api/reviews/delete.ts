import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import dbConnect from '../../../lib/mongodb';
import { GoogleReviewBatchModel, FacebookReviewBatchModel } from '../../../models/Review.model';
import { recordDeletedReview } from '../../../lib/storage';

/**
 * DELETE /api/reviews/delete  { reviewId, source, urlHash }
 *
 * Removes one scraped review from a business. Operators only: this used to accept
 * anyone, with no login at all.
 *
 * It removes the review from EVERY stored batch the business has (some have two),
 * and records the id so the crawler never adds it back on its next full crawl.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<{ success: boolean; message: string }>) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ success: false, message: 'Sign in to delete reviews.' });
  if (session.user.role === 'client') return res.status(403).json({ success: false, message: 'Forbidden.' });

  const { reviewId, source, urlHash } = req.body ?? {};
  // Text only: anything else could act as a database condition and match other reviews.
  if (typeof reviewId !== 'string' || !reviewId || typeof urlHash !== 'string' || !urlHash) {
    return res.status(400).json({ success: false, message: 'reviewId and urlHash are required.' });
  }
  if (source !== 'google' && source !== 'facebook') {
    return res.status(400).json({ success: false, message: 'source must be "google" or "facebook".' });
  }

  try {
    await dbConnect();
    const ReviewModel = source === 'google' ? GoogleReviewBatchModel : FacebookReviewBatchModel;
    const result = await ReviewModel.updateMany({ urlHash }, { $pull: { reviews: { reviewId } } }).exec();
    if (result.modifiedCount === 0) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }
    await recordDeletedReview({ source, reviewId, urlHash, deletedBy: session.user.id });
    return res.status(200).json({ success: true, message: 'Review deleted.' });
  } catch (error) {
    console.error('[reviews/delete] failed:', error);
    return res.status(500).json({ success: false, message: 'Could not delete the review.' });
  }
}
