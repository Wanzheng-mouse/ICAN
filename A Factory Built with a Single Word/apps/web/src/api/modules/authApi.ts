/**
 * 认证 API（Mock 模式）
 *
 * 登录方式支持：
 * - loginName: 'admin' / 'zss' / 'lisi'
 * - name: 'Wanzheng' / 'ZhangSan' / 'LiSi'
 * - email: 'admin@ican-platform.com' / ...
 */

import type { UserInfo } from '@/stores/useAppStore';

const DEFAULT_AVATAR = 'https://api.dicebear.com/7.x/avataaars/svg?seed=';

const DEMO_USERS: Array<UserInfo & { password: string; loginName: string }> = [
  { id: 'u-001', loginName: 'admin', name: 'Wanzheng', email: 'admin@ican-platform.com', department: '技术部', role: 'admin', avatar: `${DEFAULT_AVATAR}Wanzheng`, password: 'ican2026' },
  { id: 'u-002', loginName: 'zss', name: 'ZhangSan', email: 'operator@ican-platform.com', department: '运营部', role: 'operator', avatar: `${DEFAULT_AVATAR}ZhangSan`, password: 'ican2026' },
  { id: 'u-003', loginName: 'lisi', name: 'LiSi', email: 'viewer@ican-platform.com', department: '质量部', role: 'viewer', avatar: `${DEFAULT_AVATAR}LiSi`, password: 'ican2026' },
];

export interface LoginRequest {
  username: string;
  password: string;
  remember?: boolean;
}

export interface LoginResponse {
  token: string;
  user: UserInfo;
}

export interface RegisterRequest {
  loginName: string;
  name: string;
  email: string;
  password: string;
}

const REGISTERED_USERS_KEY = 'ican-demo-registered-users';

function readRegisteredUsers(): Array<UserInfo & { password: string; loginName: string }> {
  try {
    const saved = localStorage.getItem(REGISTERED_USERS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveRegisteredUsers() {
  const registered = userDB.filter((user) => !DEMO_USERS.some((demo) => demo.id === user.id));
  localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(registered));
}

let userDB = [...DEMO_USERS, ...readRegisteredUsers()];

export function resetUserDB() {
  userDB = [...DEMO_USERS];
}

export function mockLogin(req: LoginRequest): Promise<LoginResponse> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const found = userDB.find(
        (u) => (u.loginName === req.username || u.name === req.username || u.email === req.username)
          && u.password === req.password,
      );
      if (found) {
        resolve({
          token: `mock-jwt-${found.id}-${Date.now()}`,
          user: { id: found.id, name: found.name, email: found.email, department: found.department, role: found.role, avatar: found.avatar },
        });
      } else {
        reject(new Error('账号或密码错误'));
      }
    }, 600);
  });
}

/** 本地演示注册：真实项目中应由后端完成密码加密、账户校验与令牌签发。 */
export function mockRegister(req: RegisterRequest): Promise<LoginResponse> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const loginName = req.loginName.trim();
      const name = req.name.trim();
      const email = req.email.trim().toLowerCase();
      if (!/^[a-zA-Z][a-zA-Z0-9_]{2,19}$/.test(loginName)) {
        reject(new Error('账号需以字母开头，包含 3–20 位字母、数字或下划线'));
        return;
      }
      if (userDB.some((user) => user.loginName === loginName || user.email.toLowerCase() === email)) {
        reject(new Error('该账号或邮箱已被注册'));
        return;
      }
      const user = {
        id: `u-local-${Date.now()}`,
        loginName,
        name,
        email,
        password: req.password,
        department: '未设置',
        role: 'operator' as const,
        avatar: `${DEFAULT_AVATAR}${encodeURIComponent(name)}`,
      };
      userDB = [...userDB, user];
      saveRegisteredUsers();
      resolve({
        token: `mock-jwt-${user.id}-${Date.now()}`,
        user: { id: user.id, name: user.name, email: user.email, department: user.department, role: user.role, avatar: user.avatar },
      });
    }, 500);
  });
}

export function mockLogout(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 200));
}

export function mockUpdateProfile(userId: string, updates: Partial<UserInfo>): Promise<UserInfo> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const idx = userDB.findIndex((u) => u.id === userId);
      if (idx < 0) return reject(new Error('用户不存在'));
      userDB[idx] = { ...userDB[idx], ...updates } as typeof userDB[0];
      const { password: _p, loginName: _n, ...safe } = userDB[idx];
      resolve(safe);
    }, 400);
  });
}

export function mockChangePassword(userId: string, oldPwd: string, newPwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const user = userDB.find((u) => u.id === userId);
      if (!user) return reject(new Error('用户不存在'));
      if (user.password !== oldPwd) return reject(new Error('原密码错误'));
      user.password = newPwd;
      resolve();
    }, 400);
  });
}

export const DEMO_ACCOUNT_HINT = { username: 'admin', password: 'ican2026' };
