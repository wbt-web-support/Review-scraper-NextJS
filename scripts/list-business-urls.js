#!/usr/bin/env node

/**
 * List Business URLs Script
 * 
 * This script lists all business URLs in the database so you can find an ID to test with.
 * 
 * Usage:
 * node scripts/list-business-urls.js
 */

const https = require('https');
const http = require('http');

// Configuration
const CONFIG = {
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000',
  API_ENDPOINT: '/api/business-urls/all',
  TIMEOUT: 30000, // 30 seconds timeout
};

/**
 * Make HTTP request to get all business URLs
 */
function makeRequest() {
  return new Promise((resolve, reject) => {
    const url = new URL(CONFIG.API_ENDPOINT, CONFIG.API_BASE_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'User-Agent': 'ListBusinessUrls/1.0',
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
 * Main execution function
 */
async function listBusinessUrls() {
  console.log(`[${new Date().toISOString()}] Listing all business URLs...`);
  console.log(`API URL: ${CONFIG.API_BASE_URL}${CONFIG.API_ENDPOINT}`);
  
  try {
    const response = await makeRequest();
    
    if (response.statusCode === 200) {
      console.log(`[${new Date().toISOString()}] Success!`);
      
      if (response.data.businessUrls && response.data.businessUrls.length > 0) {
        console.log(`\nFound ${response.data.businessUrls.length} business URLs:\n`);
        
        response.data.businessUrls.forEach((businessUrl, index) => {
          console.log(`${index + 1}. ID: ${businessUrl._id}`);
          console.log(`   Name: ${businessUrl.name}`);
          console.log(`   URL: ${businessUrl.url}`);
          console.log(`   Source: ${businessUrl.source}`);
          console.log(`   URL Hash: ${businessUrl.urlHash}`);
          console.log(`   User ID: ${businessUrl.userId}`);
          console.log('');
        });
        
        console.log('\nTo test with a specific business URL, use:');
        console.log('npm run test-single-business <businessUrlId>');
        console.log('Example: npm run test-single-business 507f1f77bcf86cd799439011');
        
      } else {
        console.log('No business URLs found in the database.');
      }
      
      process.exit(0);
    } else {
      throw new Error(`HTTP ${response.statusCode}: ${response.data?.message || 'Unknown error'}`);
    }
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Failed to list business URLs:`, error.message);
    console.log('\nMake sure your Next.js server is running (npm run dev)');
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
  listBusinessUrls().catch((error) => {
    console.error(`[${new Date().toISOString()}] Unhandled error:`, error.message);
    process.exit(1);
  });
}

module.exports = { listBusinessUrls, makeRequest }; 