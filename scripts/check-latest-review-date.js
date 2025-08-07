#!/usr/bin/env node

/**
 * Check Latest Review Date for Business URL
 * 
 * This script checks the latest review date for a specific business URL
 * to help understand the date filtering functionality.
 * 
 * Usage:
 * node scripts/check-latest-review-date.js <businessUrlId>
 * 
 * Example:
 * node scripts/check-latest-review-date.js 507f1f77bcf86cd799439011
 */

const https = require('https');
const http = require('http');

// Configuration
const CONFIG = {
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000',
  API_ENDPOINT: '/api/business-urls',
  TIMEOUT: 30000, // 30 seconds timeout
};

/**
 * Make HTTP request to get business URL details
 */
function getBusinessUrlDetails(businessUrlId) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${CONFIG.API_ENDPOINT}/${businessUrlId}`, CONFIG.API_BASE_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'User-Agent': 'CheckLatestReviewDate/1.0',
      },
      timeout: CONFIG.TIMEOUT,
    };

    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            data: response,
          });
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Get reviews for a business URL to check latest review date
 */
function getBusinessReviews(businessUrlId) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${CONFIG.API_ENDPOINT}/${businessUrlId}/reviews`, CONFIG.API_BASE_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'User-Agent': 'CheckLatestReviewDate/1.0',
      },
      timeout: CONFIG.TIMEOUT,
    };

    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            data: response,
          });
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Find the latest review date from reviews
 */
function findLatestReviewDate(reviews) {
  if (!reviews || reviews.length === 0) {
    return null;
  }

  let latestDate = null;
  
  for (const review of reviews) {
    let reviewDate = null;
    
    // Try to parse the postedAt date
    if (review.postedAt) {
      const parsedDate = new Date(review.postedAt);
      if (!isNaN(parsedDate.getTime())) {
        reviewDate = parsedDate;
      }
    }
    
    // If postedAt is not available or invalid, try scrapedAt
    if (!reviewDate && review.scrapedAt) {
      reviewDate = new Date(review.scrapedAt);
    }
    
    // Update latest date if this review is more recent
    if (reviewDate && (!latestDate || reviewDate > latestDate)) {
      latestDate = reviewDate;
    }
  }
  
  return latestDate;
}

/**
 * Main execution function
 */
async function checkLatestReviewDate(businessUrlId) {
  if (!businessUrlId) {
    console.error('Error: Business URL ID is required.');
    console.log('Usage: node scripts/check-latest-review-date.js <businessUrlId>');
    console.log('Example: node scripts/check-latest-review-date.js 507f1f77bcf86cd799439011');
    process.exit(1);
  }

  console.log(`[${new Date().toISOString()}] Checking latest review date for business URL ID: ${businessUrlId}`);
  console.log(`API URL: ${CONFIG.API_BASE_URL}${CONFIG.API_ENDPOINT}/${businessUrlId}`);
  
  try {
    // Get business URL details
    const businessResponse = await getBusinessUrlDetails(businessUrlId);
    
    if (businessResponse.statusCode !== 200) {
      throw new Error(`Failed to get business URL details: ${businessResponse.data?.message || 'Unknown error'}`);
    }
    
    const businessUrl = businessResponse.data;
    console.log(`\n📋 Business URL Details:`);
    console.log(`- Name: ${businessUrl.name}`);
    console.log(`- URL: ${businessUrl.url}`);
    console.log(`- Source: ${businessUrl.source}`);
    console.log(`- URL Hash: ${businessUrl.urlHash}`);
    
    // Get reviews for this business URL
    const reviewsResponse = await getBusinessReviews(businessUrlId);
    
    if (reviewsResponse.statusCode !== 200) {
      throw new Error(`Failed to get reviews: ${reviewsResponse.data?.message || 'Unknown error'}`);
    }
    
    const reviews = reviewsResponse.data.reviews || [];
    console.log(`\n📊 Reviews Information:`);
    console.log(`- Total reviews: ${reviews.length}`);
    
    if (reviews.length === 0) {
      console.log(`- Latest review date: No reviews found`);
      console.log(`- Next fetch will: Get all reviews (no date filtering)`);
    } else {
      const latestDate = findLatestReviewDate(reviews);
      
      if (latestDate) {
        console.log(`- Latest review date: ${latestDate.toISOString()}`);
        console.log(`- Latest review date (local): ${latestDate.toLocaleString()}`);
        console.log(`- Next fetch will: Only get reviews newer than ${latestDate.toISOString()}`);
        
        // Show some recent reviews
        console.log(`\n📝 Recent Reviews (last 5):`);
        const recentReviews = reviews
          .sort((a, b) => {
            const dateA = new Date(a.postedAt || a.scrapedAt || 0);
            const dateB = new Date(b.postedAt || b.scrapedAt || 0);
            return dateB.getTime() - dateA.getTime();
          })
          .slice(0, 5);
        
        recentReviews.forEach((review, index) => {
          const reviewDate = new Date(review.postedAt || review.scrapedAt || '');
          console.log(`  ${index + 1}. ${review.author} - ${reviewDate.toLocaleDateString()} - ${review.content.substring(0, 50)}...`);
        });
      } else {
        console.log(`- Latest review date: Could not determine (no valid dates found)`);
        console.log(`- Next fetch will: Get all reviews (no date filtering)`);
      }
    }
    
    console.log(`\n💡 Date Filtering Benefits:`);
    console.log(`- Saves Apify credits by avoiding duplicate review fetching`);
    console.log(`- Only fetches reviews newer than the latest review in our database`);
    console.log(`- If no reviews exist, fetches all reviews for initial setup`);
    
    process.exit(0);
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Check failed:`, error.message);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log(`[${new Date().toISOString()}] Received SIGINT, shutting down gracefully...`);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(`[${new Date().toISOString()}] Received SIGTERM, shutting down gracefully...`);
  process.exit(0);
});

// Check if running directly
if (require.main === module) {
  const businessUrlId = process.argv[2];
  checkLatestReviewDate(businessUrlId).catch((error) => {
    console.error(`[${new Date().toISOString()}] Unhandled error:`, error.message);
    process.exit(1);
  });
}

module.exports = { checkLatestReviewDate, getBusinessUrlDetails, getBusinessReviews, findLatestReviewDate }; 