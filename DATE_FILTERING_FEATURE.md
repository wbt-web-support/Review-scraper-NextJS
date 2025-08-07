# Date Filtering Feature for Apify Credit Optimization

## Overview
This feature optimizes Apify credit usage by automatically filtering reviews by date to avoid consuming extra credits. Instead of re-crawling all reviews, the system now uses Apify's built-in date filtering to only fetch reviews newer than the latest review date in our database.

## How It Works

### Before (Inefficient)
1. Fetch ALL reviews from Apify (consumes full credits)
2. Filter reviews client-side after fetching
3. Waste credits on reviews we already have

### After (Optimized)
1. Check the latest review date in our database
2. Use Apify's built-in `onlyReviewsNewerThan` parameter
3. Only fetch reviews newer than that date
4. Save significant Apify credits

## Implementation Details

### Database Integration
- **Function**: `getLatestReviewDateForBusiness(businessUrlId, source)`
- **Purpose**: Retrieves the most recent review date for a business URL
- **Returns**: `Date | null` - the latest review date or null if no reviews exist

### Apify Integration
- **Google Reviews**: Uses `onlyReviewsNewerThan` parameter in the Apify actor input
- **Facebook Reviews**: Uses `onlyReviewsNewerThan` parameter in the Apify actor input
- **Date Format**: YYYY-MM-DD (e.g., "2025-07-30")
- **Fallback**: If no date is found, fetches all reviews (first-time scraping)

### Code Changes
1. **`lib/apify.ts`**: Modified to pass date parameter to Apify actors
2. **`lib/storage.ts`**: Added `getLatestReviewDateForBusiness` function
3. **Removed**: Client-side filtering logic (no longer needed)

## Example Usage

### Scenario
- Latest review in database: 2025-07-30
- Current date: 2025-08-02
- **Result**: Only fetch reviews from 2025-07-31 to 2025-08-02

### API Call
```javascript
// The system automatically determines the date
const result = await scrapeGoogleReviews(businessUrlId);

// Or manually specify a date
const result = await scrapeGoogleReviews(businessUrlId, 1000, new Date('2025-07-30'));
```

## Benefits

### Credit Savings
- **Before**: 1000 reviews fetched (1000 credits)
- **After**: 50 new reviews fetched (50 credits)
- **Savings**: 95% reduction in credit usage

### Performance
- Faster API responses (fewer reviews to process)
- Reduced bandwidth usage
- Lower processing time

### Accuracy
- Uses Apify's native date filtering (more reliable)
- No risk of missing reviews due to client-side filtering errors
- Consistent with Apify's review ordering

## Configuration

### Environment Variables
- `GOOGLE_APIFY_API_TOKEN`: Required for Google review scraping
- `FACEBOOK_APIFY_API_TOKEN`: Required for Facebook review scraping

### Apify Actor Parameters
```javascript
// Google Reviews Actor Input
{
  startUrls: [{ url: businessUrl }],
  language: "en",
  maxReviews: 10000,
  resultsLimit: 99999,
  onlyReviewsNewerThan: "2025-07-30" // Optional date filter
}

// Facebook Reviews Actor Input
{
  startUrls: [{ url: businessUrl }],
  maxReviews: 10000,
  scrapeReviews: true,
  resultsLimit: 99999,
  onlyReviewsNewerThan: "2025-07-30" // Optional date filter
}
```

## Testing

### Test Script
```bash
# Test with a specific business URL
node scripts/test-single-business.js 507f1f77bcf86cd799439011

# Check latest review dates
node scripts/check-latest-review-date.js
```

### Expected Output
```
[2025-08-02T10:30:00.000Z] Starting test for business URL ID: 507f1f77bcf86cd799439011
API URL: http://localhost:3000/api/scheduled/fetch-reviews

📅 Date Filtering Information:
- The system will automatically check the latest review date in our database
- Only reviews newer than that date will be fetched from Apify
- This saves Apify credits by avoiding duplicate review fetching
- If no reviews exist in our database, all reviews will be fetched

[2025-08-02T10:30:05.000Z] ✅ Success!
📊 Test Summary:
- Business URLs processed: 1
- Successful fetches: 1
- Failed fetches: 0
- New reviews found: 5

📋 Details:
- Example Business (google): ✅ SUCCESS
  📝 New reviews: 5
  💰 Apify credits saved: Reviews were filtered by date

💡 Note: The system automatically filtered reviews by date to save Apify credits.
   Only reviews newer than the latest review in our database were fetched.
```

## Troubleshooting

### Common Issues

1. **No Reviews Found**
   - Check if the business URL exists in the database
   - Verify the Apify tokens are configured
   - Check if the business has any reviews on Google/Facebook

2. **Date Filtering Not Working**
   - Ensure the latest review date is properly stored in the database
   - Check the date format (should be YYYY-MM-DD)
   - Verify the Apify actor supports the `onlyReviewsNewerThan` parameter

3. **All Reviews Being Fetched**
   - This is normal for first-time scraping (no existing reviews)
   - Check if `getLatestReviewDateForBusiness` returns null
   - Verify the database connection

### Debug Commands
```bash
# Check latest review dates for all businesses
node scripts/check-latest-review-date.js

# Test with verbose logging
DEBUG=apify node scripts/test-single-business.js <businessUrlId>
```

## Migration Notes

### Breaking Changes
- None - the feature is backward compatible
- Existing code will continue to work
- New date filtering is applied automatically

### Performance Impact
- **Positive**: Reduced API calls and processing time
- **Positive**: Lower credit consumption
- **Neutral**: No impact on existing functionality

## Future Enhancements

### Potential Improvements
1. **Batch Processing**: Process multiple businesses with date filtering
2. **Smart Scheduling**: Automatically determine optimal scraping frequency
3. **Credit Monitoring**: Track and report credit savings
4. **Advanced Filtering**: Support for more complex date ranges

### Monitoring
- Log credit usage before/after implementation
- Track review count differences
- Monitor API response times
- Report savings metrics

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the console logs for detailed information
3. Test with the provided scripts
4. Verify Apify actor documentation for parameter support 