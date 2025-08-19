# Performance Optimizations for Fetch Reviews

## Overview
The `getLatestReviews` function was experiencing significant performance issues due to multiple database queries and inefficient data processing. This document outlines the optimizations implemented to improve response times.

## Performance Issues Identified

### 1. N+1 Query Problem
- **Issue**: For each business URL, a separate database query was made to fetch review batches
- **Impact**: Linear scaling with number of business URLs (O(n) queries)
- **Solution**: Replaced with MongoDB aggregation pipeline

### 2. Sequential Database Queries
- **Issue**: Google and Facebook business URLs were fetched sequentially
- **Impact**: Increased total response time
- **Solution**: Parallel execution using `Promise.all()`

### 3. In-Memory Sorting
- **Issue**: All reviews were loaded into memory and sorted there
- **Impact**: High memory usage and slower processing
- **Solution**: Database-level sorting with `$sort` aggregation

### 4. No Caching
- **Issue**: Repeated identical queries hit the database every time
- **Impact**: Unnecessary database load and slower responses
- **Solution**: In-memory cache with TTL

## Optimizations Implemented

### 1. MongoDB Aggregation Pipeline
```javascript
// Before: Multiple separate queries
const userGoogleBusinessUrls = await GoogleBusinessUrlModel.find({ userId });
for (const bizUrl of userGoogleBusinessUrls) {
  const reviewBatch = await ReviewModel.findOne({ businessUrlId: bizUrl._id });
}

// After: Single aggregation pipeline
const googleReviews = await GoogleReviewBatchModel.aggregate([
  { $lookup: { from: 'business_urls', localField: 'businessUrlId', foreignField: '_id', as: 'businessUrl' } },
  { $unwind: '$businessUrl' },
  { $match: { 'businessUrl.userId': userIdObj } },
  { $unwind: '$reviews' },
  { $addFields: { 'reviews.businessName': '$businessUrl.name', 'reviews.source': 'google' } },
  { $replaceRoot: { newRoot: '$reviews' } },
  { $sort: { scrapedAt: -1 } },
  { $limit: limit }
]);
```

### 2. Parallel Query Execution
```javascript
// Execute both Google and Facebook queries in parallel
const [googleReviews, facebookReviews] = await Promise.all([
  GoogleReviewBatchModel.aggregate([...]),
  FacebookReviewBatchModel.aggregate([...])
]);
```

### 3. In-Memory Caching
```javascript
// Cache with 5-minute TTL
const latestReviewsCache = new Map<string, { data: any[], timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Check cache before database query
const cacheKey = `${userId}:${limit}`;
const cached = latestReviewsCache.get(cacheKey);
if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
  return { data: cached.data, cacheHit: true };
}
```

### 4. Database-Level Sorting and Limiting
```javascript
// Sort and limit at database level instead of in memory
{ $sort: { scrapedAt: -1 } },
{ $limit: limit }
```

### 5. Optimized Date Handling
```javascript
// Better date parsing with error handling
'reviews.scrapedAt': { 
  $ifNull: [
    '$reviews.scrapedAt', 
    { $dateFromString: { dateString: '$reviews.postedAt', onError: new Date(0) } }
  ] 
}
```

## Performance Monitoring

### 1. Cache Statistics API
- **Endpoint**: `/api/debug/cache-stats`
- **Methods**: GET (stats), POST (clear cache)
- **Metrics**: Total entries, valid entries, expired entries, cache size

### 2. Performance Monitor Component
- **File**: `components/PerformanceMonitor.tsx`
- **Features**: 
  - Real-time cache statistics
  - Response time tracking
  - Cache hit rate calculation
  - Visual performance indicators

### 3. Cache Hit Headers
- **Header**: `x-cache-hit`
- **Values**: `true` (cached), `false` (fresh)
- **Usage**: Monitor cache effectiveness

## Expected Performance Improvements

### Response Time Reduction
- **Before**: 2-5 seconds (depending on number of business URLs)
- **After**: 100-500ms (cached), 500-1000ms (fresh)
- **Improvement**: 80-90% reduction in response time

### Database Load Reduction
- **Before**: O(n) queries where n = number of business URLs
- **After**: 2 fixed queries (Google + Facebook)
- **Improvement**: Eliminates N+1 query problem

### Memory Usage Optimization
- **Before**: All reviews loaded into memory for sorting
- **After**: Only requested number of reviews loaded
- **Improvement**: Reduced memory footprint

## Cache Management

### Cache Invalidation
```javascript
// Clear cache for specific user
export const clearLatestReviewsCache = (userId?: string) => {
  if (userId) {
    const keysToDelete = Array.from(latestReviewsCache.keys())
      .filter(key => key.startsWith(`${userId}:`));
    keysToDelete.forEach(key => latestReviewsCache.delete(key));
  } else {
    latestReviewsCache.clear();
  }
};
```

### Cache Statistics
```javascript
export const getLatestReviewsCacheStats = () => {
  const now = Date.now();
  const totalEntries = latestReviewsCache.size;
  const expiredEntries = Array.from(latestReviewsCache.entries())
    .filter(([_, value]) => (now - value.timestamp) >= CACHE_TTL).length;
  
  return {
    totalEntries,
    expiredEntries,
    validEntries: totalEntries - expiredEntries,
    cacheSize: latestReviewsCache.size
  };
};
```

## Database Indexes

The following indexes are already in place and support the optimizations:

### GoogleBusinessUrl Model
- `userId` (sparse index)
- `urlHash` (index)

### FacebookBusinessUrl Model  
- `userId` (sparse index)
- `urlHash` (index)

### Review Models
- `businessUrlId` (sparse index)
- `urlHash` (index)

## Usage Examples

### Basic Usage
```javascript
// Fetch latest 10 reviews
const result = await getLatestReviews(userId, 10);
console.log(`Cache hit: ${result.cacheHit}`);
console.log(`Reviews: ${result.data.length}`);
```

### Performance Monitoring
```javascript
// Get cache statistics
const stats = getLatestReviewsCacheStats();
console.log(`Cache hit rate: ${stats.validEntries / stats.totalEntries * 100}%`);

// Clear cache for user
clearLatestReviewsCache(userId);
```

### API Response Headers
```javascript
// Check if response was cached
const response = await fetch('/api/dashboard/latest-reviews');
const cacheHit = response.headers.get('x-cache-hit') === 'true';
console.log(`Response was ${cacheHit ? 'cached' : 'fresh'}`);
```

## Future Optimizations

### 1. Redis Caching
- Replace in-memory cache with Redis for multi-instance deployments
- Persistent cache across server restarts
- Distributed cache for load balancing

### 2. Database Query Optimization
- Add compound indexes for frequently used query patterns
- Implement database connection pooling
- Consider read replicas for heavy read workloads

### 3. Pagination Optimization
- Implement cursor-based pagination for large datasets
- Add pagination metadata to responses

### 4. Background Refresh
- Implement cache warming strategies
- Background refresh of expiring cache entries
- Predictive caching based on user patterns
