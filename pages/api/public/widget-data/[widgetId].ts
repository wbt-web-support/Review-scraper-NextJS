import type { NextApiRequest, NextApiResponse } from 'next';
import * as storage from '../../../../lib/storage'; 
import dbConnect from '../../../../lib/mongodb';   
import { Types } from 'mongoose';
import { IWidgetSettingsFromForm, IReviewItemFromAPI } from '../../../../components/WidgetPreview'; 

export interface PublicWidgetDataResponse {
  widgetSettings: IWidgetSettingsFromForm;
  reviews: IReviewItemFromAPI[];
  businessName?: string; 
  businessUrlLink?: string;
  totalReviewCount?: number;
  totalFilteredReviewCount?: number;
  averageRating?: number | string;
}

// CORS headers for widget embedding
const setCorsHeaders = (res: NextApiResponse, noCache: boolean = false) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  
  if (noCache) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  } else {
    // Browsers keep it a minute, as before. Vercel's CDN keeps it 5 minutes and,
    // after that, answers instantly from the old copy while it fetches a fresh one
    // in the background -- so a visitor almost never waits on the database.
    // Reviews only change when a business is crawled, days apart; a widget edit
    // shows within about 5 minutes. The editor preview sends nocache and skips this.
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400');
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PublicWidgetDataResponse | { message: string }>
) {
  const { widgetId, nocache, t } = req.query;
  const isNoCache = nocache === 'true' || t !== undefined;
  
  // Set CORS headers for all requests
  setCorsHeaders(res, isNoCache);

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const limitQuery = req.query.limit;
  const offsetQuery = req.query.offset; // Add offset parameter for pagination
  const layoutQuery = req.query.layout;

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET', 'OPTIONS']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  if (typeof widgetId !== 'string' || !Types.ObjectId.isValid(widgetId)) {
    return res.status(400).json({ message: 'Invalid widget ID format.' });
  }

  try {
    await dbConnect();

    // Speed: on a cache miss almost all of this request's time is database round
    // trips (the queries themselves take a few milliseconds). So: the widget first,
    // WITHOUT populating its business, then everything else at once.
    const widgetDoc = await storage.getWidgetForPublicFeed(widgetId);

    if (!widgetDoc || (widgetDoc.isActive !== undefined && !widgetDoc.isActive)) {
      return res.status(404).json({ message: 'Widget not found or is not active.' });
    }

    // A video widget's reviews live in Supabase, not Mongo. Everything below this
    // point resolves a business URL and reads scraped reviews, which would either
    // throw or return an empty widget. Point the caller at the right feed instead.
    if (widgetDoc.type === 'video') {
      return res.status(400).json({
        message:
          'This is a video widget. Use /w.js with data-tenant="<embed key>", which reads /api/widget/<embed key>.',
      });
    }

    let reviews: IReviewItemFromAPI[] = [];
    let totalReviewCount = 0;
    let totalFilteredReviewCount = 0;
    let averageRating: number | string | undefined;

    const reviewSource: 'google' | 'facebook' = widgetDoc.businessUrlSource === 'FacebookBusinessUrl' ? 'facebook' : 'google';
    const offset = offsetQuery ? parseInt(offsetQuery as string) : 0;
    const requestedLimit = limitQuery ? parseInt(limitQuery as string) : (widgetDoc.initialReviewCount || 12);
    const reviewOptions = { minRating: widgetDoc.minRating, limit: requestedLimit, offset };

    // The name shown is the widget's own, exactly as before. (The old code looked
    // the business up with a populated object as its id, which always failed, so
    // live widgets have always shown this fallback. Kept so nothing visible moves.)
    const fetchedBusinessName = widgetDoc.businessUrl?.name || widgetDoc.name || "Review Widget";
    let fetchedBusinessUrlLink: string | undefined = widgetDoc.businessUrl?.url;

    const [statsAndReviews, batchUrl] = await Promise.all([
      widgetDoc.urlHash ? storage.getReviewStatsAndReviews(widgetDoc.urlHash, reviewSource, reviewOptions) : Promise.resolve(null),
      // The link, as before, comes from the review batch -- but only its url, not
      // every stored review, which is what the old fallback fetched.
      !fetchedBusinessUrlLink && widgetDoc.urlHash ? storage.getReviewBatchUrl(widgetDoc.urlHash, reviewSource) : Promise.resolve(null),
    ]);
    if (!fetchedBusinessUrlLink && batchUrl) fetchedBusinessUrlLink = batchUrl;

    let stats = statsAndReviews;
    if (!widgetDoc.urlHash && widgetDoc.businessUrlId) {
      // Very old widgets saved without a urlHash: take it from the business.
      const business = await storage.getBusinessUrlById(String(widgetDoc.businessUrlId));
      if (business?.urlHash) {
        stats = await storage.getReviewStatsAndReviews(business.urlHash, (business.source as 'google' | 'facebook') || 'google', reviewOptions);
      }
    }
    if (stats) {
      reviews = stats.reviews;
      totalReviewCount = stats.totalCount;
      totalFilteredReviewCount = stats.filteredCount || stats.totalCount;
      if (stats.averageRating !== undefined && stats.averageRating !== null) averageRating = stats.averageRating;
    }

    // Determine the source for the widget settings
    const widgetSource = widgetDoc.businessUrlSource === 'GoogleBusinessUrl' ? 'google' : 'facebook';

    const widgetSettingsForPublic: IWidgetSettingsFromForm = {
      name: widgetDoc.name,
      themeColor: widgetDoc.themeColor || '#3B82F6',
      layout: (widgetDoc.type as "grid" | "carousel" | "list" | "masonry" | "badge" | "bar" | "wall" | "text") || "grid",
      minRating: widgetSource === 'google' ? (widgetDoc.minRating || 1) : undefined, // Only include minRating for Google
      initialReviewCount: widgetDoc.initialReviewCount || 12,
      showRatings: widgetDoc.showRatings !== undefined ? widgetDoc.showRatings : true,
      showDates: widgetDoc.showDates !== undefined ? widgetDoc.showDates : true,
      showProfilePictures: widgetDoc.showProfilePictures !== undefined ? widgetDoc.showProfilePictures : true,
      businessUrl: {
        _id: widgetDoc.businessUrlId ? widgetDoc.businessUrlId.toString() : "",
        name: fetchedBusinessName || widgetDoc.name || "Review Widget",
        source: widgetSource as 'google' | 'facebook',
        url: fetchedBusinessUrlLink
      },
      platformName: widgetSource === 'google' ? 'Google' : 'Facebook',
      // Add reviewFilter for Facebook widgets
      ...(widgetSource === 'facebook' && {
        reviewFilter: (widgetDoc.minRating || 2) >= 2 ? 'recommended_only' : 'all_reviews',
        reviewFilterDisplay: (widgetDoc.minRating || 2) >= 2 ? 'Recommended only' : 'All reviews (recommended + not recommended)'
      })
    };

    // Filter out blank content reviews at API level
    const filteredReviews = reviews.filter(review => {
      const rawContent = review.content || review.text || '';
      
      // Check if content exists and is a string
      if (!rawContent || typeof rawContent !== 'string') {
        return false;
      }
      
      // Trim all types of whitespace (spaces, tabs, newlines, etc.)
      const content = rawContent.replace(/[\s\n\r\t\f\v\u00A0\u2000-\u200B\u2028\u2029\u3000]+/g, '').trim();
      
      // Check if content is meaningful (not empty, not just punctuation, and has reasonable length)
      const isMeaningfulContent = content.length > 2 && !/^[.,!?\-_]+$/.test(content);
      return isMeaningfulContent;
    });
    
    // Final deduplication at API level before returning
    const seen = new Set();
    const uniqueReviews = [];
    
    for (const review of filteredReviews) {
      // Use the same deduplication logic as the widget - prefer reviewId if available
      const reviewText = review.content || review.text || '';
      const uniqueKey = review.reviewId || `${review.author || ''}-${reviewText}-${review.postedAt || ''}`.toLowerCase().trim();
      
      if (!seen.has(uniqueKey)) {
        seen.add(uniqueKey);
        uniqueReviews.push(review);
      }
    }
    reviews = uniqueReviews;

    res.status(200).json({
      widgetSettings: widgetSettingsForPublic,
      reviews,
      businessName: fetchedBusinessName,
      businessUrlLink: fetchedBusinessUrlLink,
      totalReviewCount,
      totalFilteredReviewCount,
      averageRating,
    });

  } catch (error) {
    console.error(`[Widget API] Error fetching widget data for ID ${widgetId}:`, error);
    const message = error instanceof Error ? error.message : 'Server error fetching widget data.';
    res.status(500).json({ message });
  }
}