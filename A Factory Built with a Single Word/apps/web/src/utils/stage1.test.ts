/**
 * 路由守卫与用户状态单元测试
 * 不依赖 jsdom / React Testing Library，仅测试纯逻辑。
 */
import { describe, expect, it, beforeEach } from 'vitest';

describe('登录/退出状态', () => {
  beforeEach(async () => {
    const { useAppStore } = await import('@/stores/useAppStore');
    useAppStore.getState().logout();
  });

  it('初始 user 为 null', async () => {
    const { useAppStore } = await import('@/stores/useAppStore');
    expect(useAppStore.getState().user).toBeNull();
    expect(useAppStore.getState().token).toBeNull();
  });

  it('login 后 user 和 token 有值', async () => {
    const { useAppStore } = await import('@/stores/useAppStore');
    useAppStore.getState().login(
      { id: 'u-001', name: 'TestUser', email: '', department: '', avatar: '', role: 'admin' },
      'mock-token',
      true,
    );
    const state = useAppStore.getState();
    expect(state.user?.name).toBe('TestUser');
    expect(state.token).toBe('mock-token');
    expect(state.remember).toBe(true);
  });

  it('logout 后全部清除', async () => {
    const { useAppStore } = await import('@/stores/useAppStore');
    useAppStore.getState().login(
      { id: 'u-001', name: 'X', email: '', department: '', avatar: '', role: 'admin' },
      'tok',
    );
    useAppStore.getState().logout();
    const state = useAppStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.currentProjectId).toBeNull();
  });
});

describe('searchIndex 搜索功能', () => {
  it('搜索关键词返回匹配结果', async () => {
    const { searchIndex } = await import('@/stores/searchIndex');
    const results = searchIndex('电商');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toContain('电商');
  });

  it('无效搜索返回空数组', async () => {
    const { searchIndex } = await import('@/stores/searchIndex');
    expect(searchIndex('xyznotfound')).toHaveLength(0);
  });

  it('空字符串返回空数组', async () => {
    const { searchIndex } = await import('@/stores/searchIndex');
    expect(searchIndex('')).toHaveLength(0);
    expect(searchIndex('   ')).toHaveLength(0);
  });
});

describe('通知已读/未读状态', () => {
  it('初始有未读通知', async () => {
    const { useNotificationStore } = await import('@/stores/useNotificationStore');
    expect(useNotificationStore.getState().unreadCount()).toBeGreaterThan(0);
  });

  it('标记单条已读后未读书减少', async () => {
    const { useNotificationStore } = await import('@/stores/useNotificationStore');
    const before = useNotificationStore.getState().unreadCount();
    const first = useNotificationStore.getState().items.find((n) => !n.read);
    if (first) {
      useNotificationStore.getState().markRead(first.id);
      expect(useNotificationStore.getState().unreadCount()).toBe(before - 1);
    }
  });

  it('全部标为已读后未读为 0', async () => {
    const { useNotificationStore } = await import('@/stores/useNotificationStore');
    useNotificationStore.getState().markAllRead();
    expect(useNotificationStore.getState().unreadCount()).toBe(0);
  });
});

describe('项目上下文状态', () => {
  it('setProjectContext 设置 ID 链', async () => {
    const { useAppStore } = await import('@/stores/useAppStore');
    useAppStore.getState().setProjectContext({ projectId: 'p1', scenarioId: 's1', simulationId: 'sim1', evolutionId: 'ev1' });
    const s = useAppStore.getState();
    expect(s.currentProjectId).toBe('p1');
    expect(s.currentScenarioId).toBe('s1');
    expect(s.currentSimulationId).toBe('sim1');
    expect(s.currentEvolutionId).toBe('ev1');
  });

  it('clearProjectContext 清除所有 ID', async () => {
    const { useAppStore } = await import('@/stores/useAppStore');
    useAppStore.getState().setProjectContext({ projectId: 'p1' });
    useAppStore.getState().clearProjectContext();
    const s = useAppStore.getState();
    expect(s.currentProjectId).toBeNull();
    expect(s.currentScenarioId).toBeNull();
  });
});
