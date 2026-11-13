import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { hashSecret } from '@/lib/auth/crypto';
import { json, parseBody, requirePassword, requireUser, route } from '@/lib/server/api';
import { revokeSessions } from '@/lib/server/session';
import { assertPassword } from '@/lib/server/users';

const Body = z.object({ password: z.string().max(1000), newPassword: z.string().max(1000) });

export const POST = route(async (req) => {
  const { user, session } = await requireUser(req);
  const body = await parseBody(req, Body);
  await requirePassword(user, body.password);
  assertPassword(body.newPassword, user.usernameNorm, 'newPassword');
  const d = await db();
  await d.update(users).set({ passwordHash: await hashSecret(body.newPassword) }).where(eq(users.id, user.id));
  await revokeSessions(user.id, session.id);
  return json({ ok: true });
});
