import { ApifyClient } from 'apify-client';
import { getBusinessUrlById, updateBusinessUrlScrapedTime, mergeNewReviews, getLatestReviewDateForBusiness } from './storage';
import { IReviewItem } from '../models/Review.model'; 

const GOOGLE_APIFY_TOKEN = process.env.GOOGLE_APIFY_API_TOKEN;
const FACEBOOK_APIFY_TOKEN = process.env.FACEBOOK_APIFY_API_TOKEN;
const GOOGLE_REVIEWS_ACTOR_NAME = "compass/google-maps-reviews-scraper";
const FACEBOOK_REVIEWS_ACTOR_NAME = "apify/facebook-reviews-scraper";

if (!GOOGLE_APIFY_TOKEN) {
  console.warn("WARNING: GOOGLE_APIFY_API_TOKEN is not set. Google review scraping will likely fail.");
}
const googleClient = new ApifyClient({ token: GOOGLE_APIFY_TOKEN || '' });
if (!FACEBOOK_APIFY_TOKEN) {
  console.warn("WARNING: FACEBOOK_APIFY_API_TOKEN is not set. Facebook review scraping will likely fail.");
}
const facebookClient = new ApifyClient({ token: FACEBOOK_APIFY_TOKEN || '' });
interface ApifyGoogleReviewItem {
    reviewId?: string;
    id?: string | number;
    name?: string;
    authorName?: string;
    text?: string;
    reviewText?: string;
    stars?: number;
    rating?: number;
    publishedAtDate?: string;
    date?: string;
    userUrl?: string;
    reviewerPhotoUrl?: string;
    profilePictureUrl?: string;
  }
  
  interface ApifyFacebookReviewItem {
    review_id?: string | number;
    id?: string | number;
    author_name?: string;
    name?: string;
    review_text?: string;
    text?: string;
    review_time?: string;
    date?: string;
    author_avatar?: string;
    user_avatar?: string;
    recommendation_type?: string;
    scrapedAt?: string | Date;
    user?: {
      id?: string;
      name?: string;
      profileUrl?: string;
      profilePic?: string;
    };
    isRecommended?: boolean;
  }

const parseGoogleReviewFromApify = (item: ApifyGoogleReviewItem): IReviewItem => {
    return {
        reviewId: item.reviewId || item.id?.toString(),
        author: item.name || item.authorName || "Anonymous Reviewer",
        content: (item.text || item.reviewText || "").toString(), // Always a string
        rating: typeof item.stars === 'number' ? item.stars : (typeof item.rating === 'number' ? item.rating : undefined),
        postedAt: item.publishedAtDate || item.date || "Recently",
        profilePicture: item.userUrl || item.reviewerPhotoUrl || item.profilePictureUrl,
    }
};

const parseFacebookReviewFromApify = (item: ApifyFacebookReviewItem): IReviewItem => {
    return {
        reviewId: item.review_id?.toString() || item.id?.toString(),
        author: item.user?.name || item.author_name || item.name || "Anonymous Reviewer",
        content: item.review_text || item.text || "",
        postedAt: item.date || item.review_time || "Recently",
        profilePicture: item.user?.profilePic || item.author_avatar || item.user_avatar,
        recommendationStatus: typeof item.isRecommended === 'boolean'
          ? (item.isRecommended ? 'recommended' : 'not_recommended')
          : item.recommendation_type,
        scrapedAt: item.scrapedAt ? new Date(item.scrapedAt) : undefined, 
    }
};



interface ScrapeResult {
    success: boolean;
    message: string;
    reviews?: IReviewItem[];
}

export const scrapeGoogleReviews = async (businessUrlId: string, maxReviewsParam?: number, fromDate?: Date): Promise<ScrapeResult> => {
    if (!GOOGLE_APIFY_TOKEN) {
      return { success: false, message: "Google Apify token not configured." };
    }
    try {
      const businessUrlDoc = await getBusinessUrlById(businessUrlId); 
      if (!businessUrlDoc) throw new Error('Business URL not found.');
      if (businessUrlDoc.source !== 'google') throw new Error('Business URL source is not Google.');
      if (!businessUrlDoc.url) throw new Error('Business URL is missing.');
     
      // If no fromDate provided, get the latest review date from database
      let effectiveFromDate: Date | null | undefined = fromDate;
      if (!effectiveFromDate) {
        effectiveFromDate = await getLatestReviewDateForBusiness(businessUrlId, 'google');
        if (effectiveFromDate) {
          console.log(`[Apify/scrapeGoogleReviews] Using latest review date from database: ${effectiveFromDate.toISOString()}`);
        } else {
          console.log(`[Apify/scrapeGoogleReviews] No existing reviews found, will fetch all reviews`);
        }
      }
     
      const input = { 
        startUrls: [{ url: businessUrlDoc.url }], 
        language: "en",
        maxReviews: maxReviewsParam || 10000, // Set a high default to get all reviews
        resultsLimit: 99999, // Set to unlimited to get all available reviews
        ...(effectiveFromDate && { 
          reviewsStartDate: effectiveFromDate.toISOString() // full ISO format: "2025-07-01T00:00:00.000Z"
        })
      }; 

      console.log(`Starting Apify actor: ${GOOGLE_REVIEWS_ACTOR_NAME} for business ID: ${businessUrlId} with maxReviews: ${input.maxReviews}${effectiveFromDate ? ` and date filter: ${effectiveFromDate.toISOString().split('T')[0]}` : ''}`);
      const run = await googleClient.actor(GOOGLE_REVIEWS_ACTOR_NAME).call(input);
      const { items } = await googleClient.dataset(run.defaultDatasetId).listItems();
     
      if (!items || items.length === 0) {
        await updateBusinessUrlScrapedTime(businessUrlId, 'google'); 
        console.log(`No new Google reviews found from Apify for business ID: ${businessUrlId}`);
        return { success: true, message: 'No new reviews found from Apify.', reviews: [] };
      }
  
      console.log(`Found ${items.length} Google reviews from Apify for business ID: ${businessUrlId}. Parsing...`);
      // Always set content, and filter out reviews with empty content
      const parsedApifyReviews: IReviewItem[] = items
        .map(item => parseGoogleReviewFromApify(item as ApifyGoogleReviewItem))
        .filter(review => review.content && review.content.trim().length > 0);
      
      // No need to filter client-side since we're using Apify's built-in date filtering
      console.log(`Using Apify's built-in date filtering - all ${parsedApifyReviews.length} reviews are newer than ${effectiveFromDate?.toISOString().split('T')[0] || 'all dates'}`);
      
      const businessIdString = businessUrlDoc._id.toString();
  
      await mergeNewReviews({
          businessUrlId: businessIdString,
          url: businessUrlDoc.url,
          urlHash: businessUrlDoc.urlHash, 
          source: 'google',
          reviews: parsedApifyReviews
      });
      await updateBusinessUrlScrapedTime(businessIdString, 'google');
      console.log(`Successfully scraped and merged ${parsedApifyReviews.length} Google reviews for business ID: ${businessUrlId}`);
      return { success: true, message: `Scraped ${parsedApifyReviews.length} Google reviews.`, reviews: parsedApifyReviews };
  
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Google review scraping failed due to an unknown error.';
      console.error(`Error scraping Google reviews for business ID ${businessUrlId}:`, message, error);
      return { success: false, message };
    }
};
  
export const scrapeFacebookReviews = async (businessUrlId: string, maxReviewsParam?: number, fromDate?: Date): Promise<ScrapeResult> => {
    if (!FACEBOOK_APIFY_TOKEN) {
      return { success: false, message: "Facebook Apify token not configured." };
    }
    try {
      const businessUrlDoc = await getBusinessUrlById(businessUrlId);
      if (!businessUrlDoc) throw new Error('Business URL not found.');
      if (businessUrlDoc.source !== 'facebook') throw new Error('Business URL source is not Facebook.');
      if (!businessUrlDoc.url) throw new Error('Business URL is missing.');
  
      // If no fromDate provided, get the latest review date from database
      let effectiveFromDate: Date | null | undefined = fromDate;
      if (!effectiveFromDate) {
        effectiveFromDate = await getLatestReviewDateForBusiness(businessUrlId, 'facebook');
        if (effectiveFromDate) {
          console.log(`[Apify/scrapeFacebookReviews] Using latest review date from database: ${effectiveFromDate.toISOString()}`);
        } else {
          console.log(`[Apify/scrapeFacebookReviews] No existing reviews found, will fetch all reviews`);
        }
      }
  
      // REMOVE onlyReviewsNewerThan from input, always fetch all reviews
      const input = { 
        startUrls: [{ url: businessUrlDoc.url }],
        maxReviews: maxReviewsParam || 10000, // Set a high default to get all reviews
        scrapeReviews: true,
        resultsLimit: 99999 // Set to unlimited to get all available reviews
        // Do NOT include onlyReviewsNewerThan
      };
      console.log(`Starting Apify actor: ${FACEBOOK_REVIEWS_ACTOR_NAME} for business ID: ${businessUrlId} with maxReviews: ${input.maxReviews}`);
      const run = await facebookClient.actor(FACEBOOK_REVIEWS_ACTOR_NAME).call(input);
      console.log(`Apify actor run for Facebook completed. Dataset ID: ${run.defaultDatasetId}`);
      const { items } = await facebookClient.dataset(run.defaultDatasetId).listItems();
  
      if (!items || items.length === 0) {
        await updateBusinessUrlScrapedTime(businessUrlId, 'facebook');
        console.log(`No new Facebook reviews found from Apify for business ID: ${businessUrlId}`);
        return { success: true, message: 'No new reviews found from Apify.', reviews: [] };
      }
      console.log(`Found ${items.length} Facebook reviews from Apify for business ID: ${businessUrlId}. Parsing...`);
      const parsedApifyReviews: IReviewItem[] = items.map(item => parseFacebookReviewFromApify(item as ApifyFacebookReviewItem));
      
      // Client-side date filtering for Facebook reviews
      let filteredReviews = parsedApifyReviews;
      if (effectiveFromDate) {
        filteredReviews = parsedApifyReviews.filter(review => {
          if (!review.postedAt) return false;
          const reviewDate = new Date(review.postedAt);
          return reviewDate > effectiveFromDate;
        });
        console.log(`[Apify/scrapeFacebookReviews] Filtered ${parsedApifyReviews.length - filteredReviews.length} old reviews, ${filteredReviews.length} remain after date filter.`);
      } else {
        console.log(`[Apify/scrapeFacebookReviews] No effectiveFromDate, using all ${parsedApifyReviews.length} reviews.`);
      }
      
      const businessIdString = businessUrlDoc._id.toString();
      await mergeNewReviews({
          businessUrlId: businessIdString,
          url: businessUrlDoc.url,
          urlHash: businessUrlDoc.urlHash,
          source: 'facebook',
          reviews: filteredReviews
      });
      await updateBusinessUrlScrapedTime(businessIdString, 'facebook');
      console.log(`Successfully scraped and merged ${filteredReviews.length} Facebook reviews for business ID: ${businessUrlId}`);
      return { success: true, message: `Scraped ${filteredReviews.length} Facebook reviews.`, reviews: filteredReviews };
  
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Facebook review scraping failed due to an unknown error.';
      console.error(`Error scraping Facebook reviews for business ID ${businessUrlId}:`, message, error);
      return { success: false, message };
    }
};