import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
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
    const isSuccessEnvelope = Boolean(
      body &&
        typeof body === 'object' &&
        'code' in body &&
        'message' in body &&
        'data' in body,
    );
    if (isSuccessEnvelope) {
      const envelope = body as ApiResponse;
      if (envelope.code !== 0 && envelope.code !== 200) {
        return Promise.reject(new Error(envelope.message));
      }
      return envelope.data;
    }
    return body;
  },
  (error: AxiosError<{ message?: string; detail?: string | { message?: string } }>) => {
    const status = error.response?.status;
    if (status === 401) {
      if (useAppStore.getState().token) {
        showToast('error', '登录已过期，请重新登录');
        useAppStore.getState().logout();
      }
    } else if (status === 403) {
      showToast('error', '没有权限');
    }
    return Promise.reject(error);
  },
);

export async function request<T = unknown>(config: AxiosRequestConfig): Promise<T> {
  return client.request<unknown, T>(config);
}

export { client, BASE_URL, USE_MOCK };
