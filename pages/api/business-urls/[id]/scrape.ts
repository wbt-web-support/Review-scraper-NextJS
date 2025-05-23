import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]'; 
import * as storage from '../../../../lib/storage';
import * as apify from '../../../../lib/apify';
import dbConnect from '../../../../lib/mongodb';
import { Types } from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
  try {
    await dbConnect();
    console.log("[API /scrape] DB Connected.");
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user?.id) {
      return res.status(401).json({ message: 'Unauthorized: Not authenticated.' });
    }
    const userId_string = session.user.id as string;;
    const { id: businessUrlId_param } = req.query;
    if (typeof businessUrlId_param !== 'string' || !Types.ObjectId.isValid(businessUrlId_param)) {
      console.log("[API /scrape] Invalid businessUrlId_param:", businessUrlId_param);
      return res.status(400).json({ message: 'Invalid Business URL ID format.' });
    }
    const businessUrl = await storage.getBusinessUrlById(businessUrlId_param);
    if (!businessUrl) {
      return res.status(404).json({ message: 'Business URL not found.' });
    }
    if (businessUrl.userId?.toString() !== userId_string) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to access this resource.' });
    }
    const maxReviewsQueryParam = req.query.maxReviews;
    const maxReviews = typeof maxReviewsQueryParam === 'string' && !isNaN(parseInt(maxReviewsQueryParam))
      ? parseInt(maxReviewsQueryParam)
      : 100; 
    console.log(`[API /scrape] Max reviews: ${maxReviews}`);
    let result;
    if (businessUrl.source === 'google') {
      console.log(`[API /scrape] Calling apify.scrapeGoogleReviews for ID: ${businessUrlId_param}`);
      result = await apify.scrapeGoogleReviews(businessUrlId_param, maxReviews);
    } else if (businessUrl.source === 'facebook') {
      result = await apify.scrapeFacebookReviews(businessUrlId_param, maxReviews);
    } else {
      return res.status(400).json({ message: `Unsupported source: ${businessUrl.source}` });
    }
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(502).json({ message: result.message || "Scraping service failed." , details: result });
    }
  } catch (error: unknown) {
    console.error(`API Error in /api/business-urls/[id]/scrape for ID [${req.query.id}]:`, error);
    const message = error instanceof Error ? error.message : 'An unexpected server error occurred during scraping.';
    return res.status(500).json({ message });
  }
};