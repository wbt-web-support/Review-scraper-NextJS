# Scheduled Review Fetching

This document explains how to set up and use the scheduled review fetching feature that automatically fetches new reviews for all business URLs on a regular basis.

## Overview

The scheduled review fetching system consists of:

1. **API Endpoint**: `/api/scheduled/fetch-reviews` - Handles the review fetching logic
2. **Storage Function**: `mergeNewReviews()` - Only adds new reviews, doesn't replace existing ones
3. **Script**: `scripts/scheduled-review-fetch.js` - Can be run by cron jobs
4. **NPM Script**: `npm run fetch-reviews` - Easy way to run the script

## How It Works

### 1. New Review Detection
- The system uses `reviewId` to identify unique reviews
- When new reviews are fetched, only reviews with new `reviewId`s are added
- Existing reviews are never replaced or duplicated

### 2. Scheduled Execution
- The system processes all business URLs in the database
- For each URL, it fetches reviews from Google or Facebook using Apify
- Only new reviews are merged with existing ones
- Detailed logs are provided for monitoring

### 3. Error Handling
- Retry logic with exponential backoff
- Detailed error reporting for failed fetches
- Graceful handling of API timeouts and network issues

## Setup Instructions

### 1. Environment Variables
Make sure these environment variables are set:
```bash
MONGODB_URI=your_mongodb_connection_string
GOOGLE_APIFY_API_TOKEN=your_google_apify_token
FACEBOOK_APIFY_API_TOKEN=your_facebook_apify_token
API_BASE_URL=https://your-domain.com  # Optional, defaults to reviews.webuildtrades.com
```

### 2. Manual Execution
You can run the scheduled review fetch manually:

```bash
# Using npm script
npm run fetch-reviews

# Using node directly
node scripts/scheduled-review-fetch.js
```

### 3. Cron Job Setup
To run automatically on a schedule, set up a cron job:

#### Weekly (Recommended)
```bash
# Run every Sunday at 2 AM
0 2 * * 0 /usr/bin/node /path/to/your/project/scripts/scheduled-review-fetch.js
```

#### Daily
```bash
# Run every day at 2 AM
0 2 * * * /usr/bin/node /path/to/your/project/scripts/scheduled-review-fetch.js
```

#### Twice Weekly
```bash
# Run on Sundays and Wednesdays at 2 AM
0 2 * * 0,3 /usr/bin/node /path/to/your/project/scripts/scheduled-review-fetch.js
```

### 4. Docker/Container Setup
If running in a container, you can use a cron daemon:

```dockerfile
# Install cron
RUN apt-get update && apt-get install -y cron

# Add cron job
RUN echo "0 2 * * 0 /usr/bin/node /app/scripts/scheduled-review-fetch.js" > /etc/cron.d/review-fetch
RUN chmod 0644 /etc/cron.d/review-fetch
RUN crontab /etc/cron.d/review-fetch

# Start cron daemon
CMD ["cron", "-f"]
```

### 5. Cloud Platform Setup

#### Vercel Cron Jobs
Add to your `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/scheduled/fetch-reviews",
      "schedule": "0 2 * * 0"
    }
  ]
}
```

#### AWS Lambda with EventBridge
Create a Lambda function that calls your API endpoint on a schedule.

#### Google Cloud Functions with Cloud Scheduler
Set up a Cloud Function that triggers your API endpoint.

## Monitoring and Logs

### API Response Format
The API returns detailed information about the fetch operation:

```json
{
  "success": true,
  "message": "Scheduled review fetch completed. Processed 5 business URLs. Found 12 new reviews.",
  "results": {
    "totalBusinessUrls": 5,
    "successfulFetches": 4,
    "failedFetches": 1,
    "newReviewsFound": 12,
    "details": [
      {
        "businessUrlId": "507f1f77bcf86cd799439011",
        "businessName": "Example Business",
        "source": "google",
        "success": true,
        "newReviewsCount": 3
      }
    ]
  }
}
```

### Log Monitoring
The script provides detailed console output:
- Start/end timestamps
- Progress for each business URL
- Success/failure counts
- Error details for failed fetches

### Error Handling
- Network timeouts (5-minute timeout)
- API errors (retries with exponential backoff)
- Database connection issues
- Invalid business URLs

## Configuration Options

### Timeout Settings
Modify `CONFIG.TIMEOUT` in `scripts/scheduled-review-fetch.js`:
```javascript
TIMEOUT: 300000, // 5 minutes
```

### Retry Settings
Modify retry behavior in `scripts/scheduled-review-fetch.js`:
```javascript
RETRY_ATTEMPTS: 3,
RETRY_DELAY: 30000, // 30 seconds
```

### Review Limits
Modify the review limit in `pages/api/scheduled/fetch-reviews.ts`:
```typescript
scrapeResult = await apify.scrapeGoogleReviews(businessUrl._id, 1000); // Limit to 1000 reviews per fetch
```

## Troubleshooting

### Common Issues

1. **Script fails to connect to API**
   - Check `API_BASE_URL` environment variable
   - Verify the API endpoint is accessible
   - Check network connectivity

2. **No new reviews found**
   - This is normal if no new reviews exist
   - Check if the business URLs are still valid
   - Verify Apify tokens are working

3. **Database connection errors**
   - Verify `MONGODB_URI` is correct
   - Check database connectivity
   - Ensure database user has proper permissions

4. **Apify API errors**
   - Verify API tokens are valid
   - Check Apify account limits
   - Ensure the actors are still available

### Debug Mode
To run with more verbose logging, you can modify the script to include debug information or run the API endpoint directly with detailed logging.

## Performance Considerations

- The script processes business URLs sequentially to avoid overwhelming the Apify API
- Each business URL is limited to 1000 reviews per fetch to manage API costs
- The system uses upsert operations to avoid duplicate reviews
- Database operations are optimized to minimize connection overhead

## Security Considerations

- The API endpoint doesn't require authentication (intended for cron jobs)
- Consider adding IP whitelisting for the API endpoint
- Ensure environment variables are properly secured
- Monitor API usage to prevent abuse

## Cost Management

- Apify charges per API call, so monitor usage
- Consider adjusting the frequency based on your needs
- The 1000 review limit helps control costs
- Failed fetches don't count towards successful API calls 