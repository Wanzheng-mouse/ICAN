import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { request } from '@/api/client';
import { apiUrl } from '@/utils/apiUrl';
import type { SearchResult } from '@/stores/searchIndex';

export async function searchPlatform(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  return request({ url: apiUrl('/search'), params: { q: query.trim() } });
}

export function usePlatformSearch(query: string): UseQueryResult<SearchResult[]> {
  return useQuery({
    queryKey: ['search', query.trim()],
    queryFn: () => searchPlatform(query),
    enabled: Boolean(query.trim()),
    staleTime: 30_000,
  });
}

export interface SearchPageResult {
  items: SearchResult[];
  total: number;
  page: number;
  page_size: number;
  type_counts: Record<string, number>;
}

export async function searchPlatformAdvanced(
  query: string,
  type = 'all',
  page = 1,
  pageSize = 10,
): Promise<SearchPageResult> {
  if (!query.trim()) return { items: [], total: 0, page: 1, page_size: pageSize, type_counts: { all: 0 } };
  return request({
    url: apiUrl('/search/advanced'),
    params: { q: query.trim(), type, page, page_size: pageSize, sort: 'relevance' },
  });
}

export function useAdvancedPlatformSearch(query: string, type = 'all', page = 1, pageSize = 10): UseQueryResult<SearchPageResult> {
  return useQuery({
    queryKey: ['search', 'advanced', query.trim(), type, page, pageSize],
    queryFn: () => searchPlatformAdvanced(query, type, page, pageSize),
    enabled: Boolean(query.trim()),
    staleTime: 30_000,
  });
}
