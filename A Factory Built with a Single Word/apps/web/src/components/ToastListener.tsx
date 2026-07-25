import { useEffect } from 'react';
import { App } from 'antd';
import { TOAST_EVENT_TYPE, type ToastPayload } from '@/utils/notify';

export function ToastListener() {
  const { message } = App.useApp();
  useEffect(() => {
    const handler = (event: Event) => {
      const { type, content } = (event as CustomEvent<ToastPayload>).detail;
      message[type](content);
    };
    window.addEventListener(TOAST_EVENT_TYPE, handler);
    return () => window.removeEventListener(TOAST_EVENT_TYPE, handler);
  }, [message]);
  return null;
}
