/**
 * Typed API client for Guardian engine.
 *
 * All requests go through this module so auth failures (401) are handled
 * in one place. Components never call fetch() directly.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: { error?: string } = {},
  ) {
    super(body.error || `API error ${status}`);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...((opts.headers as Record<string, string>) ?? {}),
    },
    ...opts,
  });

  if (res.status === 401) {
    // Session expired or missing — redirect to login
    const current = window.location.pathname + window.location.search;
    window.location.href = `/login?next=${encodeURIComponent(current)}`;
    // Return a never-resolving promise so callers don't see an error flash
    return new Promise(() => {});
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body != null ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: body != null ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string) =>
    request<T>(path, { method: "DELETE" }),
};
