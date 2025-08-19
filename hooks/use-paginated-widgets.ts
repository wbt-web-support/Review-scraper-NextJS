import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { apiRequest } from '../lib/queryClient';
import { IWidget } from '../components/WidgetCard';

// Debounce hook for search optimization
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

interface PaginatedWidgetsResponse {
  widgets: IWidget[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface UsePaginatedWidgetsOptions {
  page?: number;
  limit?: number;
  source?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

export const usePaginatedWidgets = (options: UsePaginatedWidgetsOptions = {}) => {
  const { status: authStatus } = useSession();
  const queryClient = useQueryClient();
  
  const [currentPage, setCurrentPage] = useState(options.page || 1);
  const [limit, setLimit] = useState(options.limit || 12);
  const [source, setSource] = useState(options.source || 'all');
  const [search, setSearch] = useState(options.search || '');
  const [sortBy, setSortBy] = useState(options.sortBy || 'createdAt');
  const [sortOrder, setSortOrder] = useState(options.sortOrder || 'desc');

  // Debounce search to reduce API calls (500ms delay)
  const debouncedSearch = useDebounce(search, 500);

  // Build query parameters
  const queryParams = new URLSearchParams({
    page: currentPage.toString(),
    limit: limit.toString(),
    sortBy,
    sortOrder,
  });

  if (source && source !== 'all') {
    queryParams.append('source', source);
  }

  if (debouncedSearch.trim()) {
    queryParams.append('search', debouncedSearch.trim());
  }

  const { data, isLoading, error, refetch } = useQuery<PaginatedWidgetsResponse>({
    queryKey: ['paginatedWidgets', currentPage, limit, source, debouncedSearch, sortBy, sortOrder],
    queryFn: () => apiRequest<PaginatedWidgetsResponse>('GET', `/api/widgets/paginated?${queryParams.toString()}`),
    enabled: authStatus === 'authenticated',
    staleTime: 2 * 60 * 1000, // 2 minutes - more aggressive caching for search
    gcTime: 15 * 60 * 1000, // 15 minutes - keep cached data longer
    // Enable background refetch for better UX
    refetchOnWindowFocus: false,
  });

  // Reset to page 1 when filters change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [source, debouncedSearch, sortBy, sortOrder, limit]);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= (data?.pagination?.totalPages || 1)) {
      setCurrentPage(page);
    }
  };

  const nextPage = () => {
    if (data?.pagination?.hasNext) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (data?.pagination?.hasPrev) {
      setCurrentPage(currentPage - 1);
    }
  };

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['paginatedWidgets'] });
  };

  // Check if search is pending (different from debouncedSearch)
  const isSearchPending = search !== debouncedSearch;

  return {
    widgets: data?.widgets || [],
    pagination: data?.pagination || null,
    isLoading,
    isSearchPending,
    error,
    refetch,
    currentPage,
    setCurrentPage,
    limit,
    setLimit,
    source,
    setSource,
    search,
    setSearch,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    goToPage,
    nextPage,
    prevPage,
    invalidateQueries,
  };
};
