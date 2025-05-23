import { ApifyClient } from 'apify-client';
import { getBusinessUrlById, updateBusinessUrlScrapedTime, upsertReviews } from './storage';
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
  }

const parseGoogleReviewFromApify = (item: ApifyGoogleReviewItem): IReviewItem => {
    return {
        reviewId: item.reviewId || item.id?.toString(),
        author: item.name || item.authorName || "Anonymous Reviewer",
        content: item.text || item.reviewText || "",
        rating: typeof item.stars === 'number' ? item.stars : (typeof item.rating === 'number' ? item.rating : undefined),
        postedAt: item.publishedAtDate || item.date || "Recently",
        profilePicture: item.userUrl || item.reviewerPhotoUrl || item.profilePictureUrl,
    }
};

const parseFacebookReviewFromApify = (item: ApifyFacebookReviewItem): IReviewItem => {
    return {
        reviewId: item.review_id?.toString() || item.id?.toString(),
        author: item.author_name || item.name || "Anonymous Reviewer",
        content: item.review_text || item.text || "",
        postedAt: item.review_time || item.date || "Recently",
        profilePicture: item.author_avatar || item.user_avatar,
        recommendationStatus: item.recommendation_type,
        scrapedAt: item.scrapedAt ? new Date(item.scrapedAt) : undefined, 
    }
};

interface ScrapeResult {
    success: boolean;
    message: string;
    reviews?: IReviewItem[];
}

export const scrapeGoogleReviews = async (businessUrlId: string, maxReviewsParam?: number): Promise<ScrapeResult> => {
    if (!GOOGLE_APIFY_TOKEN) {
      return { success: false, message: "Google Apify token not configured." };
    }
    try {
      const businessUrlDoc = await getBusinessUrlById(businessUrlId); 
      if (!businessUrlDoc) throw new Error('Business URL not found.');
      if (businessUrlDoc.source !== 'google') throw new Error('Business URL source is not Google.');
      if (!businessUrlDoc.url) throw new Error('Business URL is missing.');
  
  
      const input = { startUrls: [{ url: businessUrlDoc.url }], maxReviews: maxReviewsParam || 100, language: "en" };
      console.log(`Starting Apify actor: ${GOOGLE_REVIEWS_ACTOR_NAME} for business ID: ${businessUrlId}`);
      const run = await googleClient.actor(GOOGLE_REVIEWS_ACTOR_NAME).call(input);
      console.log(`Apify actor run for Google completed. Dataset ID: ${run.defaultDatasetId}`);
      const { items } = await googleClient.dataset(run.defaultDatasetId).listItems();
  
      if (!items || items.length === 0) {
        await updateBusinessUrlScrapedTime(businessUrlId, 'google'); 
        console.log(`No new Google reviews found from Apify for business ID: ${businessUrlId}`);
        return { success: true, message: 'No new reviews found from Apify.', reviews: [] };
      }
  
      console.log(`Found ${items.length} Google reviews from Apify for business ID: ${businessUrlId}. Parsing...`);
      const parsedApifyReviews: IReviewItem[] = items.map(item => parseGoogleReviewFromApify(item as ApifyGoogleReviewItem));
      const businessIdString = businessUrlDoc._id.toString();
  
      await upsertReviews({
          businessUrlId: businessIdString,
          url: businessUrlDoc.url,
          urlHash: businessUrlDoc.urlHash, 
          source: 'google',
          reviews: parsedApifyReviews
      });
      await updateBusinessUrlScrapedTime(businessIdString, 'google');
      console.log(`Successfully scraped and upserted ${parsedApifyReviews.length} Google reviews for business ID: ${businessUrlId}`);
      return { success: true, message: `Scraped ${parsedApifyReviews.length} Google reviews.`, reviews: parsedApifyReviews };
  
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Google review scraping failed due to an unknown error.';
      console.error(`Error scraping Google reviews for business ID ${businessUrlId}:`, message, error);
      return { success: false, message };
    }
};
  
export const scrapeFacebookReviews = async (businessUrlId: string, maxReviewsParam?: number): Promise<ScrapeResult> => {
    if (!FACEBOOK_APIFY_TOKEN) {
      return { success: false, message: "Facebook Apify token not configured." };
    }
    try {
      const businessUrlDoc = await getBusinessUrlById(businessUrlId);
      if (!businessUrlDoc) throw new Error('Business URL not found.');
      if (businessUrlDoc.source !== 'facebook') throw new Error('Business URL source is not Facebook.');
      if (!businessUrlDoc.url) throw new Error('Business URL is missing.');
  
      const input = { startUrls: [{ url: businessUrlDoc.url }], resultsLimit: maxReviewsParam || 100 };
      console.log(`Starting Apify actor: ${FACEBOOK_REVIEWS_ACTOR_NAME} for business ID: ${businessUrlId}`);
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
      const businessIdString = businessUrlDoc._id.toString();
      await upsertReviews({
          businessUrlId: businessIdString,
          url: businessUrlDoc.url,
          urlHash: businessUrlDoc.urlHash,
          source: 'facebook',
          reviews: parsedApifyReviews
      });
      await updateBusinessUrlScrapedTime(businessIdString, 'facebook');
      console.log(`Successfully scraped and upserted ${parsedApifyReviews.length} Facebook reviews for business ID: ${businessUrlId}`);
      return { success: true, message: `Scraped ${parsedApifyReviews.length} Facebook reviews.`, reviews: parsedApifyReviews };
  
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Facebook review scraping failed due to an unknown error.';
      console.error(`Error scraping Facebook reviews for business ID ${businessUrlId}:`, message, error);
      return { success: false, message };
    }
};