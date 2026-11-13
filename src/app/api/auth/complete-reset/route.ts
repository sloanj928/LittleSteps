import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { hashSecret } from '@/lib/auth/crypto';
import { ApiError, json, parseBody, requireUser, route } from '@/lib/server/api';
import { pinCleared } from '@/lib/server/attempts';
import { revokeSessions } from '@/lib/server/session';
import { assertPassword, assertPin } from '@/lib/server/users';

const Body = z.object({ newPassword: z.string().max(1000), newPin: z.string().max(20) });

// The second half of admin recovery: the temporary password only gets the
// user this far. They choose a new password and a new PIN, and the admin who
// issued the temporary one knows neither.
export const POST = route(async (req) => {
  const { user, session } = await requireUser(req, { allowMustReset: true });
  if (!user.mustReset) throw new ApiError(400, 'NOT_NEEDED', 'Your account does not need a reset.');
  const body = await parseBody(req, Body);
  assertPassword(body.newPassword, user.usernameNorm, 'newPassword');
  assertPin(body.newPin, 'newPin');

  const d = await db();
  const [passwordHash, pinHash] = await Promise.all([hashSecret(body.newPassword), hashSecret(body.newPin)]);
  await d.update(users).set({ passwordHash, pinHash, mustReset: false }).where(eq(users.id, user.id));
  await pinCleared(user.id);
  await revokeSessions(user.id, session.id);
  return json({ ok: true });
});
