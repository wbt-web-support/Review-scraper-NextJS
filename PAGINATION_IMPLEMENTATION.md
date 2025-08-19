# Pagination Implementation for Widgets Page

## Overview

The widgets page has been updated to use pagination and batching techniques to improve performance when dealing with large numbers of widgets. This implementation replaces the previous approach of loading all widgets at once.

## Key Features

### 1. Server-Side Pagination
- **API Endpoint**: `/api/widgets/paginated`
- **Query Parameters**:
  - `page`: Current page number (default: 1)
  - `limit`: Items per page (default: 12, max: 50)
  - `source`: Filter by source ('google', 'facebook', 'all')
  - `search`: Search by widget name
  - `sortBy`: Sort field (default: 'createdAt')
  - `sortOrder`: Sort direction ('asc' or 'desc')

### 2. Custom Hook: `usePaginatedWidgets`
- Manages pagination state
- Handles filtering and sorting
- Provides automatic query invalidation
- Supports real-time search and filter updates

### 3. Enhanced UI Components
- **Pagination Component**: Modern, responsive pagination with page size selector
- **Widget Skeleton**: Loading states that match the actual widget design
- **Mobile-First Design**: Responsive layout that works on all devices

## Performance Benefits

### Before (Old Implementation)
- Loaded ALL widgets at once
- Client-side filtering and searching
- Slow initial page load with many widgets
- High memory usage in browser
- Poor user experience with large datasets

### After (New Implementation)
- Loads only 12 widgets per page by default
- Server-side filtering and searching
- Fast initial page load regardless of total widget count
- Efficient memory usage
- Smooth user experience with pagination controls

## Technical Implementation

### Backend Changes

1. **New API Endpoint**: `pages/api/widgets/paginated.ts`
   - Handles pagination logic
   - Supports filtering and sorting
   - Returns pagination metadata

2. **Storage Function**: `getPaginatedWidgetsByUserId()`
   - Efficient database queries with skip/limit
   - Server-side filtering
   - Optimized data population

### Frontend Changes

1. **Custom Hook**: `hooks/use-paginated-widgets.ts`
   - Manages pagination state
   - Handles API calls with query parameters
   - Provides reactive updates

2. **UI Components**:
   - `components/ui/pagination.tsx`: Reusable pagination component
   - `components/ui/widget-skeleton.tsx`: Loading skeleton
   - Updated `pages/widgets.tsx`: Uses new pagination system

## Usage Examples

### Basic Pagination
```typescript
const {
  widgets,
  pagination,
  isLoading,
  currentPage,
  setCurrentPage,
} = usePaginatedWidgets({
  limit: 12,
  source: 'all',
});
```

### With Search and Filtering
```typescript
const {
  widgets,
  pagination,
  setSearch,
  setSource,
} = usePaginatedWidgets({
  limit: 24,
  source: 'google',
  search: 'my widget',
});
```

### Pagination Component
```tsx
<Pagination
  currentPage={pagination.page}
  totalPages={pagination.totalPages}
  onPageChange={setCurrentPage}
  showPageSize={true}
  pageSize={limit}
  onPageSizeChange={setLimit}
/>
```

## Configuration Options

### Page Size Options
- Default: 12 items per page
- Available options: 6, 12, 24, 48
- Maximum: 50 items per page (API limit)

### Sorting Options
- `createdAt`: Sort by creation date
- `name`: Sort by widget name
- `type`: Sort by widget type
- Direction: `asc` or `desc`

### Filtering Options
- `source`: Filter by Google/Facebook
- `search`: Search by widget name (case-insensitive)

## Benefits for Users

1. **Faster Loading**: Only loads visible widgets
2. **Better Performance**: Reduced memory usage
3. **Improved UX**: Smooth pagination controls
4. **Search & Filter**: Real-time filtering without full page reloads
5. **Mobile Friendly**: Responsive design works on all devices
6. **Scalable**: Handles large numbers of widgets efficiently

## Migration Notes

- The old `/api/widgets` endpoint is still available for backward compatibility
- Existing widget creation/editing functionality remains unchanged
- All existing features (create, edit, delete, embed) work with pagination
- Search and filtering now happen on the server side for better performance

## Future Enhancements

1. **Infinite Scroll**: Alternative to pagination for better UX
2. **Advanced Filters**: Date range, status, type filters
3. **Bulk Operations**: Select multiple widgets for bulk actions
4. **Export Functionality**: Export filtered/paginated results
5. **Caching**: Implement Redis caching for frequently accessed data
