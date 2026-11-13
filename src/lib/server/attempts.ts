import 'server-only';
import { and, count, eq, gt, lt } from 'drizzle-orm';
import { db } from '@/db/client';
import { authAttempts, authState } from '@/db/schema';
import { hashIp } from '@/lib/auth/crypto';
import { DAY, HOUR, MINUTE, isoPlus, nowIso } from '@/lib/dates';

type Kind = (typeof authAttempts.$inferInsert)['kind'];

export const LOGIN_MAX_FAILURES = 5;
const LOGIN_WINDOW_MS = 15 * MINUTE;
const LOGIN_LOCK_MS = 15 * MINUTE;
export const PIN_MAX_FAILURES = 5;
const PIN_LOCK_MS = 24 * HOUR;
export const PIN_LOCKOUTS_BEFORE_FREEZE = 3;

// Failed attempts allowed from one address per hour, whatever account they
// aim at. Generous enough for a family behind one router, far too slow for
// guessing across accounts.
const IP_LIMITS: Record<Kind, number> = { login: 30, pin: 15, invite: 20, support: 5, signup: 10 };

/** Vercel sets x-forwarded-for itself, so the first hop is the real client. */
export function ipHashOf(req: Request): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  return hashIp(ip);
}

export async function recordAttempt(kind: Kind, ipHash: string, success: boolean, userId: string | null = null): Promise<void> {
  const d = await db();
  await d.insert(authAttempts).values({ id: crypto.randomUUID(), kind, ipHash, success, userId });
}

/**
 * True when this address has used up its hourly allowance. Support requests
 * and sign-ups count every submission; the others count failures only, so a household
 * signing in successfully all evening never trips it.
 */
export async function ipLimited(kind: Kind, ipHash: string): Promise<boolean> {
  const d = await db();
  const since = isoPlus(-HOUR);
  const filters = [eq(authAttempts.kind, kind), eq(authAttempts.ipHash, ipHash), gt(authAttempts.createdAt, since)];
  if (kind !== 'support' && kind !== 'signup') filters.push(eq(authAttempts.success, false));
  const [row] = await d.select({ n: count() }).from(authAttempts).where(and(...filters));
  return row.n >= IP_LIMITS[kind];
}

/** Failed invite-code guesses by one signed-in user in the last hour. */
export async function inviteGuessesBy(userId: string): Promise<number> {
  const d = await db();
  const [row] = await d
    .select({ n: count() })
    .from(authAttempts)
    .where(and(eq(authAttempts.kind, 'invite'), eq(authAttempts.userId, userId), eq(authAttempts.success, false), gt(authAttempts.createdAt, isoPlus(-HOUR))));
  return row.n;
}

async function stateOf(userId: string) {
  const d = await db();
  const [row] = await d.select().from(authState).where(eq(authState.userId, userId));
  if (row) return row;
  await d.insert(authState).values({ userId }).onConflictDoNothing();
  const [made] = await d.select().from(authState).where(eq(authState.userId, userId));
  return made;
}

// Each wrong guess makes the next one wait twice as long (1s, 2s, 4s, 8s),
// before the full lock on the fifth.
function backoffMs(failures: number): number {
  return 1000 * 2 ** (failures - 1);
}

/** When sign-in is paused for this account, the instant it reopens. */
export async function loginLockedUntil(userId: string): Promise<string | null> {
  const s = await stateOf(userId);
  return s.loginLockedUntil && s.loginLockedUntil > nowIso() ? s.loginLockedUntil : null;
}

export async function loginFailed(userId: string): Promise<void> {
  const d = await db();
  const s = await stateOf(userId);
  const windowOpen = s.loginWindowStart && Date.now() - Date.parse(s.loginWindowStart) < LOGIN_WINDOW_MS;
  const failures = windowOpen ? s.loginFailures + 1 : 1;
  const locked = failures >= LOGIN_MAX_FAILURES;
  await d
    .update(authState)
    .set({
      // A full lock starts a fresh count, so the next mistake after it is
      // a first mistake again rather than an instant re-lock.
      loginFailures: locked ? 0 : failures,
      loginWindowStart: locked ? null : windowOpen ? s.loginWindowStart : nowIso(),
      loginLockedUntil: isoPlus(locked ? LOGIN_LOCK_MS : backoffMs(failures)),
    })
    .where(eq(authState.userId, userId));
}

export async function loginSucceeded(userId: string): Promise<void> {
  const d = await db();
  await d.update(authState).set({ loginFailures: 0, loginWindowStart: null, loginLockedUntil: null }).where(eq(authState.userId, userId));
}

/** Whether a PIN may be tried right now. Checked before the PIN is looked at. */
export async function pinBlocked(userId: string): Promise<boolean> {
  const s = await stateOf(userId);
  return s.pinFrozen || Boolean(s.pinLockedUntil && s.pinLockedUntil > nowIso());
}

export async function pinFailed(userId: string): Promise<void> {
  const d = await db();
  const s = await stateOf(userId);
  const failures = s.pinFailures + 1;
  if (failures < PIN_MAX_FAILURES) {
    await d
      .update(authState)
      .set({ pinFailures: failures, pinLockedUntil: isoPlus(backoffMs(failures)) })
      .where(eq(authState.userId, userId));
    return;
  }
  const lockouts = s.pinLockoutsInRow + 1;
  await d
    .update(authState)
    .set({ pinFailures: 0, pinLockedUntil: isoPlus(PIN_LOCK_MS), pinLockoutsInRow: lockouts, pinFrozen: lockouts >= PIN_LOCKOUTS_BEFORE_FREEZE })
    .where(eq(authState.userId, userId));
}

/** A correct PIN, or an admin recovery, clears every PIN counter. */
export async function pinCleared(userId: string): Promise<void> {
  const d = await db();
  await stateOf(userId);
  await d.update(authState).set({ pinFailures: 0, pinLockedUntil: null, pinLockoutsInRow: 0, pinFrozen: false }).where(eq(authState.userId, userId));
}

/** Attempt rows are only needed for the hourly limits; a week is plenty for review. */
export async function pruneAttempts(): Promise<void> {
  const d = await db();
  await d.delete(authAttempts).where(lt(authAttempts.createdAt, isoPlus(-7 * DAY)));
}
