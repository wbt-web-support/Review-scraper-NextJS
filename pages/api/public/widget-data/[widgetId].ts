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

    console.log(`[Widget API] Fetching widget data for ID: ${widgetId}`);
    const widgetDoc = await storage.getWidgetById(widgetId);

    if (!widgetDoc || (widgetDoc.isActive !== undefined && !widgetDoc.isActive)) {
      console.log(`[Widget API] Widget not found or inactive: ${widgetId}`);
      return res.status(404).json({ message: 'Widget not found or is not active.' });
    }

    console.log(`[Widget API] Widget found: ${widgetDoc.name}, businessUrlId: ${widgetDoc.businessUrlId}`);
    console.log(`[Widget API] Widget properties:`, {
      themeColor: widgetDoc.themeColor,
      showRatings: widgetDoc.showRatings,
      showDates: widgetDoc.showDates,
      showProfilePictures: widgetDoc.showProfilePictures,
      minRating: widgetDoc.minRating,
      type: widgetDoc.type
    });

    let reviews: IReviewItemFromAPI[] = [];
    let fetchedBusinessName: string | undefined = undefined;
    let fetchedBusinessUrlLink: string | undefined = undefined;
    let totalReviewCount = 0; // Initialize totalReviewCount here

    if (widgetDoc.businessUrlId) {
      const businessUrlDoc = await storage.getBusinessUrlById(widgetDoc.businessUrlId.toString());
      if (businessUrlDoc) {
        fetchedBusinessName = businessUrlDoc.name;
        fetchedBusinessUrlLink = businessUrlDoc.url;
      }
    }
    // Fallbacks if DB lookup fails
    if (!fetchedBusinessName) {
      fetchedBusinessName = widgetDoc.businessUrl?.name || widgetDoc.name || "Review Widget";
    }
    if (!fetchedBusinessUrlLink) {
      fetchedBusinessUrlLink = widgetDoc.businessUrl?.url;
    }
    // Fallback: try to get from the review batch if available
    if (!fetchedBusinessUrlLink && widgetDoc.urlHash) {
      const reviewBatchForUrl = await storage.getReviewBatchForBusinessUrl(
        widgetDoc.urlHash,
        widgetDoc.businessUrlSource === 'GoogleBusinessUrl' ? 'google' : 'facebook'
      );
      if (reviewBatchForUrl && reviewBatchForUrl.url) {
        fetchedBusinessUrlLink = reviewBatchForUrl.url;
      }
    }

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
      let reviewSource: 'google' | 'facebook';
      switch (widgetDoc.businessUrlSource) {
        case 'GoogleBusinessUrl':
          reviewSource = 'google';
          break;
        case 'FacebookBusinessUrl':
          reviewSource = 'facebook';
          break;
        default:
          reviewSource = 'google'; // fallback
      }
      
      console.log(`[Widget API] Fetching reviews for urlHash: ${widgetDoc.urlHash}, source: ${reviewSource}`);
      
      // Add detailed debugging like the working API endpoint
      console.log(`[Widget API] Debugging: Using ${reviewSource} models for urlHash: ${widgetDoc.urlHash}`);
      const { GoogleReviewBatchModel, FacebookReviewBatchModel } = require('@/models/Review.model');
      const GoogleBusinessUrlModel = require('@/models/GoogleBusinessUrl.model').default;
      const FacebookBusinessUrlModel = require('@/models/FacebookBusinessUrl.model').default;
      
      const ModelToUse = reviewSource === 'google' ? GoogleReviewBatchModel : FacebookReviewBatchModel;
      const BusinessUrlModel = reviewSource === 'google' ? GoogleBusinessUrlModel : FacebookBusinessUrlModel;
      
      // Check if any documents exist for this urlHash
      const allDocsWithUrlHash = await ModelToUse.find({ urlHash: widgetDoc.urlHash }).lean().exec();
      console.log(`[Widget API] Debug: Found ${allDocsWithUrlHash.length} documents with urlHash ${widgetDoc.urlHash}`);
      
      // Get a sample of documents to see what urlHashes exist
      const sampleDocs = await ModelToUse.find({}).limit(5).select('urlHash businessUrlId').lean().exec();
      console.log('[Widget API] Debug: Sample documents:', sampleDocs);
      
      // Check if business URL exists
      const businessUrlCheck = await (BusinessUrlModel as any).findOne({ urlHash: widgetDoc.urlHash }).lean().exec();
      console.log('[Widget API] Debug: Business URL found:', businessUrlCheck ? `ID: ${businessUrlCheck._id}, Name: ${businessUrlCheck.name}` : 'null');
      
      // If business URL exists, check for reviews by businessUrlId  
      if (businessUrlCheck) {
        const reviewsByBusinessId = await ModelToUse.find({ businessUrlId: businessUrlCheck._id }).lean().exec();
        console.log(`[Widget API] Debug: Reviews found by businessUrlId ${businessUrlCheck._id}:`, reviewsByBusinessId.length);
        if (reviewsByBusinessId.length > 0) {
          console.log('[Widget API] Debug: Sample review by businessUrlId:', reviewsByBusinessId[0]);
        }
      }
      
      const reviewBatch = await storage.getReviewBatchForBusinessUrl(
        widgetDoc.urlHash,
        reviewSource
      );
      
      if (reviewBatch && reviewBatch.reviews) {
        console.log(`[Widget API] Found ${reviewBatch.reviews.length} reviews`);
        console.log(`[Widget API] Review batch source: ${reviewBatch.source}`);
        console.log(`[Widget API] Widget minRating: ${widgetDoc.minRating}`);
        console.log(`[Widget API] Sample review:`, reviewBatch.reviews[0]);
        totalReviewCount = reviewBatch.reviews.length;
        
        // For badge layout, use all available reviews without any limit
        let requestedLimit;
        if (layoutQuery === 'badge' || widgetDoc.type === 'badge') {
          requestedLimit = undefined; // No limit for badge widgets
        } else {
          requestedLimit = limitQuery ? parseInt(limitQuery as string) : 100000;
        }
        
        reviews = storage.getFilteredReviewsFromBatch(reviewBatch, {
          minRating: widgetDoc.minRating,
          limit: requestedLimit,
        });
        console.log(`[Widget API] Filtered to ${reviews.length} reviews (minRating: ${widgetDoc.minRating}, source: ${reviewBatch.source})`);
        
        if (reviewBatch.source === 'facebook') {
          console.log(`[Widget API] Facebook filtering: minRating=${widgetDoc.minRating} means ${widgetDoc.minRating >= 2 ? 'recommended only' : 'all reviews'}`);
        }
      } else {
        console.log(`[Widget API] No review batch found for urlHash: ${widgetDoc.urlHash}`);
        totalReviewCount = 0;
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
            const reviewSource: 'google' | 'facebook' = businessUrlDoc.source as 'google' | 'facebook';
            
            console.log(`[Widget API] Fallback: Fetching reviews for urlHash: ${businessUrlDoc.urlHash}, source: ${reviewSource}`);
            
            // Add detailed debugging like the working API endpoint
            console.log(`[Widget API] Debugging: Using ${reviewSource} models for urlHash: ${businessUrlDoc.urlHash}`);
            const { GoogleReviewBatchModel, FacebookReviewBatchModel } = require('@/models/Review.model');
            const GoogleBusinessUrlModel = require('@/models/GoogleBusinessUrl.model').default;
            const FacebookBusinessUrlModel = require('@/models/FacebookBusinessUrl.model').default;
            
            const ModelToUse = reviewSource === 'google' ? GoogleReviewBatchModel : FacebookReviewBatchModel;
            const BusinessUrlModel = reviewSource === 'google' ? GoogleBusinessUrlModel : FacebookBusinessUrlModel;
            
            // Check if any documents exist for this urlHash
            const allDocsWithUrlHash = await ModelToUse.find({ urlHash: businessUrlDoc.urlHash }).lean().exec();
            console.log(`[Widget API] Debug: Found ${allDocsWithUrlHash.length} documents with urlHash ${businessUrlDoc.urlHash}`);
            
            // Get a sample of documents to see what urlHashes exist
            const sampleDocs = await ModelToUse.find({}).limit(5).select('urlHash businessUrlId').lean().exec();
            console.log('[Widget API] Debug: Sample documents:', sampleDocs);
            
            // Check if business URL exists
            const businessUrlCheck = await (BusinessUrlModel as any).findOne({ urlHash: businessUrlDoc.urlHash }).lean().exec();
            console.log('[Widget API] Debug: Business URL found:', businessUrlCheck ? `ID: ${businessUrlCheck._id}, Name: ${businessUrlCheck.name}` : 'null');
            
            // If business URL exists, check for reviews by businessUrlId  
            if (businessUrlCheck) {
              const reviewsByBusinessId = await ModelToUse.find({ businessUrlId: businessUrlCheck._id }).lean().exec();
              console.log(`[Widget API] Debug: Reviews found by businessUrlId ${businessUrlCheck._id}:`, reviewsByBusinessId.length);
              if (reviewsByBusinessId.length > 0) {
                console.log('[Widget API] Debug: Sample review by businessUrlId:', reviewsByBusinessId[0]);
              }
            }
            
            const reviewBatch = await storage.getReviewBatchForBusinessUrl(
              businessUrlDoc.urlHash,
              reviewSource
            );
            
            if (reviewBatch && reviewBatch.reviews) {
              console.log(`[Widget API] Fallback: Found ${reviewBatch.reviews.length} reviews`);
              console.log(`[Widget API] Fallback: Review batch source: ${reviewBatch.source}`);
              console.log(`[Widget API] Fallback: Widget minRating: ${widgetDoc.minRating}`);
              console.log(`[Widget API] Fallback: Sample review:`, reviewBatch.reviews[0]);
              totalReviewCount = reviewBatch.reviews.length;
              
              // For badge layout, use all available reviews without any limit
              let requestedLimit;
              if (layoutQuery === 'badge' || widgetDoc.type === 'badge') {
                requestedLimit = undefined; // No limit for badge widgets
              } else {
                requestedLimit = limitQuery ? parseInt(limitQuery as string) : 10;
              }
              
              reviews = storage.getFilteredReviewsFromBatch(reviewBatch, {
                minRating: widgetDoc.minRating,
                limit: requestedLimit,
              });
              console.log(`[Widget API] Fallback: Filtered to ${reviews.length} reviews (minRating: ${widgetDoc.minRating}, source: ${reviewBatch.source})`);
              
              if (reviewBatch.source === 'facebook') {
                console.log(`[Widget API] Fallback: Facebook filtering: minRating=${widgetDoc.minRating} means ${widgetDoc.minRating >= 2 ? 'recommended only' : 'all reviews'}`);
              }
            } else {
              console.log(`[Widget API] Fallback: No review batch found for urlHash: ${businessUrlDoc.urlHash}`);
              totalReviewCount = 0;
            }
          } else {
            console.warn(`[Widget API] Business URL ${businessUrlDoc._id} is missing urlHash`);
            totalReviewCount = 0;
          }
        } else {
          console.warn(`[Widget API] Business URL not found for ID: ${widgetDoc.businessUrlId}`);
          totalReviewCount = 0;
        }
      } else {
        console.warn(`[Widget API] Widget ${widgetId} has no businessUrlId`);
        totalReviewCount = 0;
      }
    }

    // Determine the source for the widget settings
    const widgetSource = widgetDoc.businessUrlSource === 'GoogleBusinessUrl' ? 'google' : 'facebook';

    const widgetSettingsForPublic: IWidgetSettingsFromForm = {
      name: widgetDoc.name,
      themeColor: widgetDoc.themeColor || '#3B82F6',
      layout: (widgetDoc.type as "grid" | "carousel" | "list" | "masonry" | "badge") || "grid",
      minRating: widgetSource === 'google' ? (widgetDoc.minRating || 1) : undefined, // Only include minRating for Google
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

    console.log(`[Widget API] Returning ${reviews.length} reviews for widget ${widgetId}`);
    console.log(`[Widget API] totalReviewCount being returned: ${totalReviewCount}`);
    console.log(`[Widget API] Widget settings being returned:`, JSON.stringify(widgetSettingsForPublic, null, 2));

    res.status(200).json({
      widgetSettings: widgetSettingsForPublic,
      reviews,
      businessName: fetchedBusinessName,
      businessUrlLink: fetchedBusinessUrlLink,
      totalReviewCount,
    });

  } catch (error) {
    console.error(`[Widget API] Error fetching widget data for ID ${widgetId}:`, error);
    const message = error instanceof Error ? error.message : 'Server error fetching widget data.';
    res.status(500).json({ message });
  }
}