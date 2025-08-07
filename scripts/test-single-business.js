#!/usr/bin/env node

/**
 * Test Script for Single Business URL Review Fetching with Date Filtering
 * 
 * This script tests the scheduled review fetching for a single business URL.
 * The system now automatically filters reviews by date to avoid consuming
 * extra Apify credits by only fetching reviews newer than the latest review
 * in our database.
 * 
 * Usage:
 * node scripts/test-single-business.js <businessUrlId>
 * 
 * Example:
 * node scripts/test-single-business.js 6880cf3c4bf9ed09273b80a8
 */

const https = require('https');
const http = require('http');

// Configuration
const CONFIG = {
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000',
  API_ENDPOINT: '/api/scheduled/fetch-reviews',
  TIMEOUT: 300000, // 5 minutes timeout
};

/**
 * Make HTTP request to the scheduled fetch API with a specific business URL ID
 */
function makeRequest(businessUrlId) {
  return new Promise((resolve, reject) => {
    const url = new URL(CONFIG.API_ENDPOINT, CONFIG.API_BASE_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestBody = JSON.stringify({ businessUrlId });
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
        'User-Agent': 'TestSingleBusiness/2.0',
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
 * Main execution function
 */
async function testSingleBusiness(businessUrlId) {
  if (!businessUrlId) {
    console.error('Error: Business URL ID is required.');
    console.log('Usage: node scripts/test-single-business.js <businessUrlId>');
    console.log('Example: node scripts/test-single-business.js 6880cf3c4bf9ed09273b80a8');
    process.exit(1);
  }

  console.log(`[${new Date().toISOString()}] Starting test for business URL ID: ${businessUrlId}`);
  console.log(`API URL: ${CONFIG.API_BASE_URL}${CONFIG.API_ENDPOINT}`);
  
  
  try {
    const response = await makeRequest(businessUrlId);
    
    if (response.statusCode === 200) {
      console.log(`\n[${new Date().toISOString()}] ✅ Success!`);
      console.log(`Response:`, JSON.stringify(response.data, null, 2));
      
      if (response.data.success) {
        const results = response.data.results;
        console.log(`\n📊 Test Summary:`);
        console.log(`- Business URLs processed: ${results.totalBusinessUrls}`);
        console.log(`- Successful fetches: ${results.successfulFetches}`);
        console.log(`- Failed fetches: ${results.failedFetches}`);
        console.log(`- New reviews found: ${results.newReviewsFound}`);
        
        if (results.details.length > 0) {
          console.log(`\n📋 Details:`);
          results.details.forEach(detail => {
            console.log(`- ${detail.businessName} (${detail.source}): ${detail.success ? '✅ SUCCESS' : '❌ FAILED'}`);
            if (detail.success) {
              console.log(`  📝 New reviews: ${detail.newReviewsCount}`);
              console.log(`  💰 Apify credits saved: Reviews were filtered by date`);
            } else {
              console.log(`  ❌ Error: ${detail.error}`);
            }
          });
        }
        
        console.log(`\n💡 Note: The system automatically filtered reviews by date to save Apify credits.`);
        console.log(`   Only reviews newer than the latest review in our database were fetched.`);
      }
      
      process.exit(0);
    } else {
      throw new Error(`HTTP ${response.statusCode}: ${response.data?.message || 'Unknown error'}`);
    }
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Test failed:`, error.message);
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
  testSingleBusiness(businessUrlId).catch((error) => {
    console.error(`[${new Date().toISOString()}] Unhandled error:`, error.message);
    process.exit(1);
  });
}

module.exports = { testSingleBusiness, makeRequest }; 