import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { request } from '@/api/client';
import { WsClient } from '@/api/ws';
import { isMockEnabled } from '@/api/mockConfig';

const USE_MOCK = isMockEnabled('notifications');
import { apiPrefix, apiUrl } from '@/utils/apiUrl';
import { useNotificationStore, type NotificationItem } from '@/stores/useNotificationStore';
import { useAppStore } from '@/stores/useAppStore';

export async function getNotifications(): Promise<NotificationItem[]> {
  if (USE_MOCK) return useNotificationStore.getState().items;
  return request({ url: apiUrl('/notifications') });
}

export async function markNotificationRead(id: string): Promise<void> {
  if (USE_MOCK) {
    useNotificationStore.getState().markRead(id);
    return;
  }
  await request({ url: apiUrl(`/notifications/${id}/read`), method: 'PATCH' });
}

export async function markAllNotificationsRead(): Promise<void> {
  if (USE_MOCK) {
    useNotificationStore.getState().markAllRead();
    return;
  }
  await request({ url: apiUrl('/notifications/read-all'), method: 'POST' });
}

export function useNotifications() {
  return useQuery({ queryKey: ['notifications'], queryFn: getNotifications, staleTime: 15_000 });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

function resolveNotificationWsUrl(token: string): string {
  const configured = String(import.meta.env.VITE_WS_URL || '').replace(/\/$/, '');
  const suffix = `?token=${encodeURIComponent(token)}`;
  if (configured) return `${configured}${apiPrefix}/notifications/stream${suffix}`;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${apiPrefix}/notifications/stream${suffix}`;
}

export function useNotificationStream(): void {
  const token = useAppStore((state) => state.token);
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!token) return;
    if (USE_MOCK) {
      const timer = window.setInterval(() => {
        void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }, 10_000);
      return () => window.clearInterval(timer);
    }
    const client = new WsClient({
      url: resolveNotificationWsUrl(token),
      reconnectInterval: 2_000,
      heartbeatInterval: 60_000,
      onMessage: (payload) => {
        if ((payload as { type?: string })?.type === 'notification_changed') {
          void queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      },
    });
    client.connect();
    return () => client.close();
  }, [queryClient, token]);
}
