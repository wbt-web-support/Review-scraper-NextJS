#!/usr/bin/env node

/**
 * Scheduled Review Fetch Script with Single Business Testing
 * 
 * This script can be run by a cron job to fetch new reviews for all business URLs,
 * or used to test a single business URL with date filtering.
 * 
 * Usage:
 * - All businesses: node scripts/scheduled-review-fetch.js
 * - Only Google: node scripts/scheduled-review-fetch.js --google
 * - Only Facebook: node scripts/scheduled-review-fetch.js --facebook
 * - Single business: node scripts/scheduled-review-fetch.js <businessUrlId>
 * - Single business, only if Google: node scripts/scheduled-review-fetch.js <businessUrlId> --google
 * - Cron: 0 2 * * 0 /usr/bin/node /path/to/scripts/scheduled-review-fetch.js
 * 
 * Examples:
 * - Test single business: node scripts/scheduled-review-fetch.js 68666d7f339511ff75766d79
 * - Run for all businesses: node scripts/scheduled-review-fetch.js
 * 
 * Environment variables needed:
 * - MONGODB_URI_TEST
 * - GOOGLE_APIFY_API_TOKEN
 * - FACEBOOK_APIFY_API_TOKEN
 */

const https = require('https');
const http = require('http');

// Configuration
const CONFIG = {
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000',
  API_ENDPOINT: '/api/scheduled/fetch-reviews',
  TIMEOUT: 300000, // 5 minutes timeout
  RETRY_ATTEMPTS: 1,
  RETRY_DELAY: 30000, // 30 seconds
};

/**
 * Make HTTP request to the scheduled fetch API
 */
function makeRequest(businessUrlId = null, source = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(CONFIG.API_ENDPOINT, CONFIG.API_BASE_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    // Prepare request body based on whether we're testing a single business or all businesses
    const requestBody = businessUrlId 
      ? JSON.stringify({ businessUrlId, source })
      : source
        ? JSON.stringify({ source })
        : '{}';
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
        'User-Agent': businessUrlId ? 'ScheduledReviewFetch/SingleTest/1.0' : 'ScheduledReviewFetch/1.0',
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

    // Send request body
    req.write(requestBody);
    req.end();
  });
}

/**
 * Main execution function with retry logic
 */
async function logAllBusinessUrls() {
  const https = require('https');
  const http = require('http');
  const url = new URL('/api/business-urls/all', CONFIG.API_BASE_URL);
  const isHttps = url.protocol === 'https:';
  const client = isHttps ? https : http;
  const options = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname + url.search,
    method: 'GET',
    headers: {
      'User-Agent': 'ScheduledReviewFetch/1.0',
    },
    timeout: 30000,
  };
  return new Promise((resolve, reject) => {
    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.businessUrls && response.businessUrls.length > 0) {
            process.stdout.write(`\nAll business URLs in the system (${response.businessUrls.length}):\n`);
            response.businessUrls.forEach((businessUrl, index) => {
              process.stdout.write(
                `${index + 1}. ID: ${businessUrl._id}\n   Name: ${businessUrl.name}\n   URL: ${businessUrl.url}\n   Source: ${businessUrl.source}\n   URL Hash: ${businessUrl.urlHash}\n   User ID: ${businessUrl.userId}\n`);
            });
          
          } else {
            process.stdout.write('No business URLs found.\n');
          }
          resolve();
        } catch (error) {
          process.stdout.write(`Failed to parse business URLs: ${error.message}\n`);
          resolve();
        }
      });
    });
    req.on('error', (error) => {
      process.stdout.write(`Failed to fetch business URLs: ${error.message}\n`);
      resolve();
    });
    req.on('timeout', () => {
      req.destroy();
      process.stdout.write('Timeout fetching business URLs.\n');
      resolve();
    });
    req.end();
  });
}

async function executeWithRetry(businessUrlId = null, source = null) {
  const isSingleBusinessTest = !!businessUrlId;
  
  if (isSingleBusinessTest) {
    process.stdout.write(`[${new Date().toISOString()}] Starting single business test for ID: ${businessUrlId}\n`);
    process.stdout.write(`📅 Date Filtering Information:\n`);
    process.stdout.write(`- The system will automatically check the latest review date in our database\n`);
    process.stdout.write(`- Only reviews newer than that date will be fetched from Apify\n`);
    process.stdout.write(`- This saves Apify credits by avoiding duplicate review fetching\n`);
    process.stdout.write(`- If no reviews exist in our database, all reviews will be fetched\n`);
  } else {
    process.stdout.write(`[${new Date().toISOString()}] Starting scheduled review fetch for all businesses` + (source ? ` (source: ${source})` : '') + '...\n');
    process.stdout.write(`📅 Date Filtering Information:\n`);
    process.stdout.write(`- The system will automatically check the latest review date for each business\n`);
    process.stdout.write(`- Only reviews newer than that date will be fetched from Apify\n`);
    process.stdout.write(`- This saves Apify credits by avoiding duplicate review fetching\n`);
    process.stdout.write(`- If no reviews exist for a business, all reviews will be fetched\n`);
  }
  
  process.stdout.write(`API URL: ${CONFIG.API_BASE_URL}${CONFIG.API_ENDPOINT}\n`);
  
  if (!isSingleBusinessTest) {
    await logAllBusinessUrls();
  }

  for (let attempt = 1; attempt <= CONFIG.RETRY_ATTEMPTS; attempt++) {
    try {
      process.stdout.write(`[${new Date().toISOString()}] Attempt ${attempt}/${CONFIG.RETRY_ATTEMPTS}\n`);
      
      const response = await makeRequest(businessUrlId, source);
      
              if (response.statusCode === 200) {
          process.stdout.write(`[${new Date().toISOString()}] ✅ Success!\n`);
          process.stdout.write(`Response:`, JSON.stringify(response.data, null, 2));
          
          if (response.data.success) {
            const results = response.data.results;
            
            if (isSingleBusinessTest) {
              process.stdout.write(`\n📊 Test Summary:\n`);
              process.stdout.write(`- Business URLs processed: ${results.totalBusinessUrls}\n`);
              process.stdout.write(`- Successful fetches: ${results.successfulFetches}\n`);
              process.stdout.write(`- Failed fetches: ${results.failedFetches}\n`);
              process.stdout.write(`- New reviews found: ${results.newReviewsFound}\n`);
              
              if (results.details.length > 0) {
                process.stdout.write(`\n📋 Details:\n`);
                results.details.forEach(detail => {
                  process.stdout.write(`- ${detail.businessName} (${detail.source}): ${detail.success ? '✅ SUCCESS' : '❌ FAILED'}\n`);
                  if (detail.success) {
                    process.stdout.write(`  📝 New reviews: ${detail.newReviewsCount}\n`);
                    process.stdout.write(`  💰 Apify credits saved: Reviews were filtered by date\n`);
                  } else {
                    process.stdout.write(`  ❌ Error: ${detail.error}\n`);
                  }
                });
              }
              
              process.stdout.write(`\n💡 Note: The system automatically filtered reviews by date to save Apify credits.\n`);
              process.stdout.write(`   Only reviews newer than the latest review in our database were fetched.\n`);
            } else {
              process.stdout.write(`\n📊 Summary:\n`);
              process.stdout.write(`- Total business URLs processed: ${results.totalBusinessUrls}\n`);
              process.stdout.write(`- Successful fetches: ${results.successfulFetches}\n`);
              process.stdout.write(`- Failed fetches: ${results.failedFetches}\n`);
              process.stdout.write(`- New reviews found: ${results.newReviewsFound}\n`);
              
              if (results.failedFetches > 0) {
                process.stdout.write(`\nFailed fetches details:\n`);
                results.details
                  .filter(detail => !detail.success)
                  .forEach(detail => {
                    process.stdout.write(`- ${detail.businessName} (${detail.source}): ${detail.error}\n`);
                  });
              }
            }
          }
          
          process.exit(0);
        } else {
          throw new Error(`HTTP ${response.statusCode}: ${response.data?.message || 'Unknown error'}`);
        }
      
    } catch (error) {
      process.stdout.write(`[${new Date().toISOString()}] Attempt ${attempt} failed: ${error.message}\n`);
      
      if (attempt < CONFIG.RETRY_ATTEMPTS) {
        process.stdout.write(`[${new Date().toISOString()}] Waiting ${CONFIG.RETRY_DELAY/1000} seconds before retry...\n`);
        await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
      } else {
        process.stdout.write(`[${new Date().toISOString()}] All attempts failed. Exiting with error code 1.\n`);
        process.exit(1);
      }
    }
  }
}

// Handle process termination
process.on('SIGINT', () => {
  process.stdout.write(`[${new Date().toISOString()}] Received SIGINT, shutting down gracefully...\n`);
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.stdout.write(`[${new Date().toISOString()}] Received SIGTERM, shutting down gracefully...\n`);
  process.exit(0);
});

// Check if running directly
if (require.main === module) {
  // Parse command-line arguments
  const args = process.argv.slice(2);
  const businessUrlId = args.find(arg => /^[a-f\d]{24}$/i.test(arg)); // 24-char hex for Mongo IDs
  const sourceFlag = args.includes('--facebook') ? 'facebook' : args.includes('--google') ? 'google' : null;

  if (businessUrlId) {
    process.stdout.write(`[${new Date().toISOString()}] Single business test mode for ID: ${businessUrlId}\n`);
    executeWithRetry(businessUrlId, sourceFlag);
  } else {
    process.stdout.write(`[${new Date().toISOString()}] All businesses mode\n`);
    process.stdout.write(`💡 Usage examples:\n`);
    process.stdout.write(`- node scripts/scheduled-review-fetch.js\n`);
    process.stdout.write(`- node scripts/scheduled-review-fetch.js --google\n`);
    process.stdout.write(`- node scripts/scheduled-review-fetch.js --facebook\n`);
    executeWithRetry(null, sourceFlag);
  }
}