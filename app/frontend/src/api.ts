export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function isAbortError(reason: unknown) {
  return reason instanceof DOMException && reason.name === 'AbortError';
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  accessToken?: string,
) {
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : body?.message;
    throw new ApiError(message ?? `Request failed with ${response.status}`, response.status);
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}
