import { afterEach, describe, expect, it } from 'vitest';
import { filterNotifications } from './useNotificationStore';
import { useAppStore, type UserInfo } from './useAppStore';

const user: UserInfo = {
  id: 'week1-user',
  name: 'Week 1 User',
  email: 'week1@example.com',
  department: 'Test',
  avatar: '',
  role: 'operator',
};

afterEach(() => {
  useAppStore.setState({ user: null, token: null, remember: false, preferencesByUserId: {} });
});

describe('第一周个人偏好', () => {
  it('按用户恢复已保存的默认入口和主题', () => {
    const store = useAppStore.getState();
    store.login(user, 'token', true);
    store.updatePreferences({ defaultPage: '/report', theme: 'dark' });
    store.logout();
    store.login(user, 'token-2', true);

    expect(useAppStore.getState().user?.preferences).toMatchObject({
      defaultPage: '/report',
      theme: 'dark',
    });
  });
});

describe('第一周通知偏好', () => {
  const items = [
    { id: 'a', type: 'alert' as const, title: '', content: '', read: false, createdAt: '' },
    { id: 't', type: 'task' as const, title: '', content: '', read: false, createdAt: '' },
    { id: 's', type: 'system' as const, title: '', content: '', read: false, createdAt: '' },
  ];

  it('会隐藏用户关闭的通知类型', () => {
    const result = filterNotifications(items, {
      theme: 'light', defaultPage: '/', demoMode: false,
      notifyAlert: false, notifyTask: true, notifySystem: false,
    });
    expect(result.map((item) => item.id)).toEqual(['t']);
  });
});
