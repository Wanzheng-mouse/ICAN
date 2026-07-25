import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { request } from '@/api/client';
import { isMockEnabled } from '@/api/mockConfig';

const USE_MOCK = isMockEnabled('search');
import { apiUrl } from '@/utils/apiUrl';
import { searchIndex, type SearchResult } from '@/stores/searchIndex';

export async function searchPlatform(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  if (USE_MOCK) return searchIndex(query);
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
  if (USE_MOCK) {
    const all = searchIndex(query);
    const filtered = type === 'all' ? all : all.filter((item) => item.type === type);
    const counts = all.reduce<Record<string, number>>((acc, item) => {
      acc[item.type] = (acc[item.type] ?? 0) + 1;
      return acc;
    }, { all: all.length });
    return { items: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, page, page_size: pageSize, type_counts: counts };
  }
  return request({
    url: apiUrl('/search/advanced'),
    params: { q: query.trim(), type, page, page_size: pageSize, sort: 'relevance' },
  });
}

export function useAdvancedPlatformSearch(query: string, type: string, page: number, pageSize = 10) {
  return useQuery({
    queryKey: ['search', 'advanced', query.trim(), type, page, pageSize],
    queryFn: () => searchPlatformAdvanced(query, type, page, pageSize),
    enabled: Boolean(query.trim()),
    staleTime: 30_000,
  });
}
