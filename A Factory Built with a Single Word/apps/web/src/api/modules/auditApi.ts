import { useQuery } from '@tanstack/react-query';
import { request } from '@/api/client';
import { isMockEnabled } from '@/api/mockConfig';

const USE_MOCK = isMockEnabled('audit');
import { apiUrl } from '@/utils/apiUrl';

export interface AuditLogRead {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  detail: Record<string, unknown>;
  created_at: string;
}

export async function getAuditLogs(limit = 200): Promise<AuditLogRead[]> {
  if (USE_MOCK) return [];
  return request({ url: apiUrl('/audit-logs'), params: { limit } });
}

export function useAuditLogs(limit = 200) {
  return useQuery({
    queryKey: ['audit-logs', limit],
    queryFn: () => getAuditLogs(limit),
  });
}
