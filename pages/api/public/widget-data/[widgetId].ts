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
}

// CORS headers for widget embedding
const setCorsHeaders = (res: NextApiResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes cache
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PublicWidgetDataResponse | { message: string }>
) {
  // Set CORS headers for all requests
  setCorsHeaders(res);

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { widgetId } = req.query;
  const limitQuery = req.query.limit;

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET', 'OPTIONS']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  if (typeof widgetId !== 'string' || !Types.ObjectId.isValid(widgetId)) {
    return res.status(400).json({ message: 'Invalid widget ID format.' });
  }

  try {
    await dbConnect();

    console.log(`[Widget API] Fetching widget data for ID: ${widgetId}`);
    const widgetDoc = await storage.getWidgetById(widgetId);

    if (!widgetDoc || (widgetDoc.isActive !== undefined && !widgetDoc.isActive)) {
      console.log(`[Widget API] Widget not found or inactive: ${widgetId}`);
      return res.status(404).json({ message: 'Widget not found or is not active.' });
    }

    console.log(`[Widget API] Widget found: ${widgetDoc.name}, businessUrlId: ${widgetDoc.businessUrlId}`);

    let reviews: IReviewItemFromAPI[] = [];
    let fetchedBusinessName: string | undefined = widgetDoc.businessUrl?.name;
    let fetchedBusinessUrlLink: string | undefined = widgetDoc.businessUrl?.url;

    // Simplified approach: use urlHash directly from widget document
    if (widgetDoc.urlHash) {
      console.log(`[Widget API] Using urlHash from widget: ${widgetDoc.urlHash}`);
      
      // Get business URL info for display purposes only
      let businessUrlDoc = null;
      if (widgetDoc.businessUrlId) {
        businessUrlDoc = await storage.getBusinessUrlById(widgetDoc.businessUrlId.toString());
        if (businessUrlDoc) {
          fetchedBusinessName = businessUrlDoc.name;
          fetchedBusinessUrlLink = businessUrlDoc.url;
        }
      }
      
      // Determine source from businessUrlSource field
      const reviewSource = widgetDoc.businessUrlSource === 'GoogleBusinessUrl' ? 'google' : 'facebook';
      
      console.log(`[Widget API] Fetching reviews for urlHash: ${widgetDoc.urlHash}, source: ${reviewSource}`);
      
      const reviewBatch = await storage.getReviewBatchForBusinessUrl(
        widgetDoc.urlHash,
        reviewSource
      );
      
      if (reviewBatch && reviewBatch.reviews) {
        console.log(`[Widget API] Found ${reviewBatch.reviews.length} reviews`);
        reviews = storage.getFilteredReviewsFromBatch(reviewBatch, {
          minRating: widgetDoc.minRating,
          limit: parseInt(limitQuery as string) || 10,
        });
        console.log(`[Widget API] Filtered to ${reviews.length} reviews (minRating: ${widgetDoc.minRating})`);
      } else {
        console.log(`[Widget API] No review batch found for urlHash: ${widgetDoc.urlHash}`);
      }
    } else {
      console.warn(`[Widget API] Widget ${widgetId} has no urlHash - using fallback method`);
      
      // Fallback to old method for existing widgets without urlHash
      if (widgetDoc.businessUrlId) {
        console.log(`[Widget API] Getting business URL for ID: ${widgetDoc.businessUrlId}`);
        
        const businessUrlDoc = await storage.getBusinessUrlById(widgetDoc.businessUrlId.toString());
        
        if (businessUrlDoc) {
          console.log(`[Widget API] Business URL found: ${businessUrlDoc.name}, urlHash: ${businessUrlDoc.urlHash}, source: ${businessUrlDoc.source}`);
          
          fetchedBusinessName = businessUrlDoc.name;
          fetchedBusinessUrlLink = businessUrlDoc.url;
          
          if (businessUrlDoc.urlHash) {
            const reviewSource = businessUrlDoc.source as 'google' | 'facebook';
            
            console.log(`[Widget API] Fetching reviews for urlHash: ${businessUrlDoc.urlHash}, source: ${reviewSource}`);
            
            const reviewBatch = await storage.getReviewBatchForBusinessUrl(
              businessUrlDoc.urlHash,
              reviewSource
            );
            
            if (reviewBatch && reviewBatch.reviews) {
              console.log(`[Widget API] Found ${reviewBatch.reviews.length} reviews`);
              reviews = storage.getFilteredReviewsFromBatch(reviewBatch, {
                minRating: widgetDoc.minRating,
                limit: parseInt(limitQuery as string) || 10,
              });
              console.log(`[Widget API] Filtered to ${reviews.length} reviews (minRating: ${widgetDoc.minRating})`);
            } else {
              console.log(`[Widget API] No review batch found for urlHash: ${businessUrlDoc.urlHash}`);
            }
          } else {
            console.warn(`[Widget API] Business URL ${businessUrlDoc._id} is missing urlHash`);
          }
        } else {
          console.warn(`[Widget API] Business URL not found for ID: ${widgetDoc.businessUrlId}`);
        }
      } else {
        console.warn(`[Widget API] Widget ${widgetId} has no businessUrlId`);
      }
    }

    // Determine the source for the widget settings
    const widgetSource = widgetDoc.businessUrlSource === 'GoogleBusinessUrl' ? 'google' : 'facebook';

    const widgetSettingsForPublic: IWidgetSettingsFromForm = {
      name: widgetDoc.name,
      themeColor: widgetDoc.settings?.themeColor as string || widgetDoc.themeColor || '#3B82F6',
      layout: widgetDoc.type,
      minRating: widgetDoc.minRating,
      showRatings: (widgetDoc.settings?.showRatings as boolean) ?? widgetDoc.showRatings,
      showDates: (widgetDoc.settings?.showDates as boolean) ?? widgetDoc.showDates,
      showProfilePictures: (widgetDoc.settings?.showProfilePictures as boolean) ?? widgetDoc.showProfilePictures,
      businessUrl: {
        _id: widgetDoc.businessUrlId ? widgetDoc.businessUrlId.toString() : "",
        name: fetchedBusinessName || widgetDoc.name || "Review Widget",
        source: widgetSource as 'google' | 'facebook',
        url: fetchedBusinessUrlLink
      },
    };

    console.log(`[Widget API] Returning ${reviews.length} reviews for widget ${widgetId}`);

    res.status(200).json({
      widgetSettings: widgetSettingsForPublic,
      reviews,
      businessName: fetchedBusinessName,
      businessUrlLink: fetchedBusinessUrlLink,
    });

  } catch (error) {
    console.error(`[Widget API] Error fetching widget data for ID ${widgetId}:`, error);
    const message = error instanceof Error ? error.message : 'Server error fetching widget data.';
    res.status(500).json({ message });
  }
}