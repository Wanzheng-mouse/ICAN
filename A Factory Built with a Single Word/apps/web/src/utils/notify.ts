const TOAST_EVENT = 'ican:toast';

interface ToastPayload {
  type: 'success' | 'error' | 'warning' | 'info';
  content: string;
}

export function showToast(type: ToastPayload['type'], content: string) {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { type, content } }));
}

export const TOAST_EVENT_TYPE = TOAST_EVENT;
export type { ToastPayload };
