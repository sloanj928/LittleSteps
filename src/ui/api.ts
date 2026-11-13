import type { ApiErrorBody } from '@/lib/types';

/** Every failed request, including "no network", arrives as one of these. */
export class ApiFailure extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields: Record<string, string> = {},
    public details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export const OFFLINE_MESSAGE = "You're offline. Nothing was lost: your typing is still here, and you can save once you're back online.";

interface Options {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
}

/** The only way the app talks to the server: same-origin JSON, session cookie attached by the browser. */
export async function api<T>(path: string, { method = 'GET', body }: Options = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiFailure(0, 'NETWORK', OFFLINE_MESSAGE);
  }
  if (res.ok) return (await res.json()) as T;

  let parsed: ApiErrorBody | null = null;
  try {
    parsed = (await res.json()) as ApiErrorBody;
  } catch {
    parsed = null;
  }
  const error = parsed?.error;
  const failure = new ApiFailure(res.status, error?.code ?? 'SERVER_ERROR', error?.message ?? 'Something went wrong. Please try again.', error?.details?.fields ?? {}, error?.details ?? {});
  // A session that ended, or an account mid-recovery, can only go one place.
  // Sign-in itself answers 401 for a wrong password, hence the code check.
  if (failure.code === 'UNAUTHENTICATED' && !location.pathname.startsWith('/signin')) reloadAt('/signin');
  if (failure.code === 'MUST_RESET' && !location.pathname.startsWith('/reset-required')) reloadAt('/reset-required');
  throw failure;
}

/**
 * A full page load, not a client-side navigation. Used whenever the session
 * changes (sign-in, sign-out, reset): it drops every cached query and the
 * React tree, so nothing of the previous account survives in memory, and the
 * server renders the next page for the new session.
 */
export function reloadAt(path: string): void {
  location.assign(path);
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export function fieldsOf(error: unknown): Record<string, string> {
  return error instanceof ApiFailure ? error.fields : {};
}
