interface ApiErrorPayload {
  detail?: string | { message?: string; issues?: Array<{ message?: string }> };
  message?: string;
  errors?: Array<{ msg?: string }>;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  const candidate = error as {
    message?: string;
    response?: { data?: ApiErrorPayload };
  };
  const payload = candidate.response?.data;
  if (typeof payload?.detail === 'string') return payload.detail;
  if (payload?.detail && typeof payload.detail.message === 'string') return payload.detail.message;
  if (payload?.detail && payload.detail.issues?.[0]?.message) return `${payload.detail.message ?? fallback}：${payload.detail.issues[0].message}`;
  if (payload?.errors?.[0]?.msg) return payload.errors[0].msg;
  if (payload?.message) return payload.message;
  if (candidate.message && !candidate.message.startsWith('Request failed with status code')) {
    return candidate.message;
  }
  return fallback;
}
