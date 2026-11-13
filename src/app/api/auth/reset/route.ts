import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { burnVerify, hashSecret, verifySecret } from '@/lib/auth/crypto';
import { ApiError, json, parseBody, route } from '@/lib/server/api';
import { ipHashOf, ipLimited, loginSucceeded, pinBlocked, pinCleared, pinFailed, recordAttempt } from '@/lib/server/attempts';
import { createSession, revokeSessions, sessionCookie } from '@/lib/server/session';
import { assertPassword, findUserByUsername } from '@/lib/server/users';

const Body = z.object({ username: z.string().max(100), pin: z.string().max(20), newPassword: z.string().max(1000) });

// The same answer for an unknown username, a wrong PIN, a paused account and
// a frozen one, so this form can't be used to learn which usernames exist or
// whether a guess was close.
const failed = () =>
  new ApiError(400, 'RESET_FAILED', "We couldn't reset the password with those details. After several wrong tries, reset pauses for a day. If you're stuck, contact support.");

export const POST = route(async (req) => {
  const body = await parseBody(req, Body);
  const ip = ipHashOf(req);
  if (await ipLimited('pin', ip)) throw new ApiError(429, 'RATE_LIMITED', 'Too many reset attempts from this network. Try again in an hour.');
  // Checked before the PIN, against the username as typed, so a rejected
  // password says nothing about the PIN or the account.
  assertPassword(body.newPassword, body.username, 'newPassword');

  const user = await findUserByUsername(body.username);
  // Attempt state comes first: while reset is paused the PIN is never
  // compared, so guesses during a pause are worthless. burnVerify keeps the
  // timing of every failure path alike.
  if (!user || (await pinBlocked(user.id))) {
    await burnVerify(body.pin);
    await recordAttempt('pin', ip, false, user?.id ?? null);
    throw failed();
  }
  if (!(await verifySecret(user.pinHash, body.pin))) {
    await pinFailed(user.id);
    await recordAttempt('pin', ip, false, user.id);
    throw failed();
  }

  const d = await db();
  await d
    .update(users)
    .set({ passwordHash: await hashSecret(body.newPassword), mustReset: false, deletionScheduledFor: null })
    .where(eq(users.id, user.id));
  await pinCleared(user.id);
  await loginSucceeded(user.id);
  await recordAttempt('pin', ip, true, user.id);
  // Whoever held the old password is signed out everywhere.
  await revokeSessions(user.id);
  const token = await createSession(user.id, req.headers.get('user-agent'));
  return json({ ok: true }, { headers: { 'Set-Cookie': sessionCookie(req, token) } });
});
