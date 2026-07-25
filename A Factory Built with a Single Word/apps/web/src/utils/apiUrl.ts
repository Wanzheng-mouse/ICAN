/**
 * 统一 API URL 生成器
 *
 * 用法：
 *   import { apiUrl } from '@/utils/apiUrl';
 *   apiUrl('/projects')          → /api/v1/projects
 *   apiUrl('/templates')         → /api/templates  (不走 v1 前缀)
 *   apiUrl('/auth/login')        → /api/v1/auth/login
 *
 * 新增时在下方 TWO_PREFIX 或 NO_PREFIX 数组中注册例外路径。
 *
 * 环境变量 VITE_API_PREFIX（默认 /api/v1）
 */

const API_PREFIX = import.meta.env.VITE_API_PREFIX ?? '/api/v1';
export const apiPrefix = API_PREFIX;

/** 走 /api 前缀（而非 /api/v1）的路径 */
const TWO_PREFIX: string[] = ['/templates', '/health'];
/** 不加任何前缀的路径 */
const NO_PREFIX: string[] = [];

/**
 * 生成完整 API URL
 * @param path  以 / 开头的路径，例如 '/projects'、'/templates'
 * @param query 可选查询参数对象
 */
export function apiUrl(path: string, query?: Record<string, string | number | undefined>): string {
  const clean = path.startsWith('/') ? path : `/${path}`;

  const prefix = TWO_PREFIX.some((p) => clean.startsWith(p))
    ? '/api'
    : NO_PREFIX.some((p) => clean.startsWith(p))
      ? ''
      : API_PREFIX;

  let url = `${prefix}${clean}`;

  if (query) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined) params.set(k, String(v));
    });
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  return url;
}
