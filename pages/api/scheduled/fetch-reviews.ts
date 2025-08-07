import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/mongodb';
import { getBusinessUrlsByUserId, getAllBusinessUrlsForDisplay, getBusinessUrlById, getLatestReviewDateForBusiness } from '../../../lib/storage';
import * as apify from '../../../lib/apify';
import { Types } from 'mongoose';

interface ScheduledFetchResponse {
  success: boolean;
  message: string;
  results: {
    totalBusinessUrls: number;
    successfulFetches: number;
    failedFetches: number;
    newReviewsFound: number;
    details: Array<{
      businessUrlId: string;
      businessName: string;
      source: 'google' | 'facebook';
      success: boolean;
      newReviewsCount: number;
      error?: string;
    }>;
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<ScheduledFetchResponse>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ 
      success: false, 
      message: `Method ${req.method} Not Allowed`,
      results: {
        totalBusinessUrls: 0,
        successfulFetches: 0,
        failedFetches: 0,
        newReviewsFound: 0,
        details: []
      }
    });
  }

  try {
    await dbConnect();
    console.log("[API /scheduled/fetch-reviews] DB Connected.");

    // Check if we're testing with a specific business URL ID
    const { businessUrlId: testBusinessUrlId, source } = req.body;
    
    let businessUrlsToProcess;
    
    if (testBusinessUrlId) {
      // Test mode: process only one specific business URL
      console.log(`[API /scheduled/fetch-reviews] TEST MODE: Processing single business URL ID: ${testBusinessUrlId}`);
      
      const businessUrl = await getBusinessUrlById(testBusinessUrlId);
      if (!businessUrl) {
        return res.status(404).json({
          success: false,
          message: `Business URL with ID ${testBusinessUrlId} not found.`,
          results: {
            totalBusinessUrls: 0,
            successfulFetches: 0,
            failedFetches: 1,
            newReviewsFound: 0,
            details: [{
              businessUrlId: testBusinessUrlId,
              businessName: 'Unknown',
              source: 'google',
              success: false,
              newReviewsCount: 0,
              error: 'Business URL not found'
            }]
          }
        });
      }
      
      businessUrlsToProcess = [{
        _id: businessUrl._id.toString(),
        name: businessUrl.name,
        url: businessUrl.url,
        source: businessUrl.source,
        urlHash: businessUrl.urlHash
      }];
    } else {
      // Normal mode: process all business URLs, optionally filter by source
      businessUrlsToProcess = await getAllBusinessUrlsForDisplay();
      if (source) {
        businessUrlsToProcess = businessUrlsToProcess.filter(bu => bu.source === source);
      }
    }

    console.log(`[API /scheduled/fetch-reviews] Found ${businessUrlsToProcess.length} business URLs to process.`);

    const results = {
      totalBusinessUrls: businessUrlsToProcess.length,
      successfulFetches: 0,
      failedFetches: 0,
      newReviewsFound: 0,
      details: [] as Array<{
        businessUrlId: string;
        businessName: string;
        source: 'google' | 'facebook';
        success: boolean;
        newReviewsCount: number;
        error?: string;
      }>
    };

    // Process each business URL
    for (const businessUrl of businessUrlsToProcess) {
      try {
        console.log(`[API /scheduled/fetch-reviews] Processing: ${businessUrl.name} (${businessUrl.source})`);
        let scrapeResult;
        if (businessUrl.source === 'google') {
          scrapeResult = await apify.scrapeGoogleReviews(businessUrl._id, 1000); // Limit to 1000 reviews per fetch
        } else if (businessUrl.source === 'facebook') {
          scrapeResult = await apify.scrapeFacebookReviews(businessUrl._id, 1000);
        } else {
          console.warn(`[API /scheduled/fetch-reviews] Unknown source: ${businessUrl.source} for ${businessUrl.name}`);
          results.details.push({
            businessUrlId: businessUrl._id,
            businessName: businessUrl.name,
            source: businessUrl.source as 'google' | 'facebook',
            success: false,
            newReviewsCount: 0,
            error: `Unknown source: ${businessUrl.source}`
          });
          results.failedFetches++;
          continue;
        }

        if (scrapeResult.success) {
          const newReviewsCount = scrapeResult.reviews?.length || 0;
          results.successfulFetches++;
          results.newReviewsFound += newReviewsCount;
          
          results.details.push({
            businessUrlId: businessUrl._id,
            businessName: businessUrl.name,
            source: businessUrl.source as 'google' | 'facebook',
            success: true,
            newReviewsCount
          });

          console.log(`[API /scheduled/fetch-reviews] Successfully fetched ${newReviewsCount} new reviews for ${businessUrl.name}`);
        } else {
          results.failedFetches++;
          results.details.push({
            businessUrlId: businessUrl._id,
            businessName: businessUrl.name,
            source: businessUrl.source as 'google' | 'facebook',
            success: false,
            newReviewsCount: 0,
            error: scrapeResult.message
          });
          console.error(`[API /scheduled/fetch-reviews] Failed to fetch reviews for ${businessUrl.name}: ${scrapeResult.message}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[API /scheduled/fetch-reviews] Error processing ${businessUrl.name}:`, errorMessage);
        
        results.failedFetches++;
        results.details.push({
          businessUrlId: businessUrl._id,
          businessName: businessUrl.name,
          source: businessUrl.source as 'google' | 'facebook',
          success: false,
          newReviewsCount: 0,
          error: errorMessage
        });
      }
    }

    const response: ScheduledFetchResponse = {
      success: true,
      message: testBusinessUrlId 
        ? `Test review fetch completed for business URL ID: ${testBusinessUrlId}. Found ${results.newReviewsFound} new reviews.`
        : `Scheduled review fetch completed. Processed ${results.totalBusinessUrls} business URLs. Found ${results.newReviewsFound} new reviews.`,
      results
    };

    console.log(`[API /scheduled/fetch-reviews] Completed:`, response);
    return res.status(200).json(response);

  } catch (error: unknown) {
    console.error('[API /scheduled/fetch-reviews] Error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected server error occurred during scheduled review fetching.';
    return res.status(500).json({
      success: false,
      message,
      results: {
        totalBusinessUrls: 0,
        successfulFetches: 0,
        failedFetches: 0,
        newReviewsFound: 0,
        details: []
      }
    });
  }
} 