import 'server-only';
import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/db/client';
import { sessions, users } from '@/db/schema';
import { randomToken, sha256 } from '@/lib/auth/crypto';
import { DAY, isoPlus, nowIso } from '@/lib/dates';

export const SESSION_COOKIE = 'ls_session';

// A session lives 30 days past its last use, and never more than 90 days
// past sign-in, however often it is used.
const SLIDING_MS = 30 * DAY;
const ABSOLUTE_MS = 90 * DAY;
// Sliding the expiry on every request would be a database write per page
// view; once a day keeps the 30-day promise to within a day.
const TOUCH_EVERY_MS = DAY;

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;

/** Creates a session and returns the raw token; only its hash is stored. */
export async function createSession(userId: string, userAgent: string | null): Promise<string> {
  const d = await db();
  const token = randomToken();
  const now = Date.now();
  await d.insert(sessions).values({
    id: crypto.randomUUID(),
    userId,
    tokenHash: sha256(token),
    lastSeenAt: isoPlus(0, now),
    expiresAt: isoPlus(SLIDING_MS, now),
    absoluteExpiresAt: isoPlus(ABSOLUTE_MS, now),
    userAgent: userAgent?.slice(0, 300) ?? null,
  });
  return token;
}

export async function validateSession(token: string | null | undefined): Promise<{ user: User; session: Session } | null> {
  if (!token) return null;
  const d = await db();
  const [row] = await d
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, sha256(token)));
  if (!row) return null;
  const now = nowIso();
  if (row.session.expiresAt <= now || row.session.absoluteExpiresAt <= now || row.user.deletedAt) {
    await d.delete(sessions).where(eq(sessions.id, row.session.id));
    return null;
  }
  if (Date.now() - Date.parse(row.session.lastSeenAt) > TOUCH_EVERY_MS) {
    const slid = isoPlus(SLIDING_MS);
    const expiresAt = slid < row.session.absoluteExpiresAt ? slid : row.session.absoluteExpiresAt;
    await d.update(sessions).set({ lastSeenAt: now, expiresAt }).where(eq(sessions.id, row.session.id));
  }
  return row;
}

export async function revokeSession(userId: string, sessionId: string): Promise<void> {
  const d = await db();
  await d.delete(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
}

/** Signs the user out everywhere, except `keepSessionId` when given. */
export async function revokeSessions(userId: string, keepSessionId?: string): Promise<void> {
  const d = await db();
  await d.delete(sessions).where(keepSessionId ? and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId)) : eq(sessions.userId, userId));
}

export function readSessionToken(req: Request): string | null {
  const header = req.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === SESSION_COOKIE) return part.slice(eq + 1).trim();
  }
  return null;
}

// Browsers other than Chrome refuse a Secure cookie over plain http, even on
// localhost, so Secure is dropped there and only there.
function isLocal(req: Request): boolean {
  const { hostname, protocol } = new URL(req.url);
  return protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1');
}

export function sessionCookie(req: Request, token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ABSOLUTE_MS / 1000}${isLocal(req) ? '' : '; Secure'}`;
}

export function clearSessionCookie(req: Request): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isLocal(req) ? '' : '; Secure'}`;
}
