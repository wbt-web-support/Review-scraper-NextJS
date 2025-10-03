import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/mongodb';
import { GoogleReviewBatchModel, FacebookReviewBatchModel } from '../../../models/Review.model';
import { Types } from 'mongoose';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: boolean; message: string }>
) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).json({ 
      success: false, 
      message: `Method ${req.method} Not Allowed` 
    });
  }

  const { reviewId, source, urlHash } = req.body;

  // Validate required fields
  if (!reviewId || !source || !urlHash) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: reviewId, source, and urlHash are required'
    });
  }

  // Validate source
  if (!['google', 'facebook'].includes(source)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid source. Must be either "google" or "facebook"'
    });
  }

  try {
    await dbConnect();

    // Select the appropriate model based on source
    const ReviewModel = source === 'google' ? GoogleReviewBatchModel : FacebookReviewBatchModel;

    // Find the review batch by urlHash
    const reviewBatch = await ReviewModel.findOne({ urlHash });

    if (!reviewBatch) {
      return res.status(404).json({
        success: false,
        message: 'Review batch not found'
      });
    }

    // Find the review to delete
    const reviewIndex = reviewBatch.reviews.findIndex(
      (review: any) => review.reviewId === reviewId
    );

    if (reviewIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Remove the review from the array
    reviewBatch.reviews.splice(reviewIndex, 1);

    // Save the updated review batch
    await reviewBatch.save();

    return res.status(200).json({
      success: true,
      message: 'Review deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting review:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while deleting review'
    });
  }
}
