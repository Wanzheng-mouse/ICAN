/**
 * 认证 / 账户 API —— 真实后端实现
 *
 * 之前由 mockLogin / mockRegister / mockLogout / mockChangePassword /
 * mockUpdateProfile 提供的能力，现统一调用后端：
 *   - POST /api/v1/auth/login
 *   - POST /api/v1/auth/register
 *   - POST /api/v1/auth/logout
 *   - PUT  /api/v1/users/me           (更新资料)
 *   - POST /api/v1/auth/change-password
 *
 * DEMO_ACCOUNT_HINT 保留为登录页"演示账号"按钮的快捷填充值，
 * 实际账号需要在后端 seed 数据中存在。
 */

import { useMutation, useQuery, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import { request } from '@/api/client';
import { apiUrl } from '@/utils/apiUrl';

// ============================================================
// 类型
// ============================================================

export interface UserInfoRead {
  id: string;
  name: string;
  email: string;
  department: string;
  role: 'admin' | 'operator' | 'viewer';
  avatar: string;
  preferences?: {
    theme: 'light' | 'dark' | 'system';
    defaultPage: string;
    demoMode: boolean;
    notifyAlert: boolean;
    notifyTask: boolean;
    notifyReport: boolean;
    notifySystem: boolean;
  };
}

export interface AuthRead {
  token: string;
  user: UserInfoRead;
}

export interface LoginPayload {
  username: string;
  password: string;
  remember?: boolean;
}

export interface RegisterPayload {
  loginName: string;
  name: string;
  email: string;
  department?: string;
  password: string;
}

export interface ChangePasswordPayload {
  old_password: string;
  new_password: string;
}

export interface UpdateProfilePayload {
  name?: string;
  avatar?: string;
  department?: string;
}

// ============================================================
// 常量
// ============================================================

/**
 * 登录页"演示账号"按钮填充值。
 * 实际登录是否成功取决于后端 seed 数据是否存在该账号。
 */
export const DEMO_ACCOUNT_HINT = {
  username: 'admin',
  password: 'ican2026',
};

// ============================================================
// 通用请求
// ============================================================

export async function login(payload: LoginPayload): Promise<AuthRead> {
  return request<AuthRead>({
    url: apiUrl('/auth/login'),
    method: 'POST',
    data: {
      username: payload.username,
      password: payload.password,
      remember: payload.remember ?? false,
    },
  });
}

export async function register(payload: RegisterPayload): Promise<AuthRead> {
  return request<AuthRead>({
    url: apiUrl('/auth/register'),
    method: 'POST',
    data: {
      loginName: payload.loginName,
      name: payload.name,
      email: payload.email,
      department: payload.department ?? '未设置',
      password: payload.password,
      remember: true,
    },
  });
}

export async function logout(): Promise<void> {
  await request({
    url: apiUrl('/auth/logout'),
    method: 'POST',
  });
}

export async function changePassword(payload: ChangePasswordPayload): Promise<void> {
  await request({
    url: apiUrl('/auth/change-password'),
    method: 'POST',
    data: {
      old_password: payload.old_password,
      new_password: payload.new_password,
    },
  });
}

export async function getMyProfile(): Promise<UserInfoRead> {
  return request<UserInfoRead>({ url: apiUrl('/users/me') });
}

export async function updateMyProfile(payload: UpdateProfilePayload): Promise<UserInfoRead> {
  return request<UserInfoRead>({
    url: apiUrl('/users/me'),
    method: 'PUT',
    data: payload,
  });
}

// ============================================================
// React Query Hooks
// ============================================================

export function useMyProfile(): UseQueryResult<UserInfoRead> {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getMyProfile,
    staleTime: 60_000,
  });
}

export function useLogin(): UseMutationResult<AuthRead, Error, LoginPayload> {
  return useMutation({ mutationFn: login });
}

export function useRegister(): UseMutationResult<AuthRead, Error, RegisterPayload> {
  return useMutation({ mutationFn: register });
}

export function useLogout(): UseMutationResult<void, Error, void> {
  return useMutation({ mutationFn: logout });
}

export function useChangePassword(): UseMutationResult<void, Error, ChangePasswordPayload> {
  return useMutation({ mutationFn: changePassword });
}

export function useUpdateProfile(): UseMutationResult<UserInfoRead, Error, UpdateProfilePayload> {
  return useMutation({ mutationFn: updateMyProfile });
}

// ============================================================
// 兼容旧调用 —— 让 Login/Register/Settings/Profile/MainLayout
// 这些页面继续使用 mockLogin / mockRegister / mockLogout /
// mockChangePassword / mockUpdateProfile 的旧名。
// 语义：旧名直接调用对应真实实现。
// ============================================================

/** 兼容旧名：mockLogin —— 调用真实登录接口 */
export const mockLogin = login;
/** 兼容旧名：mockRegister —— 调用真实注册接口 */
export const mockRegister = register;
/** 兼容旧名：mockLogout —— 调用真实登出接口 */
export const mockLogout = logout;
/** 兼容旧名：mockChangePassword —— 参数顺序 (userId, oldPwd, newPwd) 兼容旧调用 */
export async function mockChangePassword(_userId: string, oldPassword: string, newPassword: string): Promise<void> {
  return changePassword({ old_password: oldPassword, new_password: newPassword });
}
/** 兼容旧名：mockUpdateProfile —— 参数顺序 (userId, {name, avatar}) 兼容旧调用 */
export async function mockUpdateProfile(
  _userId: string,
  payload: { name?: string; avatar?: string; department?: string },
): Promise<UserInfoRead> {
  return updateMyProfile(payload);
}
