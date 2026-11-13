import { z } from 'zod';
import { db } from '@/db/client';
import { authState, users } from '@/db/schema';
import { hashSecret } from '@/lib/auth/crypto';
import { normalizeUsername, usernameProblem } from '@/lib/auth/rules';
import { ApiError, json, parseBody, route } from '@/lib/server/api';
import { ipHashOf, ipLimited, recordAttempt } from '@/lib/server/attempts';
import { createSession, sessionCookie } from '@/lib/server/session';
import { assertPassword, assertPin, findUserByUsername } from '@/lib/server/users';

const Body = z.object({ username: z.string().max(100), password: z.string().max(1000), pin: z.string().max(20) });

const taken = () => new ApiError(409, 'USERNAME_TAKEN', 'That username is taken.', { fields: { username: 'That username is taken. Try another.' } });

export const POST = route(async (req) => {
  const body = await parseBody(req, Body);
  const ip = ipHashOf(req);
  if (await ipLimited('signup', ip)) throw new ApiError(429, 'RATE_LIMITED', 'Too many new accounts from this network. Try again in an hour.');

  const problem = usernameProblem(body.username);
  if (problem) throw new ApiError(400, 'VALIDATION', 'Please check the highlighted fields.', { fields: { username: problem } });
  assertPassword(body.password, body.username);
  assertPin(body.pin);
  if (await findUserByUsername(body.username)) throw taken();

  await recordAttempt('signup', ip, true);
  const d = await db();
  const id = crypto.randomUUID();
  const [passwordHash, pinHash] = await Promise.all([hashSecret(body.password), hashSecret(body.pin)]);
  try {
    await d.insert(users).values({ id, usernameDisplay: body.username.normalize('NFKC').trim(), usernameNorm: normalizeUsername(body.username), passwordHash, pinHash });
  } catch {
    // Two sign-ups raced for one name; the unique index settled it.
    throw taken();
  }
  await d.insert(authState).values({ userId: id });
  const token = await createSession(id, req.headers.get('user-agent'));
  return json({ ok: true }, { status: 201, headers: { 'Set-Cookie': sessionCookie(req, token) } });
});
