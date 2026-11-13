import 'server-only';
import type { z } from 'zod';
import { db } from '@/db/client';
import { auditLog } from '@/db/schema';
import { verifySecret } from '@/lib/auth/crypto';
import { loginFailed, loginLockedUntil, loginSucceeded } from './attempts';
import { readSessionToken, validateSession, type Session, type User } from './session';

/** Thrown anywhere under `route()`; becomes the error envelope. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = () => new ApiError(404, 'NOT_FOUND', "We couldn't find that.");

export function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

// Cross-site requests can ride the session cookie, so every state-changing
// request must come from our own pages. Browsers always send Origin on
// non-GET fetches; a form on another site sends its own origin, or none.
function assertSameOrigin(req: Request): void {
  if (req.method === 'GET' || req.method === 'HEAD') return;
  const origin = req.headers.get('origin');
  const host = req.headers.get('host') ?? new URL(req.url).host;
  let originHost: string | null = null;
  try {
    originHost = origin ? new URL(origin).host : null;
  } catch {
    originHost = null;
  }
  if (!originHost || originHost !== host) throw new ApiError(403, 'BAD_ORIGIN', 'That request came from somewhere unexpected.');
}

/**
 * Wraps a route handler: same-origin check, awaited params, and one error
 * envelope `{ error: { code, message, details? } }`. Unexpected errors are
 * logged by name and message only, never with the request body.
 */
export function route<P = Record<string, never>>(fn: (req: Request, params: P) => Promise<Response>) {
  return async (req: Request, ctx: { params: Promise<P> }): Promise<Response> => {
    try {
      assertSameOrigin(req);
      return await fn(req, await ctx.params);
    } catch (e) {
      if (e instanceof ApiError) {
        return json({ error: { code: e.code, message: e.message, details: e.details } }, { status: e.status });
      }
      console.error('[api]', req.method, new URL(req.url).pathname, e instanceof Error ? `${e.name}: ${e.message}` : 'unknown error');
      return json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong on our side. Nothing was saved; please try again.' } }, { status: 500 });
    }
  };
}

export function validate<S extends z.ZodType>(schema: S, raw: unknown): z.infer<S> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[issue.path.join('.') || '_'] ??= issue.message;
    throw new ApiError(400, 'VALIDATION', 'Please check the highlighted fields.', { fields });
  }
  return parsed.data;
}

export async function parseBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  // Requiring JSON also blocks plain HTML forms, which cannot send it.
  if (!req.headers.get('content-type')?.includes('application/json')) throw new ApiError(415, 'BAD_CONTENT_TYPE', 'Send JSON.');
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, 'BAD_JSON', "That request couldn't be read.");
  }
  return validate(schema, raw);
}

export interface Authed {
  user: User;
  session: Session;
}

/**
 * The signed-in user, or 401. While an admin-issued temporary password is in
 * force every route but the ones finishing that reset answers MUST_RESET.
 */
export async function requireUser(req: Request, opts: { allowMustReset?: boolean } = {}): Promise<Authed> {
  const found = await validateSession(readSessionToken(req));
  if (!found) throw new ApiError(401, 'UNAUTHENTICATED', 'Please sign in.');
  if (found.user.mustReset && !opts.allowMustReset) throw new ApiError(403, 'MUST_RESET', 'Choose a new password and PIN to continue.');
  return found;
}

export async function requireAdmin(req: Request): Promise<Authed> {
  const authed = await requireUser(req);
  // 404, not 403: the console's existence is nobody else's business.
  if (!authed.user.isAdmin) throw notFound();
  return authed;
}

/**
 * Sensitive actions ask for the password again. Wrong guesses count toward
 * the same lock as sign-in, so a borrowed unlocked phone can't be used to
 * guess it.
 */
export async function requirePassword(user: User, password: string): Promise<void> {
  if (await loginLockedUntil(user.id)) throw new ApiError(429, 'LOCKED', 'Too many wrong passwords. Try again in a little while.');
  if (!(await verifySecret(user.passwordHash, password))) {
    await loginFailed(user.id);
    throw new ApiError(403, 'WRONG_PASSWORD', "That password isn't right.", { fields: { password: "That password isn't right." } });
  }
  await loginSucceeded(user.id);
}

export async function audit(actorId: string, action: string, targetUserId: string | null, detail?: string): Promise<void> {
  const d = await db();
  await d.insert(auditLog).values({ id: crypto.randomUUID(), actorId, action, targetUserId, detail: detail ?? null });
}
