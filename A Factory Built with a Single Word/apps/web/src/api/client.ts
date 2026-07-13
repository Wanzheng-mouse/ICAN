import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { message } from 'antd';
import { useAppStore } from '@/stores/useAppStore';

const BASE_URL = import.meta.env.VITE_BACKEND_URL || '';
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

const client: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAppStore.getState().token;
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

client.interceptors.response.use(
  (response) => {
    const body = response.data;
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code !== 0 && body.code !== 200) {
        message.error(body.message || '请求失败');
        return Promise.reject(new Error(body.message));
      }
      return body.data;
    }
    return body;
  },
  (error: AxiosError<{ message?: string }>) => {
    const status = error.response?.status;
    const msg = error.response?.data?.message || error.message;
    if (status === 401) {
      message.error('登录已过期，请重新登录');
      useAppStore.getState().logout();
    } else if (status === 403) {
      message.error('没有权限');
    } else if (status && status >= 500) {
      message.error('服务器错误，请稍后重试');
    } else if (!USE_MOCK) {
      message.error(msg || '网络异常');
    }
    return Promise.reject(error);
  },
);

export async function request<T = unknown>(config: AxiosRequestConfig): Promise<T> {
  return client.request<unknown, T>(config);
}

export { client, BASE_URL, USE_MOCK };
