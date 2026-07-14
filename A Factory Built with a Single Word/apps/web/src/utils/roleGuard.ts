import { useAppStore } from '@/stores/useAppStore';

export type PermAction = 'edit_scene' | 'run_simulation' | 'trigger_evolution' | 'delete_project' | 'manage_users' | 'export_report';

/**
 * 角色权限映射
 * admin: 所有权限
 * operator: 场景编辑、仿真运行、进化触发、报告导出
 * viewer: 仅查看
 */
const ROLE_PERMS: Record<string, Set<PermAction>> = {
  admin: new Set(['edit_scene', 'run_simulation', 'trigger_evolution', 'delete_project', 'manage_users', 'export_report']),
  operator: new Set(['edit_scene', 'run_simulation', 'trigger_evolution', 'export_report']),
  viewer: new Set([]),
};

export function useCan(action: PermAction): boolean {
  const role = useAppStore((s) => s.user?.role);
  if (!role) return false;
  return ROLE_PERMS[role]?.has(action) ?? false;
}

export function useRole(): string {
  return useAppStore((s) => s.user?.role ?? 'viewer');
}
