import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { burnVerify, verifySecret } from '@/lib/auth/crypto';
import { ApiError, json, parseBody, route } from '@/lib/server/api';
import { ipHashOf, ipLimited, loginFailed, loginLockedUntil, loginSucceeded, recordAttempt } from '@/lib/server/attempts';
import { createSession, sessionCookie } from '@/lib/server/session';
import { findUserByUsername } from '@/lib/server/users';

const Body = z.object({ username: z.string().max(100), password: z.string().max(1000) });

// One message for "no such user" and "wrong password".
const badCredentials = () => new ApiError(401, 'BAD_CREDENTIALS', "That username and password don't match.");

export const POST = route(async (req) => {
  const body = await parseBody(req, Body);
  const ip = ipHashOf(req);
  if (await ipLimited('login', ip)) throw new ApiError(429, 'RATE_LIMITED', 'Too many sign-in attempts from this network. Try again in an hour.');

  const user = await findUserByUsername(body.username);
  if (!user) {
    await burnVerify(body.password);
    await recordAttempt('login', ip, false);
    throw badCredentials();
  }
  const lockedUntil = await loginLockedUntil(user.id);
  if (lockedUntil) {
    // No password check while paused: a guess made during the pause learns nothing.
    await recordAttempt('login', ip, false, user.id);
    throw new ApiError(429, 'LOCKED', 'Sign-in is paused after several wrong passwords. Try again in a few minutes.', { until: lockedUntil });
  }
  if (!(await verifySecret(user.passwordHash, body.password))) {
    await loginFailed(user.id);
    await recordAttempt('login', ip, false, user.id);
    throw badCredentials();
  }
  await loginSucceeded(user.id);
  await recordAttempt('login', ip, true, user.id);

  // Signing in during the 30-day wait is how a deletion is cancelled.
  const deletionCancelled = Boolean(user.deletionScheduledFor);
  if (deletionCancelled) {
    const d = await db();
    await d.update(users).set({ deletionScheduledFor: null }).where(eq(users.id, user.id));
  }
  const token = await createSession(user.id, req.headers.get('user-agent'));
  return json({ mustReset: user.mustReset, deletionCancelled }, { headers: { 'Set-Cookie': sessionCookie(req, token) } });
});
